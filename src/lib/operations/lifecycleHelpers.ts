import { hybridDataStore } from '../data/hybridDataStore';


/**
 * Generate realistic witness attestations for DID events
 * Witnesses monitor and attest to DID operations, not product events
 */
export async function generateWitnessAttestations(dppId: string, did: string, dppType: 'main' | 'component') {
  const witnesses = [
    {
      did: 'did:webvh:example.com:witnesses:did-validator-1',
      name: 'DID Validator Node 1',
      org: 'Decentralized Identity Network',
    },
    {
      did: 'did:webvh:example.com:witnesses:did-validator-2',
      name: 'DID Validator Node 2',
      org: 'Identity Trust Consortium',
    },
    {
      did: 'did:webvh:example.com:witnesses:did-validator-3',
      name: 'DID Validator Node 3',
      org: 'Blockchain Verification Service',
    },
  ];

  const now = Date.now();
  const attestations = [];

  // DID Creation/Registration attestation (always)
  attestations.push({
    dpp_id: dppId,
    did: did,
    witness_did: witnesses[0].did,
    attestation_type: 'did_creation',
    attestation_data: {
      timestamp: new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString(),
      witness: witnesses[0].name,
      organization: witnesses[0].org,
      eventType: 'DID Creation',
      method: 'did:webvh',
      controller: did,
      notes: 'DID document created and registered on decentralized network',
      verificationMethodsCount: 1,
      initialProofType: 'Ed25519Signature2020',
    },
    signature: `witness-sig-${Math.random().toString(16).substring(2, 18)}`,
    approval_status: 'approved' as const,
  });

  // Key Rotation attestation (70% chance)
  if (Math.random() > 0.3) {
    attestations.push({
      dpp_id: dppId,
      did: did,
      witness_did: witnesses[1].did,
      attestation_type: 'key_rotation',
      attestation_data: {
        timestamp: new Date(now - 4 * 24 * 60 * 60 * 1000).toISOString(),
        witness: witnesses[1].name,
        organization: witnesses[1].org,
        eventType: 'Key Rotation',
        oldKeyId: `${did}#key-1`,
        newKeyId: `${did}#key-2`,
        rotationReason: 'Scheduled security rotation',
        previousKeyRevoked: true,
        newKeyType: 'Ed25519VerificationKey2020',
      },
      signature: `witness-sig-${Math.random().toString(16).substring(2, 18)}`,
      approval_status: 'approved' as const,
    });
  }

  // Ownership Change attestation (for components and some main products)
  if (dppType === 'component' || Math.random() > 0.6) {
    attestations.push({
      dpp_id: dppId,
      did: did,
      witness_did: witnesses[2].did,
      attestation_type: 'ownership_change',
      attestation_data: {
        timestamp: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(),
        witness: witnesses[2].name,
        organization: witnesses[2].org,
        eventType: 'Ownership Transfer',
        previousOwner: 'did:webvh:example.com:organizations:original-owner',
        newOwner: 'did:webvh:example.com:organizations:current-owner',
        transferMethod: 'Smart Contract',
        blockchainTxHash: `0x${Math.random().toString(16).substring(2, 66)}`,
        transferApproved: true,
      },
      signature: `witness-sig-${Math.random().toString(16).substring(2, 18)}`,
      approval_status: 'approved' as const,
    });
  }

  // DID Document Update attestation (60% chance)
  if (Math.random() > 0.4) {
    attestations.push({
      dpp_id: dppId,
      did: did,
      witness_did: witnesses[0].did,
      attestation_type: 'did_update',
      attestation_data: {
        timestamp: new Date(now - 1 * 24 * 60 * 60 * 1000).toISOString(),
        witness: witnesses[0].name,
        organization: witnesses[0].org,
        eventType: 'DID Document Update',
        updateType: 'Service Endpoint Addition',
        changeDescription: 'Added new service endpoint for data access',
        versionNumber: 2,
        previousHash: `0x${Math.random().toString(16).substring(2, 66)}`,
        newHash: `0x${Math.random().toString(16).substring(2, 66)}`,
      },
      signature: `witness-sig-${Math.random().toString(16).substring(2, 18)}`,
      approval_status: 'approved' as const,
    });
  }

  // Insert all attestations to both stores for compatibility
  for (const attestation of attestations) {
    await hybridDataStore.insertAttestation(attestation);
    await hybridDataStore.insertAttestation(attestation);
  }

  return attestations.length;
}

/**
 * Generate blockchain anchoring events
 */
export async function generateAnchoringEvents(dppId: string, did: string, componentDids: string[] = []) {
  const now = Date.now();
  
  // Initial anchoring (when DPP created)
  const initialBlock = 18500000 + Math.floor(Math.random() * 100000);
  const anchorData = {
    dpp_id: dppId,
    did: did,
    transaction_hash: `0x${Math.random().toString(16).substring(2)}${Math.random().toString(16).substring(2)}`,
    block_number: initialBlock,
    merkle_root: `0x${Math.random().toString(16).substring(2, 66)}`,
    component_hashes: componentDids.map(compDid => ({
      did: compDid,
      hash: `0x${Math.random().toString(16).substring(2, 66)}`,
    })),
    anchor_type: 'creation',
    metadata: {
      network: 'ethereum',
      chainId: 1,
      gasUsed: Math.floor(150000 + Math.random() * 50000),
      blockExplorer: `https://etherscan.io/tx/0x${Math.random().toString(16).substring(2, 20)}`,
      createdAt: new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString(),
    },
  };
  await hybridDataStore.insertAnchoringEvent(anchorData);
  await hybridDataStore.insertAnchoringEvent(anchorData);

  // Verification anchoring (2 days after creation)
  if (Math.random() > 0.4) {
    const verificationData = {
      dpp_id: dppId,
      did: did,
      transaction_hash: `0x${Math.random().toString(16).substring(2)}${Math.random().toString(16).substring(2)}`,
      block_number: initialBlock + Math.floor(Math.random() * 1000) + 500,
      merkle_root: `0x${Math.random().toString(16).substring(2, 66)}`,
      component_hashes: [],
      anchor_type: 'verification',
      metadata: {
        network: 'ethereum',
        chainId: 1,
        gasUsed: Math.floor(80000 + Math.random() * 30000),
        verifier: 'did:webvh:example.com:validators:node-1',
        verifiedAt: new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString(),
      },
    };
    await hybridDataStore.insertAnchoringEvent(verificationData);
    await hybridDataStore.insertAnchoringEvent(verificationData);
  }
}

/**
 * Create lifecycle event for window progression
 */
export async function createLifecycleEvent(
  dppId: string,
  did: string,
  eventType: 'assembly' | 'installation' | 'maintenance' | 'disposal',
  details: Record<string, any>
) {
  // This will be stored as an attestation with special type
  const attestationData = {
    dpp_id: dppId,
    did: did,
    witness_did: 'did:webvh:example.com:witnesses:lifecycle-system',
    attestation_type: eventType,
    attestation_data: {
      timestamp: new Date().toISOString(),
      eventType: eventType,
      ...details,
    },
    signature: `0x${Math.random().toString(16).substring(2, 66)}`,
  };
  await hybridDataStore.insertAttestation(attestationData);
  await hybridDataStore.insertAttestation(attestationData);

  // Also create anchoring event for important lifecycle changes
  if (eventType === 'installation' || eventType === 'disposal') {
    const lifecycleAnchorData = {
      dpp_id: dppId,
      did: did,
      transaction_hash: `0x${Math.random().toString(16).substring(2)}${Math.random().toString(16).substring(2)}`,
      block_number: 18500000 + Math.floor(Math.random() * 200000),
      merkle_root: `0x${Math.random().toString(16).substring(2, 66)}`,
      component_hashes: [],
      anchor_type: `lifecycle_${eventType}`,
      metadata: {
        network: 'ethereum',
        chainId: 1,
        eventType: eventType,
        gasUsed: Math.floor(100000 + Math.random() * 50000),
        eventTimestamp: new Date().toISOString(),
      },
    };
    await hybridDataStore.insertAnchoringEvent(lifecycleAnchorData);
    await hybridDataStore.insertAnchoringEvent(lifecycleAnchorData);
  }
}

/**
 * Progress DID lifecycle to next stage
 * Note: Currently just logs the progression. In production, this would update the DID document.
 */
export async function progressDIDLifecycle(did: string, stage: 'registered' | 'verified' | 'anchored') {
  const didDoc = await hybridDataStore.getDIDDocumentByDID(did);
  if (!didDoc) {
    console.warn(`DID document not found for ${did}`);
    return;
  }

  console.log(`Progressing DID ${did} to stage: ${stage}`);
  
  // Log what would be updated
  const updates: Record<string, any> = {
    lifecycleStage: stage,
    lastUpdated: new Date().toISOString(),
  };

  if (stage === 'verified') {
    console.log(`Would add verification method to ${did}`);
  }

  if (stage === 'anchored') {
    console.log(`Would add Merkle proof to ${did}`);
  }

  // In production, you would need to add an update method to LocalDataStore
  // For now, we'll create an attestation to track the lifecycle progression
  const lifecycleAttestationData = {
    dpp_id: didDoc.dpp_id,
    did: did,
    witness_did: 'did:webvh:example.com:system:lifecycle-manager',
    attestation_type: 'did_lifecycle_update',
    attestation_data: {
      previousStage: didDoc.document_metadata['lifecycleStage'] || 'created',
      newStage: stage,
      timestamp: new Date().toISOString(),
      updates: updates,
    },
    signature: `0x${Math.random().toString(16).substring(2, 66)}`,
  };
  await hybridDataStore.insertAttestation(lifecycleAttestationData);
  await hybridDataStore.insertAttestation(lifecycleAttestationData);
}

/**
 * Generate default lifecycle events for a DPP to ensure event log has data
 */
export async function generateDefaultLifecycleEvents(
  dppId: string, 
  did: string, 
  dppType: 'main' | 'component',
  componentCount: number = 0
) {
  const now = Date.now();
  const events: any[] = [];

  // 1. Manufacturing event (always, 10 days ago)
  events.push({
    dpp_id: dppId,
    did: did,
    witness_did: 'did:webvh:example.com:witnesses:manufacturing-system',
    attestation_type: 'manufacturing',
    attestation_data: {
      timestamp: new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString(),
      eventType: 'manufacturing',
      description: dppType === 'main' 
        ? 'Product manufactured and quality tested'
        : 'Component manufactured according to specifications',
      performedBy: 'Manufacturing Operator',
      location: 'Factory Floor A',
      batchNumber: `BATCH-${Math.floor(Math.random() * 10000)}`,
      qualityCheck: 'passed',
    },
    signature: `0x${Math.random().toString(16).substring(2, 66)}`,
  });

  // 2. Assembly event (for main products with components, 7 days ago)
  if (dppType === 'main' && componentCount > 0) {
    events.push({
      dpp_id: dppId,
      did: did,
      witness_did: 'did:webvh:example.com:witnesses:assembly-line',
      attestation_type: 'assembly',
      attestation_data: {
        timestamp: new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString(),
        eventType: 'assembly',
        description: `Product assembled from ${componentCount} components`,
        performedBy: 'Assembly Technician',
        location: 'Assembly Line B',
        componentsAssembled: componentCount,
        assemblyTime: Math.floor(30 + Math.random() * 60), // minutes
      },
      signature: `0x${Math.random().toString(16).substring(2, 66)}`,
    });
  }

  // 3. Installation event (50% chance, 3 days ago)
  if (Math.random() > 0.5 && dppType === 'main') {
    events.push({
      dpp_id: dppId,
      did: did,
      witness_did: 'did:webvh:example.com:witnesses:installation-service',
      attestation_type: 'installation',
      attestation_data: {
        timestamp: new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString(),
        eventType: 'installation',
        description: 'Product installed at customer location',
        performedBy: 'Installation Technician',
        location: 'Customer Site - Building A',
        customerReference: `CUST-${Math.floor(Math.random() * 10000)}`,
        installationConditions: 'Standard installation, no issues',
      },
      signature: `0x${Math.random().toString(16).substring(2, 66)}`,
    });
  }

  // 4. Maintenance event (30% chance, 1 day ago)
  if (Math.random() > 0.7 && dppType === 'main') {
    events.push({
      dpp_id: dppId,
      did: did,
      witness_did: 'did:webvh:example.com:witnesses:maintenance-service',
      attestation_type: 'maintenance',
      attestation_data: {
        timestamp: new Date(now - 1 * 24 * 60 * 60 * 1000).toISOString(),
        eventType: 'maintenance',
        description: 'Routine maintenance inspection performed',
        performedBy: 'Maintenance Engineer',
        location: 'Customer Site',
        findings: 'All components in good condition',
        nextMaintenanceDue: new Date(now + 180 * 24 * 60 * 60 * 1000).toISOString(),
      },
      signature: `0x${Math.random().toString(16).substring(2, 66)}`,
    });
  }

  // Insert all events into both stores
  for (const event of events) {
    await hybridDataStore.insertAttestation(event);
    await hybridDataStore.insertAttestation(event);
  }

  console.log(`Generated ${events.length} default lifecycle events for ${did}`);
  return events.length;
}

