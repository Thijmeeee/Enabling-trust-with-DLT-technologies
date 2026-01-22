import enhancedDB from '../data/hybridDataStore';
import { localDB } from '../data/localData';
import { LifecycleStatus, ValidTransitions, LifecycleStatusLabels } from '../types/lifecycle';
import { certifyProduct, deactivateDID, updateDIDViaBackend } from './didOperationsLocal';

/**
 * Result of a transition attempt
 */
export interface TransitionResult {
    success: boolean;
    message: string;
    requiredActions?: {
        type: 'handle_children';
        children: any[]; // DPPRelationship[]
    };
}

/**
 * Lifecycle Manager
 * centralized logic for handling DPP state transitions
 */
export const LifecycleManager = {
    /**
     * Check if a transition is valid according to the state machine
     */
    validateTransition(currentStatus: LifecycleStatus | string, newStatus: LifecycleStatus): boolean {
        const current = (currentStatus || 'created') as LifecycleStatus;

        // Allow any transition TO 'tampered' (system state)
        if (newStatus === 'tampered') return true;

        // Allow fixing 'tampered' back to 'active'
        if (current === 'tampered' && newStatus === 'active') return true;

        const allowed = ValidTransitions[current] || [];
        return allowed.includes(newStatus);
    },

    /**
     * Execute a lifecycle transition
     * Handles both the state update and any necessary backend/blockchain operations
     */
    async transitionLifecycle(
        dppId: string,
        newStatus: LifecycleStatus,
        actorDid: string,
        reason: string = 'Manual status update',
        meta: Record<string, any> = {}
    ): Promise<TransitionResult> {
        const dpp = await enhancedDB.getDPPById(dppId);
        if (!dpp) return { success: false, message: 'DPP not found' };

        // 1. Validate Transition
        if (!this.validateTransition(dpp.lifecycle_status, newStatus)) {
            return {
                success: false,
                message: `Invalid transition from ${dpp.lifecycle_status} to ${newStatus}`
            };
        }

        // 2. Check Dependencies (e.g., Parent is Recycled -> Children must be handled)
        if (newStatus === 'recycled' || newStatus === 'deprecated') {
            const children = await enhancedDB.getRelationshipsByParent(dpp.did);
            // Filter for active children only
            const activeChildren = [];
            for (const rel of children) {
                const childDPP = await enhancedDB.getDPPByDID(rel.child_did);
                if (childDPP && childDPP.lifecycle_status === 'active') {
                    activeChildren.push(childDPP);
                }
            }

            if (activeChildren.length > 0 && !meta.forceCascade) {
                return {
                    success: false,
                    message: 'Active components found. Please decide how to handle them.',
                    requiredActions: {
                        type: 'handle_children',
                        children: activeChildren
                    }
                };
            }
        }

        // 3. Execute Operation based on target state
        try {
            let result;
            switch (newStatus) {
                case 'active':
                    // Activation usually happens via certification or creation
                    // We'll treat it as a certification event if coming from 'created'
                    if (dpp.lifecycle_status === 'created') {
                        result = await certifyProduct(dppId, actorDid, {
                            inspector: meta.inspector || 'System Admin',
                            certificateType: 'Initial Activation',
                            notes: reason,
                            status: 'active'
                        });
                    } else {
                        // Just a status update
                        await this.forceUpdateStatus(dppId, 'active');
                        result = { success: true, message: 'Status updated to Active' };
                    }
                    break;

                case 'deactivated':
                    result = await deactivateDID(dppId, actorDid, reason);
                    break;

                case 'recycled':
                case 'deprecated':
                case 'in_maintenance':
                    // Generic status update anchored as a generic DID update
                    // We use the 'updateDIDViaBackend' to anchor custom metadata
                    await updateDIDViaBackend(dppId, actorDid, {
                        description: `Status changed to ${LifecycleStatusLabels[newStatus]}. Reason: ${reason}`
                    });
                    await this.forceUpdateStatus(dppId, newStatus);
                    result = { success: true, message: `Status updated to ${LifecycleStatusLabels[newStatus]}` };
                    break;

                case 'tampered':
                    // System only
                    await this.forceUpdateStatus(dppId, 'tampered');
                    result = { success: true, message: 'Marked as TAMPERED' };
                    break;

                default:
                    return { success: false, message: `Handler for ${newStatus} not implemented` };
            }

            return result;

        } catch (e) {
            console.error('Lifecycle transition failed:', e);
            return { success: false, message: 'Internal error during transition' };
        }
    },

    /**
     * Helper to directly update DB status
     */
    async forceUpdateStatus(dppId: string, status: LifecycleStatus) {
        await enhancedDB.updateDPP(dppId, { lifecycle_status: status });
        await localDB.updateDPP(dppId, { lifecycle_status: status });
    }
};
