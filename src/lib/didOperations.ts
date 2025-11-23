import { localDB } from './localData';
import { enhancedDB } from './enhancedDataStore';
import type { DIDDocument, DPP } from './localData';

/**
 * DID:webvh Operations for DPP Management
 * Implements Create, Read, Update, and Deactivate operations
 */

interface CreateDIDOptions {
  owner: string;
  controller?: string;
  productType: 'main' | 'component';
  model: string;
  metadata?: Record<string, any>;
  parentDid?: string;
}

interface UpdateDIDOptions {
  controller?: string;
  custodian?: string;
  metadata?: Record<string, any>;
  lifecycleStatus?: 'active' | 'installed' | 'maintenance' | 'disposed';
  addVerificationMethod?: {
    id: string;
    type: string;
    controller: string;
    publicKeyMultibase: string;
  };
}

/**
 * CREATE: Generate a new DID:webvh and associated DPP
 */
export async function createDID(options: CreateDIDOptions): Promise<{
  did: string;
  dpp: DPP;
  didDocument: DIDDocument;
}> {
  const timestamp = new Date().toISOString();
  
  // Generate unique DID
  const didIdentifier = `${options.productType}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const did = `did:webvh:example.com:${didIdentifier}`;

  // Create DPP entry
  const dpp = await localDB.insertDPP({
    did,
    type: options.productType,
    model: options.model,
    owner: options.owner,
    custodian: null,
    lifecycle_status: 'active',
    metadata: options.metadata || {},
    parent_did: options.parentDid || null,
    version: 1,
    previous_version_id: null,
  });

  // Also insert into enhancedDB
  await enhancedDB.insertDPP({
    did,
    type: options.productType,
    model: options.model,
    owner: options.owner,
    custodian: null,
    lifecycle_status: 'active',
    metadata: options.metadata || {},
    parent_did: options.parentDid || null,
    version: 1,
    previous_version_id: null,
  });

  // Create DID Document with verification method
  const verificationMethodId = `${did}#key-1`;
  const didDocument = await localDB.insertDIDDocument({
    dpp_id: dpp.id,
    did,
    controller: options.controller || options.owner,
    verification_method: [
      {
        id: verificationMethodId,
        type: 'Ed25519VerificationKey2020',
        controller: options.controller || options.owner,
        publicKeyMultibase: `z${Math.random().toString(36).substr(2, 43)}`, // Mock public key
      },
    ],
    service_endpoints: [
      {
        id: `${did}#dpp-service`,
        type: 'DigitalProductPassport',
        serviceEndpoint: `https://example.com/api/dpps/${dpp.id}`,
      },
    ],
    proof: {
      type: 'Ed25519Signature2020',
      created: timestamp,
      verificationMethod: verificationMethodId,
      proofPurpose: 'assertionMethod',
      proofValue: `z${Math.random().toString(36).substr(2, 86)}`, // Mock signature
    },
    document_metadata: {
      created: timestamp,
      purpose: 'DPP Authentication',
    },
  });

  // Also insert into enhancedDB
  await enhancedDB.insertDIDDocument({
    dpp_id: dpp.id,
    did,
    controller: options.controller || options.owner,
    verification_method: didDocument.verification_method,
    service_endpoints: didDocument.service_endpoints,
    proof: didDocument.proof,
    document_metadata: didDocument.document_metadata,
  });

  console.log(`✅ DID Created: ${did}`);
  
  return { did, dpp, didDocument };
}

/**
 * READ: Resolve a DID and get complete information
 */
export async function readDID(did: string): Promise<{
  dpp: DPP | null;
  didDocument: DIDDocument | null;
  metadata: {
    isActive: boolean;
    owner: string | null;
    custodian: string | null;
    lifecycle: string | null;
    hasParent: boolean;
    childCount: number;
  };
} | null> {
  // Try enhancedDB first, fallback to localDB
  let dpp = await enhancedDB.getDPPByDID(did);
  if (!dpp) {
    dpp = await localDB.getDPPByDID(did);
  }

  let didDocument = await enhancedDB.getDIDDocumentByDID(did);
  if (!didDocument) {
    didDocument = await localDB.getDIDDocumentByDID(did);
  }

  if (!dpp) {
    console.warn(`❌ DID not found: ${did}`);
    return null;
  }

  // Get relationships
  const childRelations = await localDB.getRelationshipsByParent(did);

  const metadata = {
    isActive: dpp.lifecycle_status !== 'disposed',
    owner: dpp.owner,
    custodian: dpp.custodian,
    lifecycle: dpp.lifecycle_status,
    hasParent: !!dpp.parent_did,
    childCount: childRelations.length,
  };

  console.log(`✅ DID Resolved: ${did} (${metadata.lifecycle})`);

  return { dpp, didDocument, metadata };
}

/**
 * UPDATE: Modify DID Document or DPP metadata
 */
export async function updateDID(did: string, updates: UpdateDIDOptions): Promise<{
  dpp: DPP | null;
  didDocument: DIDDocument | null;
} | null> {
  // Get existing data
  let dpp = await localDB.getDPPByDID(did);
  if (!dpp) {
    dpp = await enhancedDB.getDPPByDID(did);
  }

  let didDocument = await localDB.getDIDDocumentByDID(did);
  if (!didDocument) {
    didDocument = await enhancedDB.getDIDDocumentByDID(did);
  }

  if (!dpp) {
    console.warn(`❌ Cannot update - DID not found: ${did}`);
    return null;
  }

  // Update DPP
  const dppUpdates: Partial<DPP> = {};
  if (updates.custodian !== undefined) dppUpdates.custodian = updates.custodian;
  if (updates.metadata) dppUpdates.metadata = { ...dpp.metadata, ...updates.metadata };
  if (updates.lifecycleStatus) dppUpdates.lifecycle_status = updates.lifecycleStatus;

  const updatedDPP = await localDB.updateDPP(dpp.id, dppUpdates);
  
  // Note: enhancedDB is a cache and will be updated on next query

  // Update DID Document if needed
  let updatedDidDoc = didDocument;
  if (didDocument && (updates.controller || updates.addVerificationMethod)) {
    // Note: DID Document updates would require implementing updateDIDDocument in localDB
    // For now, controller and verification method updates are not supported
    console.warn('DID Document updates not yet implemented');
  }

  console.log(`✅ DID Updated: ${did}`);

  return { dpp: updatedDPP, didDocument: updatedDidDoc };
}

/**
 * DEACTIVATE: Mark a DID as deactivated (end-of-life)
 */
export async function deactivateDID(did: string, reason?: string): Promise<{
  success: boolean;
  dpp: DPP | null;
}> {
  let dpp = await localDB.getDPPByDID(did);
  if (!dpp) {
    dpp = await enhancedDB.getDPPByDID(did);
  }

  if (!dpp) {
    console.warn(`❌ Cannot deactivate - DID not found: ${did}`);
    return { success: false, dpp: null };
  }

  // Update lifecycle status to disposed
  const deactivationMetadata = {
    ...dpp.metadata,
    deactivated_at: new Date().toISOString(),
    deactivation_reason: reason || 'End of life',
  };

  const updatedDPP = await localDB.updateDPP(dpp.id, {
    lifecycle_status: 'disposed',
    metadata: deactivationMetadata,
  });

  // Create lifecycle event
  await localDB.insertAnchoringEvent({
    dpp_id: dpp.id,
    did,
    anchor_type: 'deactivation',
    block_number: Math.floor(Math.random() * 1000000),
    transaction_hash: `0x${Math.random().toString(16).substr(2, 64)}`,
    merkle_root: null,
    component_hashes: {},
    metadata: {
      reason: reason || 'End of life',
      deactivated_at: new Date().toISOString(),
    },
  });

  await enhancedDB.insertAnchoringEvent({
    dpp_id: dpp.id,
    did,
    anchor_type: 'deactivation',
    block_number: Math.floor(Math.random() * 1000000),
    transaction_hash: `0x${Math.random().toString(16).substr(2, 64)}`,
    merkle_root: null,
    component_hashes: {},
    metadata: {
      reason: reason || 'End of life',
      deactivated_at: new Date().toISOString(),
    },
  });

  console.log(`✅ DID Deactivated: ${did}${reason ? ` (${reason})` : ''}`);

  return { success: true, dpp: updatedDPP };
}

/**
 * TRANSFER OWNERSHIP: Update owner and create transfer event
 */
export async function transferOwnership(
  did: string,
  newOwner: string,
  transferredBy: string
): Promise<{ success: boolean; dpp: DPP | null }> {
  const result = await updateDID(did, {
    metadata: {
      previous_owner: (await readDID(did))?.dpp?.owner,
      ownership_transferred_at: new Date().toISOString(),
      transferred_by: transferredBy,
    },
  });

  if (!result?.dpp) {
    return { success: false, dpp: null };
  }

  // Update owner field
  const dpp = await localDB.getDPPByDID(did);
  if (dpp) {
    await localDB.updateDPP(dpp.id, { owner: newOwner });
  }

  // Create ownership transfer event
  const transferDPP = await localDB.getDPPByDID(did);
  if (transferDPP) {
    await localDB.insertAnchoringEvent({
      dpp_id: transferDPP.id,
      did,
      anchor_type: 'ownership_transfer',
      block_number: Math.floor(Math.random() * 1000000),
      transaction_hash: `0x${Math.random().toString(16).substr(2, 64)}`,
      merkle_root: null,
      component_hashes: {},
      metadata: {
        previous_owner: result.dpp.owner,
        new_owner: newOwner,
        transferred_by: transferredBy,
        timestamp: new Date().toISOString(),
      },
    });

    await enhancedDB.insertAnchoringEvent({
      dpp_id: transferDPP.id,
      did,
      anchor_type: 'ownership_transfer',
      block_number: Math.floor(Math.random() * 1000000),
      transaction_hash: `0x${Math.random().toString(16).substr(2, 64)}`,
      merkle_root: null,
      component_hashes: {},
      metadata: {
        previous_owner: result.dpp.owner,
        new_owner: newOwner,
        transferred_by: transferredBy,
        timestamp: new Date().toISOString(),
      },
    });
  }

  console.log(`✅ Ownership Transferred: ${did} → ${newOwner}`);

  const updatedDPP = await localDB.getDPPByDID(did);
  return { success: true, dpp: updatedDPP };
}

/**
 * TRANSFER CUSTODY: Update custodian (not owner)
 */
export async function transferCustody(
  did: string,
  newCustodian: string,
  transferredBy: string
): Promise<{ success: boolean; dpp: DPP | null }> {
  const result = await updateDID(did, {
    custodian: newCustodian,
    metadata: {
      previous_custodian: (await readDID(did))?.dpp?.custodian,
      custody_transferred_at: new Date().toISOString(),
      custody_transferred_by: transferredBy,
    },
  });

  if (!result?.dpp) {
    return { success: false, dpp: null };
  }

  // Create custody transfer event
  const custodyDPP = await localDB.getDPPByDID(did);
  if (custodyDPP) {
    await localDB.insertAnchoringEvent({
      dpp_id: custodyDPP.id,
      did,
      anchor_type: 'custody_transfer',
      block_number: Math.floor(Math.random() * 1000000),
      transaction_hash: `0x${Math.random().toString(16).substr(2, 64)}`,
      merkle_root: null,
      component_hashes: {},
      metadata: {
        previous_custodian: result.dpp.custodian,
        new_custodian: newCustodian,
        transferred_by: transferredBy,
        timestamp: new Date().toISOString(),
      },
    });

    await enhancedDB.insertAnchoringEvent({
      dpp_id: custodyDPP.id,
      did,
      anchor_type: 'custody_transfer',
      block_number: Math.floor(Math.random() * 1000000),
      transaction_hash: `0x${Math.random().toString(16).substr(2, 64)}`,
      merkle_root: null,
      component_hashes: {},
      metadata: {
        previous_custodian: result.dpp.custodian,
        new_custodian: newCustodian,
        transferred_by: transferredBy,
        timestamp: new Date().toISOString(),
      },
    });
  }

  console.log(`✅ Custody Transferred: ${did} → ${newCustodian}`);

  return { success: true, dpp: result.dpp };
}
