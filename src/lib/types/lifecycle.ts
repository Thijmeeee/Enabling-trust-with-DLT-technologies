/**
 * DPP Lifecycle Types
 * Defines the valid states for a Digital Product Passport
 */

export type LifecycleStatus =
    | 'created'          // Initial state
    | 'active'           // Valid, in use
    | 'in_maintenance'   // Temporarily unavailable
    | 'deprecated'       // End of active life, pending disposal (was 'end_of_life')
    | 'recycled'         // Processed/disposed (was 'disposed')
    | 'deactivated'      // Permanently disabled
    | 'tampered'         // Integrity check failed (System state, not user-settable)
    | 'replaced';        // Superseded by a new version

export const LifecycleStatusLabels: Record<LifecycleStatus, string> = {
    created: 'Created',
    active: 'Active',
    in_maintenance: 'In Maintenance',
    deprecated: 'Deprecated',
    recycled: 'Recycled',
    deactivated: 'Deactivated',
    tampered: 'Tampered (Invalid)',
    replaced: 'Replaced'
};

export const ValidTransitions: Record<LifecycleStatus, LifecycleStatus[]> = {
    created: ['active', 'deactivated'],
    active: ['in_maintenance', 'deprecated', 'deactivated', 'tampered', 'replaced'],
    in_maintenance: ['active', 'deprecated', 'deactivated'],
    deprecated: ['recycled', 'deactivated'],
    recycled: [], // Terminal
    deactivated: [], // Terminal
    tampered: ['active', 'deactivated'], // Can be resolved/reset to active or killed
    replaced: [] // Terminal
};
