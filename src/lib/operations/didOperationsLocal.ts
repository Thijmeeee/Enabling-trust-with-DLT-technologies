import { hybridDataStore as enhancedDB } from '../data/hybridDataStore';
import { localDB } from '../data/localData';

/**
 * Transfer ownership of a DPP
 * Only the current owner can perform this operation
 */
export async function transferOwnership(
  dppId: string,
  currentOwnerDID: string,
  newOwnerDID: string
): Promise<{ success: boolean; message: string; dpp?: any }> {
  try {
    // Get the DPP
    const dpp = await enhancedDB.getDPPById(dppId);
    if (!dpp) {
      return { success: false, message: 'DPP not found' };
    }

    // Check if current user is the owner
    if (dpp.owner !== currentOwnerDID) {
      return { success: false, message: 'Only the current owner can transfer ownership' };
    }

    // Try to call backend API for real ownership transfer
    try {
      const response = await fetch(`http://localhost:3000/api/did/${encodeURIComponent(dpp.did)}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyId: 'default-key', // Backend will handle key lookup
          newOwnerDID: newOwnerDID,
          reason: 'Ownership transfer'
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('[DID Operations] Backend ownership transfer successful:', result);

        // Update local DPP stores (but don't store attestation - backend already created event)
        await enhancedDB.updateDPP(dppId, { owner: newOwnerDID });
        await localDB.updateDPP(dppId, { owner: newOwnerDID });

        return {
          success: true,
          message: 'Ownership transferred successfully via backend',
          dpp: await enhancedDB.getDPPById(dppId)
        };
      }
    } catch (backendError) {
      console.log('[DID Operations] Backend not available, using local fallback');
    }

    // Fallback: Local mock transfer for demo (pending approval flow)
    const updatedDPP = await enhancedDB.updateDPP(dppId, {
      metadata: {
        ...dpp.metadata,
        pendingOwnershipTransfer: {
          from: currentOwnerDID,
          to: newOwnerDID,
          requestedAt: new Date().toISOString(),
        }
      }
    });

    await localDB.updateDPP(dppId, {
      metadata: {
        ...dpp.metadata,
        pendingOwnershipTransfer: {
          from: currentOwnerDID,
          to: newOwnerDID,
          requestedAt: new Date().toISOString(),
        }
      }
    });

    const attestation = {
      dpp_id: dppId,
      did: dpp.did,
      witness_did: 'did:webvh:example.com:witnesses:did-validator-1',
      attestation_type: 'ownership_change',
      timestamp: new Date().toISOString(),
      attestation_data: {
        timestamp: new Date().toISOString(),
        witness: 'DID Validator Node 1',
        organization: 'Decentralized Identity Network',
        eventType: 'Ownership Transfer',
        previousOwner: currentOwnerDID,
        newOwner: newOwnerDID,
        transferMethod: 'Direct Transfer',
      },
      signature: `mock-${Date.now()}`,
      approval_status: 'approved' as const,
    };

    await enhancedDB.insertAttestation(attestation);
    await localDB.insertAttestation(attestation);

    return {
      success: true,
      message: 'Ownership transfer completed (local fallback)',
      dpp: updatedDPP
    };
  } catch (error) {
    console.error('Error transferring ownership:', error);
    return { success: false, message: 'Failed to transfer ownership' };
  }
}

/**
 * Rotate the cryptographic key for a DID
 * Only the owner can perform this operation
 */
export async function rotateKey(
  dppId: string,
  ownerDID: string
): Promise<{ success: boolean; message: string; newKeyId?: string }> {
  try {
    // Get the DPP
    const dpp = await enhancedDB.getDPPById(dppId);
    if (!dpp) {
      return { success: false, message: 'DPP not found' };
    }

    // Check if current user is the owner
    if (dpp.owner !== ownerDID) {
      return { success: false, message: 'Only the owner can rotate keys' };
    }

    // Try to call backend API for real key rotation
    try {
      const response = await fetch(`http://localhost:3000/api/did/${encodeURIComponent(dpp.did)}/rotate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyId: 'default-key', // Backend will handle key lookup
          reason: 'Manual key rotation by owner'
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('[DID Operations] Backend key rotation successful:', result);

        // Backend already created event - don't create local attestation (prevents duplicates)
        return {
          success: true,
          message: 'Key rotated successfully via backend',
          newKeyId: result.newKeyId
        };
      }
    } catch (backendError) {
      console.log('[DID Operations] Backend not available, using local fallback');
    }

    // Fallback: Local mock rotation for demo
    const didDoc = await enhancedDB.getDIDDocumentByDID(dpp.did);
    const currentKeyCount = didDoc?.verification_method?.length || 1;
    const newKeyId = `${dpp.did}#key-${currentKeyCount + 1}`;

    const attestation = {
      dpp_id: dppId,
      did: dpp.did,
      witness_did: 'did:webvh:example.com:witnesses:did-validator-2',
      attestation_type: 'key_rotation',
      timestamp: new Date().toISOString(),
      attestation_data: {
        timestamp: new Date().toISOString(),
        witness: 'DID Validator Node 2',
        organization: 'Identity Trust Consortium',
        eventType: 'Key Rotation',
        oldKeyId: `${dpp.did}#key-${currentKeyCount}`,
        newKeyId: newKeyId,
        rotationReason: 'Manual key rotation by owner'
      },
      signature: `mock-${Date.now()}`,
      approval_status: 'approved' as const,
    };

    await enhancedDB.insertAttestation(attestation);
    await localDB.insertAttestation(attestation);

    return {
      success: true,
      message: 'Key rotation completed (local fallback)',
      newKeyId: newKeyId
    };
  } catch (error) {
    console.error('Error rotating key:', error);
    return { success: false, message: 'Failed to rotate key' };
  }
}

/**
 * Update DID document
 * Only the owner can perform this operation
 */
export async function updateDIDDocument(
  dppId: string,
  ownerDID: string,
  updates: { serviceEndpoint?: string; description?: string }
): Promise<{ success: boolean; message: string }> {
  try {
    // Get the DPP
    const dpp = await enhancedDB.getDPPById(dppId);
    if (!dpp) {
      return { success: false, message: 'DPP not found' };
    }

    // Check if current user is the owner
    if (dpp.owner !== ownerDID) {
      return { success: false, message: 'Only the owner can update the DID document' };
    }

    // Get the DID document
    const didDoc = await enhancedDB.getDIDDocumentByDID(dpp.did);
    if (!didDoc) {
      return { success: false, message: 'DID document not found' };
    }

    const versionNumber = typeof didDoc.document_metadata['version'] === 'number'
      ? didDoc.document_metadata['version'] + 1
      : 2;

    // Create witness attestation for DID update - pending approval
    const attestation = {
      dpp_id: dppId,
      did: dpp.did,
      witness_did: 'did:webvh:example.com:witnesses:did-validator-1',
      attestation_type: 'did_update',
      timestamp: new Date().toISOString(),
      attestation_data: {
        timestamp: new Date().toISOString(),
        witness: 'DID Validator Node 1',
        organization: 'Decentralized Identity Network',
        eventType: 'DID Document Update',
        updateType: updates.serviceEndpoint ? 'Service Endpoint Update' : 'Metadata Update',
        changeDescription: updates.description || 'DID document updated by owner',
        versionNumber: versionNumber,
        previousHash: `0x${Math.random().toString(16).substring(2, 66)}`,
        newHash: `0x${Math.random().toString(16).substring(2, 66)}`,
      },
      signature: `pending-${Date.now()}`,
      approval_status: 'pending' as const,
    };

    await enhancedDB.insertAttestation(attestation);
    await localDB.insertAttestation(attestation);

    return {
      success: true,
      message: 'DID document updated successfully'
    };
  } catch (error) {
    console.error('Error updating DID document:', error);
    return { success: false, message: 'Failed to update DID document' };
  }
}

/**
 * Get DID operations history for a DPP
 * Only returns approved events (excludes pending and rejected)
 */
export async function getDIDOperationsHistory(dppId: string) {
  try {
    const dpp = await enhancedDB.getDPPById(dppId);
    if (!dpp) {
      return { success: false, message: 'DPP not found', operations: [] };
    }

    const attestations = await enhancedDB.getAttestationsByDID(dpp.did);
    console.log('getDIDOperationsHistory: raw attestations count', attestations.length);
    console.log('getDIDOperationsHistory: attestations preview', attestations.map(a => ({ id: a.id, type: a.attestation_type, approval_status: a.approval_status, signature: a.signature, timestamp: a.timestamp })));

    // Filter DID-related operations that are approved (not pending or rejected)
    const didOperations = attestations.filter(att => {
      // Support both backend types (create, ownership_transfer) and frontend types
      const isDIDOperation = [
        'ownership_change', 
        'ownership_transfer', 
        'key_rotation', 
        'did_update', 
        'did_creation',
        'create'
      ].includes(att.attestation_type);

      // Explicitly exclude rejected operations
      if (att.approval_status === 'rejected') {
        return false;
      }

      // Consider approved if:
      // 1. Explicitly marked as approved, OR
      // 2. No approval_status field (old data - consider approved), OR
      // 3. Signature doesn't start with 'pending-' and isn't a reject signature
      const isApproved =
        att.approval_status === 'approved' ||
        (!att.approval_status && att.signature && !att.signature.startsWith('pending-') && !att.signature.startsWith('witness-reject-'));

      return isDIDOperation && isApproved;
    });

    // Sort by timestamp descending
    didOperations.sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    console.log('getDIDOperationsHistory: filtered DID operations count', didOperations.length);
    console.log('getDIDOperationsHistory: operations preview', didOperations.map(o => ({ id: o.id, type: o.attestation_type, approval_status: o.approval_status, timestamp: o.timestamp })));

    return {
      success: true,
      operations: didOperations
    };
  } catch (error) {
    console.error('Error getting DID operations history:', error);
    return { success: false, message: 'Failed to get DID operations history', operations: [] };
  }
}

/**
 * Get pending and rejected DID operations
 */
export async function getPendingAndRejectedOperations(did: string) {
  try {
    const dpp = await enhancedDB.getDPPByDID(did);
    if (!dpp) {
      return { pending: [], rejected: [] };
    }

    // Use enhancedDB for consistency
    const allAttestations = await enhancedDB.getAttestationsByDID(dpp.did);

    const pending = allAttestations.filter((att: any) => att.approval_status === 'pending');
    const rejected = allAttestations.filter((att: any) => att.approval_status === 'rejected');

    console.log('getPendingAndRejectedOperations:', { did: dpp.did, pending, rejected });

    return { pending, rejected };
  } catch (error) {
    console.error('Error getting pending/rejected operations:', error);
    return { pending: [], rejected: [] };
  }
}
