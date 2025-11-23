import { enhancedDB } from './enhancedDataStore';
import { localDB } from './localData';

/**
 * Generate realistic witness attestations for a DPP
 */
export async function generateWitnessAttestations(dppId: string, did: string, dppType: 'main' | 'component') {
  const witnesses = [
    {
      did: 'did:webvh:example.com:witnesses:quality-inspector-1',
      name: 'Quality Inspector - Maria Santos',
      org: 'TÜV Certification',
    },
    {
      did: 'did:webvh:example.com:witnesses:production-manager',
      name: 'Production Manager - Jan Bakker',
      org: 'Window Manufacturing Co',
    },
    {
      did: 'did:webvh:example.com:witnesses:logistics-officer',
      name: 'Logistics Officer - Sarah Williams',
      org: 'Supply Chain Services',
    },
  ];

  const now = Date.now();
  const attestations = [];

  // Production attestation (always)
  attestations.push({
    dpp_id: dppId,
    did: did,
    witness_did: witnesses[1].did,
    attestation_type: 'production_verified',
    attestation_data: {
      timestamp: new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString(),
      witness: witnesses[1].name,
      organization: witnesses[1].org,
      location: 'Factory Floor A',
      batchNumber: `BATCH-${Math.floor(Math.random() * 10000)}`,
      notes: 'Production completed according to specifications',
    },
    signature: `0x${Math.random().toString(16).substring(2, 66)}`,
  });

  // Quality inspection (80% chance)
  if (Math.random() > 0.2) {
    attestations.push({
      dpp_id: dppId,
      did: did,
      witness_did: witnesses[0].did,
      attestation_type: 'quality_inspection',
      attestation_data: {
        timestamp: new Date(now - 6 * 24 * 60 * 60 * 1000).toISOString(),
        witness: witnesses[0].name,
        organization: witnesses[0].org,
        result: 'passed',
        testResults: {
          dimensionalAccuracy: 'pass',
          visualInspection: 'pass',
          functionalTest: 'pass',
        },
        certificateNumber: `CERT-${Math.floor(Math.random() * 100000)}`,
      },
      signature: `0x${Math.random().toString(16).substring(2, 66)}`,
    });
  }

  // Assembly attestation (for main products)
  if (dppType === 'main') {
    attestations.push({
      dpp_id: dppId,
      did: did,
      witness_did: 'did:webvh:example.com:witnesses:assembly-supervisor',
      attestation_type: 'assembly',
      attestation_data: {
        timestamp: new Date(now - 4 * 24 * 60 * 60 * 1000).toISOString(),
        witness: 'Assembly Supervisor - John Smith',
        organization: 'Window Manufacturing Co',
        location: 'Assembly Line B',
        notes: 'Components assembled and integrated successfully',
        componentsVerified: true,
      },
      signature: `0x${Math.random().toString(16).substring(2, 66)}`,
    });
  }

  // Transfer attestation (for components)
  if (dppType === 'component' && Math.random() > 0.3) {
    attestations.push({
      dpp_id: dppId,
      did: did,
      witness_did: witnesses[2].did,
      attestation_type: 'transfer',
      attestation_data: {
        timestamp: new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString(),
        witness: witnesses[2].name,
        organization: witnesses[2].org,
        from: 'Supplier Warehouse',
        to: 'Manufacturer Assembly Line',
        transportMethod: 'Truck',
        condition: 'Excellent',
      },
      signature: `0x${Math.random().toString(16).substring(2, 66)}`,
    });
  }

  // Insert all attestations to both stores for compatibility
  for (const attestation of attestations) {
    await enhancedDB.insertAttestation(attestation);
    await localDB.insertAttestation(attestation);
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
  await enhancedDB.insertAnchoringEvent(anchorData);
  await localDB.insertAnchoringEvent(anchorData);

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
    await enhancedDB.insertAnchoringEvent(verificationData);
    await localDB.insertAnchoringEvent(verificationData);
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
  await enhancedDB.insertAttestation(attestationData);
  await localDB.insertAttestation(attestationData);

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
    await enhancedDB.insertAnchoringEvent(lifecycleAnchorData);
    await localDB.insertAnchoringEvent(lifecycleAnchorData);
  }
}

/**
 * Progress DID lifecycle to next stage
 * Note: Currently just logs the progression. In production, this would update the DID document.
 */
export async function progressDIDLifecycle(did: string, stage: 'registered' | 'verified' | 'anchored') {
  const didDoc = await enhancedDB.getDIDDocumentByDID(did);
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
  await enhancedDB.insertAttestation(lifecycleAttestationData);
  await localDB.insertAttestation(lifecycleAttestationData);
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
    await enhancedDB.insertAttestation(event);
    await localDB.insertAttestation(event);
  }

  console.log(`Generated ${events.length} default lifecycle events for ${did}`);
  return events.length;
}
