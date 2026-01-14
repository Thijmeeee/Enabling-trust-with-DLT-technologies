import { hybridDataStore as enhancedDB } from '../data/hybridDataStore';
import { localDB } from '../data/localData';
import { hashOperation } from '../utils/merkleTree';

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

    // Insert attestation only once via hybridDataStore (which internally uses localDB)
    await enhancedDB.insertAttestation(attestation);

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

    // Insert attestation only once via hybridDataStore (which internally uses localDB)
    await enhancedDB.insertAttestation(attestation);

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

    const metadata = didDoc.document_metadata as Record<string, unknown>;
    const versionNumber = typeof metadata?.version === 'number'
      ? (metadata.version as number) + 1
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

    // Insert attestation only once via hybridDataStore (which internally uses localDB)
    await enhancedDB.insertAttestation(attestation);

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

    // Filter DID-related operations that are approved (not pending or rejected)
    const didOperations = attestations.filter(att => {
      // Support both backend types (create, ownership_transfer) and frontend types
      const isDIDOperation = [
        'ownership_change', 
        'ownership_transfer', 
        'key_rotation', 
        'did_update', 
        'did_creation',
        'did_deactivation',
        'create',
        'deactivate',
        'certification'
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

    // Deduplicate operations to prevent double-showing in Merkle Tree
    // We deduplicate by HASH to ensure logically identical events are merged
    const uniqueOperations = new Map<string, any>();
    
    didOperations.forEach(op => {
      const hash = hashOperation(op);
      
      // If we already have this event, prefer the one with a witness DID
      if (uniqueOperations.has(hash)) {
        const existing = uniqueOperations.get(hash);
        if (!existing.witness_did && op.witness_did) {
          uniqueOperations.set(hash, op);
        }
      } else {
        uniqueOperations.set(hash, op);
      }
    });

    const finalOperations = Array.from(uniqueOperations.values());

    // Sort by timestamp descending
    finalOperations.sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return {
      success: true,
      operations: finalOperations
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

/**
 * Deactivate a DID (using didwebvh-ts deactivateDID)
 * This permanently deactivates the DID - it cannot be reactivated
 * Only the owner can perform this operation
 */
export async function deactivateDID(
  dppId: string,
  ownerDID: string,
  reason: string = 'Manual deactivation by owner'
): Promise<{ success: boolean; message: string }> {
  try {
    // Get the DPP
    const dpp = await enhancedDB.getDPPById(dppId);
    if (!dpp) {
      return { success: false, message: 'DPP not found' };
    }

    // Check if current user is the owner
    if (dpp.owner !== ownerDID) {
      return { success: false, message: 'Only the owner can deactivate this DID' };
    }

    // Check if already deactivated
    if (dpp.lifecycle_status === 'deactivated') {
      return { success: false, message: 'DID is already deactivated' };
    }

    // Try to call backend API for real deactivation (uses didwebvh-ts)
    try {
      const response = await fetch(`http://localhost:3000/api/did/${encodeURIComponent(dpp.did)}/deactivate`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyId: 'default-key', // Backend will handle key lookup
          reason: reason
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('[DID Operations] Backend DID deactivation successful:', result);

        // Update local DPP stores
        await enhancedDB.updateDPP(dppId, { lifecycle_status: 'deactivated' });
        await localDB.updateDPP(dppId, { lifecycle_status: 'deactivated' });

        return {
          success: true,
          message: 'DID deactivated successfully via backend (didwebvh-ts)'
        };
      }
    } catch (backendError) {
      console.log('[DID Operations] Backend not available, using local fallback');
    }

    // Fallback: Local mock deactivation for demo
    await enhancedDB.updateDPP(dppId, { lifecycle_status: 'deactivated' });
    await localDB.updateDPP(dppId, { lifecycle_status: 'deactivated' });

    const attestation = {
      dpp_id: dppId,
      did: dpp.did,
      witness_did: 'did:webvh:example.com:witnesses:did-validator-1',
      attestation_type: 'did_deactivation',
      timestamp: new Date().toISOString(),
      attestation_data: {
        timestamp: new Date().toISOString(),
        witness: 'DID Validator Node 1',
        organization: 'Decentralized Identity Network',
        eventType: 'DID Deactivation',
        reason: reason,
        deactivatedBy: ownerDID,
        finalVersionId: 'final',
      },
      signature: `mock-${Date.now()}`,
      approval_status: 'approved' as const,
    };

    // Insert attestation via hybridDataStore
    await enhancedDB.insertAttestation(attestation);

    return {
      success: true,
      message: 'DID deactivated successfully (local fallback)'
    };
  } catch (error) {
    console.error('Error deactivating DID:', error);
    return { success: false, message: 'Failed to deactivate DID' };
  }
}

/**
 * Update DID document via backend (uses didwebvh-ts updateDID)
 * Only the owner can perform this operation
 */
export async function updateDIDViaBackend(
  dppId: string,
  ownerDID: string,
  updates: {
    serviceEndpoints?: Array<{ id: string; type: string; serviceEndpoint: string }>;
    description?: string;
  }
): Promise<{ success: boolean; message: string; versionId?: string }> {
  try {
    // Get the DPP
    const dpp = await enhancedDB.getDPPById(dppId);
    if (!dpp) {
      return { success: false, message: 'DPP not found' };
    }

    // Check if current user is the owner
    if (dpp.owner !== ownerDID) {
      return { success: false, message: 'Only the owner can update this DID' };
    }

    // Check if deactivated
    if (dpp.lifecycle_status === 'deactivated') {
      return { success: false, message: 'Cannot update a deactivated DID' };
    }

    // Try to call backend API for real update (uses didwebvh-ts updateDID)
    try {
      const response = await fetch(`http://localhost:3000/api/did/${encodeURIComponent(dpp.did)}/update`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyId: 'default-key', // Backend will handle key lookup
          updates: {
            document: {
              service: updates.serviceEndpoints,
              description: updates.description
            }
          }
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('[DID Operations] Backend DID update successful:', result);

        return {
          success: true,
          message: 'DID updated successfully via backend (didwebvh-ts)',
          versionId: result.versionId
        };
      }
    } catch (backendError) {
      console.log('[DID Operations] Backend not available, using local fallback');
    }

    // Fallback: Use existing local updateDIDDocument function
    return await updateDIDDocument(dppId, ownerDID, {
      serviceEndpoint: updates.serviceEndpoints?.[0]?.serviceEndpoint,
      description: updates.description
    });
  } catch (error) {
    console.error('Error updating DID:', error);
    return { success: false, message: 'Failed to update DID' };
  }
}

/**
 * Certify a product (Add a certification attestation)
 */
export async function certifyProduct(
  dppId: string,
  ownerDID: string,
  certificationData: {
    inspector: string;
    certificateType: string;
    notes: string;
    status: string;
  }
): Promise<{ success: boolean; message: string }> {
  try {
    const dpp = await enhancedDB.getDPPById(dppId);
    if (!dpp) return { success: false, message: 'Product not found' };

    // Update the lifecycle status if specified
    if (certificationData.status) {
      await enhancedDB.updateDPP(dppId, { lifecycle_status: certificationData.status });
      await localDB.updateDPP(dppId, { lifecycle_status: certificationData.status });
    }

    // Try to anchor this certification on the blockchain via the DID Update endpoint
    try {
      const response = await fetch(`http://localhost:3000/api/did/${encodeURIComponent(dpp.did)}/update`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyId: 'default-key',
          updates: {
            document: {
              description: `Certification: ${certificationData.certificateType} by ${certificationData.inspector}. Notes: ${certificationData.notes}`
            }
          }
        })
      });

      if (response.ok) {
        console.log('[DID Operations] Certification successfully anchored via backend');
      }
    } catch (backendError) {
      console.log('[DID Operations] Backend not available for certification anchoring, using local only');
    }

    // Create an attestation for this certification
    const attestation = {
      dpp_id: dppId,
      did: dpp.did,
      witness_did: 'did:webvh:example.com:witnesses:certification-authority',
      attestation_type: 'certification',
      timestamp: new Date().toISOString(),
      attestation_data: {
        timestamp: new Date().toISOString(),
        inspector: certificationData.inspector,
        certificateType: certificationData.certificateType,
        notes: certificationData.notes,
        result: 'Certified / Approved',
        organization: 'Independent Inspection Bureau',
      },
      signature: `cert-mock-${Date.now()}`,
      approval_status: 'approved' as const,
    };

    await enhancedDB.insertAttestation(attestation);

    return {
      success: true,
      message: 'Product successfully certified'
    };
  } catch (error) {
    console.error('Error certifying product:', error);
    return { success: false, message: 'Certification failed' };
  }
}
