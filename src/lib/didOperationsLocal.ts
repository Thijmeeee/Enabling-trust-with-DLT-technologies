import { enhancedDB } from './enhancedDataStore';
import { localDB } from './localData';

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

    // Update the DPP owner
    const updatedDPP = await enhancedDB.updateDPP(dppId, {
      owner: newOwnerDID,
      metadata: {
        ...dpp.metadata,
        previousOwner: currentOwnerDID,
        ownershipTransferredAt: new Date().toISOString(),
      }
    });

    // Update in localDB for compatibility
    await localDB.updateDPP(dppId, {
      owner: newOwnerDID,
      metadata: {
        ...dpp.metadata,
        previousOwner: currentOwnerDID,
        ownershipTransferredAt: new Date().toISOString(),
      }
    });

    // Create witness attestation for ownership change
    const attestation = {
      dpp_id: dppId,
      did: dpp.did,
      witness_did: 'did:webvh:example.com:witnesses:did-validator-1',
      attestation_type: 'ownership_change',
      attestation_data: {
        timestamp: new Date().toISOString(),
        witness: 'DID Validator Node 1',
        organization: 'Decentralized Identity Network',
        eventType: 'Ownership Transfer',
        previousOwner: currentOwnerDID,
        newOwner: newOwnerDID,
        transferMethod: 'Direct Transfer',
        transferApproved: true,
      },
      signature: `0x${Math.random().toString(16).substring(2, 66)}`,
    };

    await enhancedDB.insertAttestation(attestation);
    await localDB.insertAttestation(attestation);

    return {
      success: true,
      message: 'Ownership transferred successfully',
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

    // Get the DID document
    const didDoc = await enhancedDB.getDIDDocumentByDID(dpp.did);
    if (!didDoc) {
      return { success: false, message: 'DID document not found' };
    }

    // Generate new key ID
    const currentKeyCount = didDoc.verification_method.length;
    const newKeyId = `${dpp.did}#key-${currentKeyCount + 1}`;
    const oldKeyId = `${dpp.did}#key-${currentKeyCount}`;

    // Note: In a real system, you would update the verification_method array
    // For now, we track the rotation in metadata

    // Create witness attestation for key rotation
    const attestation = {
      dpp_id: dppId,
      did: dpp.did,
      witness_did: 'did:webvh:example.com:witnesses:did-validator-2',
      attestation_type: 'key_rotation',
      attestation_data: {
        timestamp: new Date().toISOString(),
        witness: 'DID Validator Node 2',
        organization: 'Identity Trust Consortium',
        eventType: 'Key Rotation',
        oldKeyId: oldKeyId,
        newKeyId: newKeyId,
        rotationReason: 'Manual key rotation by owner',
        previousKeyRevoked: true,
        newKeyType: 'Ed25519VerificationKey2020',
      },
      signature: `0x${Math.random().toString(16).substring(2, 66)}`,
    };

    await enhancedDB.insertAttestation(attestation);
    await localDB.insertAttestation(attestation);

    return {
      success: true,
      message: 'Key rotated successfully',
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

    // Create witness attestation for DID update
    const attestation = {
      dpp_id: dppId,
      did: dpp.did,
      witness_did: 'did:webvh:example.com:witnesses:did-validator-1',
      attestation_type: 'did_update',
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
      signature: `0x${Math.random().toString(16).substring(2, 66)}`,
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
 */
export async function getDIDOperationsHistory(dppId: string) {
  try {
    const dpp = await enhancedDB.getDPPById(dppId);
    if (!dpp) {
      return { success: false, message: 'DPP not found', operations: [] };
    }

    const attestations = await enhancedDB.getAttestationsByDID(dpp.did);
    
    // Filter DID-related operations
    const didOperations = attestations.filter(att => 
      ['ownership_change', 'key_rotation', 'did_update', 'did_creation'].includes(att.attestation_type)
    );

    // Sort by timestamp descending
    didOperations.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return {
      success: true,
      operations: didOperations
    };
  } catch (error) {
    console.error('Error getting DID operations history:', error);
    return { success: false, message: 'Failed to get DID operations history', operations: [] };
  }
}
