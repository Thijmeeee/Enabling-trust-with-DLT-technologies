import { localDB } from './localData';
import {
  generateWitnessAttestations,
  generateAnchoringEvents,
} from './lifecycleHelpers';

export async function generateMockData() {
  const mainWindowDPP = {
    did: 'did:webvh:example.com:products:window-W2025-001',
    type: 'main' as const,
    model: 'Window-Premium-2025',
    parent_did: null,
    lifecycle_status: 'active',
    owner: 'did:webvh:example.com:organizations:window-manufacturer',
    custodian: null,
    metadata: {
      description: 'Premium double-glazed window',
      dimensions: { width: 1200, height: 1500, unit: 'mm' },
      weight: 45.5,
      productionDate: '2025-01-15',
      image_url: '/images/window.png',
    },
    version: 1,
    previous_version_id: null,
  };

  const glassDPP = {
    did: 'did:webvh:example.com:products:glass-G2025-456',
    type: 'component' as const,
    model: 'Glass-DoubleGlazed-Low-E',
    parent_did: 'did:webvh:example.com:products:window-W2025-001',
    lifecycle_status: 'active',
    owner: 'did:webvh:example.com:organizations:glass-supplier',
    custodian: 'did:webvh:example.com:organizations:window-manufacturer',
    metadata: {
      description: 'Low-E double-glazed glass panel',
      thickness: 24,
      uValue: 1.1,
      productionDate: '2025-01-10',
      image_url: '/images/glass.png',
    },
    version: 1,
    previous_version_id: null,
  };

  const frameDPP = {
    did: 'did:webvh:example.com:products:frame-F2025-789',
    type: 'component' as const,
    model: 'Frame-Aluminum-Thermal-Break',
    parent_did: 'did:webvh:example.com:products:window-W2025-001',
    lifecycle_status: 'active',
    owner: 'did:webvh:example.com:organizations:frame-supplier',
    custodian: 'did:webvh:example.com:organizations:window-manufacturer',
    metadata: {
      description: 'Aluminum frame with thermal break technology',
      material: 'Aluminum 6063-T5',
      finish: 'Powder coated RAL 9016',
      productionDate: '2025-01-12',
      image_url: '/images/frame.png',
    },
    version: 1,
    previous_version_id: null,
  };

  const windowData = await localDB.insertDPP(mainWindowDPP);
  const glassData = await localDB.insertDPP(glassDPP);
  const frameData = await localDB.insertDPP(frameDPP);

  // Generate witness attestations for all DPPs
  await generateWitnessAttestations(windowData.id, mainWindowDPP.did, 'main');
  await generateWitnessAttestations(glassData.id, glassDPP.did, 'component');
  await generateWitnessAttestations(frameData.id, frameDPP.did, 'component');

  await localDB.insertRelationship({
    parent_did: mainWindowDPP.did,
    child_did: glassDPP.did,
    relationship_type: 'component',
    position: 1,
    metadata: { role: 'glazing', quantity: 1 },
  });

  await localDB.insertRelationship({
    parent_did: mainWindowDPP.did,
    child_did: frameDPP.did,
    relationship_type: 'component',
    position: 2,
    metadata: { role: 'frame', quantity: 1 },
  });

  // DID Documents
  await localDB.insertDIDDocument({
    dpp_id: windowData.id,
    did: mainWindowDPP.did,
    controller: mainWindowDPP.owner,
    verification_method: [
      {
        id: `${mainWindowDPP.did}#key-1`,
        type: 'Ed25519VerificationKey2020',
        controller: mainWindowDPP.owner,
        publicKeyMultibase: 'z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK',
      },
    ],
    service_endpoints: [
      {
        id: `${mainWindowDPP.did}#dpp-service`,
        type: 'DPPService',
        serviceEndpoint: 'https://example.com/dpp/window-W2025-001',
      },
    ],
    proof: {
      type: 'MerkleProof2024',
      created: mainWindowDPP.metadata.productionDate,
      proofPurpose: 'assertionMethod',
      merkleRoot: '0x1234567890abcdef...',
      transactionHash: '0xabcdef1234567890...',
      blockNumber: 15234567,
    },
    document_metadata: { version: '1.0', standard: 'DID:webvh' },
  });

  await localDB.insertDIDDocument({
    dpp_id: glassData.id,
    did: glassDPP.did,
    controller: glassDPP.owner,
    verification_method: [
      {
        id: `${glassDPP.did}#key-1`,
        type: 'Ed25519VerificationKey2020',
        controller: glassDPP.owner,
        publicKeyMultibase: 'z6MkpTHR8VNsBxYAAWHut2Geadd9jSwuBV8xRoAnwWsdvktH',
      },
    ],
    service_endpoints: [
      {
        id: `${glassDPP.did}#dpp-service`,
        type: 'DPPService',
        serviceEndpoint: 'https://example.com/dpp/glass-G2025-456',
      },
    ],
    proof: {
      type: 'MerkleProof2024',
      created: glassDPP.metadata.productionDate,
      proofPurpose: 'assertionMethod',
      merkleRoot: '0x9876543210fedcba...',
      transactionHash: '0xfedcba0987654321...',
      blockNumber: 15234560,
    },
    document_metadata: { version: '1.0', standard: 'DID:webvh' },
  });

  await localDB.insertDIDDocument({
    dpp_id: frameData.id,
    did: frameDPP.did,
    controller: frameDPP.owner,
    verification_method: [
      {
        id: `${frameDPP.did}#key-1`,
        type: 'Ed25519VerificationKey2020',
        controller: frameDPP.owner,
        publicKeyMultibase: 'z6MknGc3ocHs3zdPiJbnaaqDi58NGb4pk1Sp9WxWufuXSdxf',
      },
    ],
    service_endpoints: [
      {
        id: `${frameDPP.did}#dpp-service`,
        type: 'DPPService',
        serviceEndpoint: 'https://example.com/dpp/frame-F2025-789',
      },
    ],
    proof: {
      type: 'MerkleProof2024',
      created: frameDPP.metadata.productionDate,
      proofPurpose: 'assertionMethod',
      merkleRoot: '0xabcd1234ef567890...',
      transactionHash: '0x567890abcd1234ef...',
      blockNumber: 15234563,
    },
    document_metadata: { version: '1.0', standard: 'DID:webvh' },
  });

  // Generate blockchain anchoring events for all DPPs
  await generateAnchoringEvents(windowData.id, mainWindowDPP.did, [glassDPP.did, frameDPP.did]);
  await generateAnchoringEvents(glassData.id, glassDPP.did);
  await generateAnchoringEvents(frameData.id, frameDPP.did);

  // Verifiable Credentials
  await localDB.insertCredential({
    dpp_id: windowData.id,
    credential_id: 'urn:uuid:3f7c2f1e-8d3a-4b5c-9e7f-1a2b3c4d5e6f',
    issuer: 'did:webvh:example.com:organizations:certification-body',
    credential_type: 'QualityCertificate',
    credential_data: {
      certificateNumber: 'QC-2025-001',
      standard: 'EN 14351-1:2006+A2:2016',
      testResults: { airPermeability: 'Class 4', waterTightness: 'Class 9A' },
    },
    issued_date: '2025-01-20T00:00:00Z',
    expiry_date: '2030-01-20T00:00:00Z',
    verification_status: 'valid',
  });

  await localDB.insertCredential({
    dpp_id: windowData.id,
    credential_id: 'urn:uuid:7e4a2c8d-3b1f-4e5a-9c7d-2f3e4a5b6c7d',
    issuer: 'did:webvh:example.com:organizations:environmental-assessor',
    credential_type: 'SustainabilityCredential',
    credential_data: {
      carbonFootprint: { value: 85, unit: 'kg CO2e' },
      recycledContent: 45,
      recyclability: 95,
      epdNumber: 'EPD-WIN-2025-001',
    },
    issued_date: '2025-01-22T00:00:00Z',
    expiry_date: null,
    verification_status: 'valid',
  });

  // Watchers
  await localDB.insertWatcher({
    name: 'Hierarchy Integrity Watcher',
    watcher_type: 'hierarchy',
    monitored_dids: [mainWindowDPP.did],
    config: { checkInterval: 3600, alertOnOrphans: true },
    active: true,
    last_check: new Date().toISOString(),
  });

  const integrityWatcher = await localDB.insertWatcher({
    name: 'Data Integrity Watcher',
    watcher_type: 'integrity',
    monitored_dids: [mainWindowDPP.did, glassDPP.did, frameDPP.did],
    config: { checkInterval: 1800, verifyProofs: true },
    active: true,
    last_check: new Date().toISOString(),
  });

  // Sample Alerts
  await localDB.insertAlert({
    watcher_id: integrityWatcher.id,
    dpp_id: glassData.id,
    did: glassDPP.did,
    alert_type: 'info',
    severity: 'info',
    message: 'Component integrity verified',
    details: { verificationType: 'cryptographic', status: 'valid' },
    resolved: true,
  });

  // Specifications
  await localDB.insertSpecification({
    dpp_id: glassData.id,
    spec_type: 'thermal',
    spec_data: {
      uValue: 1.1,
      solarHeatGainCoefficient: 0.47,
      visibleTransmittance: 0.70,
      coating: 'Low-E',
    },
    supplier: 'did:webvh:example.com:organizations:glass-supplier',
  });

  await localDB.insertSpecification({
    dpp_id: frameData.id,
    spec_type: 'mechanical',
    spec_data: {
      material: 'Aluminum 6063-T5',
      thermalBreak: true,
      finish: 'Powder coating RAL 9016',
      wallThickness: 1.5,
    },
    supplier: 'did:webvh:example.com:organizations:frame-supplier',
  });
}

export async function generateBulkMockData(count: number) {
  const baseTimestamp = Date.now();
  const windowTypes = [
    'Premium-Double-Glazed',
    'Standard-Single-Pane', 
    'Energy-Efficient-Triple',
    'Soundproof-Laminated',
    'Security-Reinforced',
    'Bay-Window-Assembly',
    'Sliding-Patio-Door',
    'Casement-Tilt-Turn',
    'Awning-Ventilation',
    'Picture-Fixed-Panel'
  ];
  
  const glassTypes = [
    'Low-E-Double-Glazed',
    'Standard-Clear-Glass',
    'Triple-Glazed-Argon',
    'Acoustic-Laminated',
    'Tempered-Safety-Glass',
    'Low-Iron-Ultra-Clear',
    'Tinted-Solar-Control',
    'Reflective-Privacy',
    'Frosted-Obscure',
    'Smart-Electrochromic'
  ];
  
  const frameTypes = [
    'Aluminum-Thermal-Break',
    'UPVC-Multi-Chamber',
    'Wood-Composite-Clad',
    'Fiberglass-Reinforced',
    'Steel-Security-Frame',
    'Vinyl-Insulated',
    'Aluminum-Wood-Hybrid',
    'UPVC-Welded-Corner',
    'Timber-Hardwood',
    'Composite-Polymer'
  ];
  
  for (let i = 0; i < count; i++) {
    const uniqueId = `${baseTimestamp + i}-${Math.random().toString(36).substr(2, 9)}`;
    const windowType = windowTypes[i % windowTypes.length];
    const glassType = glassTypes[i % glassTypes.length];
    const frameType = frameTypes[i % frameTypes.length];
    
    // Create window DID
    const windowDid = `did:webvh:example.com:products:window-${uniqueId}`;
    const glassDid = `did:webvh:example.com:products:glass-${uniqueId}`;
    const frameDid = `did:webvh:example.com:products:frame-${uniqueId}`;
    
    // Create glass component
    const glassData = await localDB.insertDPP({
      did: glassDid,
      type: 'component' as const,
      model: `Glass-${glassType}-${i + 1}`,
      parent_did: windowDid,
      lifecycle_status: 'active',
      owner: 'did:webvh:example.com:organizations:glass-supplier',
      custodian: 'did:webvh:example.com:organizations:window-manufacturer',
      metadata: {
        description: `${glassType.replace(/-/g, ' ')} glass panel`,
        thickness: 4 + (i % 3) * 4,
        uValue: 1.0 + (i % 5) * 0.2,
        productionDate: new Date(Date.now() - i * 86400000).toISOString(),
      },
      version: 1,
      previous_version_id: null,
    });
    
    // Create frame component
    const frameData = await localDB.insertDPP({
      did: frameDid,
      type: 'component' as const,
      model: `Frame-${frameType}-${i + 1}`,
      parent_did: windowDid,
      lifecycle_status: 'active',
      owner: 'did:webvh:example.com:organizations:frame-supplier',
      custodian: 'did:webvh:example.com:organizations:window-manufacturer',
      metadata: {
        description: `${frameType.replace(/-/g, ' ')} frame`,
        material: frameType.split('-')[0],
        finish: 'Powder coated',
        productionDate: new Date(Date.now() - i * 86400000).toISOString(),
      },
      version: 1,
      previous_version_id: null,
    });
    
    // Create main window
    const windowData = await localDB.insertDPP({
      did: windowDid,
      type: 'main' as const,
      model: `Window-${windowType}-${i + 1}`,
      parent_did: null,
      lifecycle_status: 'active',
      owner: 'did:webvh:example.com:organizations:window-manufacturer',
      custodian: null,
      metadata: {
        description: `${windowType.replace(/-/g, ' ')} window`,
        dimensions: { width: 1000 + i * 100, height: 1200 + i * 100, unit: 'mm' },
        weight: 35 + i * 2.5,
        productionDate: new Date(Date.now() - i * 86400000).toISOString(),
        batch: `BATCH-${i + 1}`,
      },
      version: 1,
      previous_version_id: null,
    });

    // Generate witness attestations for all components
    await generateWitnessAttestations(glassData.id, glassDid, 'component');
    await generateWitnessAttestations(frameData.id, frameDid, 'component');
    await generateWitnessAttestations(windowData.id, windowDid, 'main');

    // Create relationships
    await localDB.insertRelationship({
      parent_did: windowDid,
      child_did: glassDid,
      relationship_type: 'component',
      position: 1,
      metadata: { role: 'glazing', quantity: 1 },
    });

    await localDB.insertRelationship({
      parent_did: windowDid,
      child_did: frameDid,
      relationship_type: 'component',
      position: 2,
      metadata: { role: 'frame', quantity: 1 },
    });

    // Create DID documents with verification methods
    await localDB.insertDIDDocument({
      dpp_id: windowData.id,
      did: windowDid,
      controller: windowData.owner,
      verification_method: [
        {
          id: `${windowDid}#key-1`,
          type: 'Ed25519VerificationKey2020',
          controller: windowData.owner,
          publicKeyMultibase: `z6Mk${Math.random().toString(36).substring(2, 15)}`,
        },
      ],
      service_endpoints: [
        {
          id: `${windowDid}#dpp-service`,
          type: 'DPPService',
          serviceEndpoint: `https://example.com/dpp/${windowDid.split(':').pop()}`,
        },
      ],
      proof: { 
        type: 'Ed25519Signature2020',
        created: new Date(Date.now() - i * 86400000).toISOString(),
        proofPurpose: 'assertionMethod',
      },
      document_metadata: { bulk: true, version: '1.0' },
    });
    
    await localDB.insertDIDDocument({
      dpp_id: glassData.id,
      did: glassDid,
      controller: glassData.owner,
      verification_method: [
        {
          id: `${glassDid}#key-1`,
          type: 'Ed25519VerificationKey2020',
          controller: glassData.owner,
          publicKeyMultibase: `z6Mk${Math.random().toString(36).substring(2, 15)}`,
        },
      ],
      service_endpoints: [
        {
          id: `${glassDid}#dpp-service`,
          type: 'DPPService',
          serviceEndpoint: `https://example.com/dpp/${glassDid.split(':').pop()}`,
        },
      ],
      proof: { 
        type: 'Ed25519Signature2020',
        created: new Date(Date.now() - i * 86400000).toISOString(),
        proofPurpose: 'assertionMethod',
      },
      document_metadata: { bulk: true, version: '1.0' },
    });
    
    await localDB.insertDIDDocument({
      dpp_id: frameData.id,
      did: frameDid,
      controller: frameData.owner,
      verification_method: [
        {
          id: `${frameDid}#key-1`,
          type: 'Ed25519VerificationKey2020',
          controller: frameData.owner,
          publicKeyMultibase: `z6Mk${Math.random().toString(36).substring(2, 15)}`,
        },
      ],
      service_endpoints: [
        {
          id: `${frameDid}#dpp-service`,
          type: 'DPPService',
          serviceEndpoint: `https://example.com/dpp/${frameDid.split(':').pop()}`,
        },
      ],
      proof: { 
        type: 'Ed25519Signature2020',
        created: new Date(Date.now() - i * 86400000).toISOString(),
        proofPurpose: 'assertionMethod',
      },
      document_metadata: { bulk: true, version: '1.0' },
    });

    // Add credentials for trust score
    // Window credential (always)
    await localDB.insertCredential({
      dpp_id: windowData.id,
      credential_id: `urn:uuid:${Math.random().toString(36).substring(2, 15)}`,
      issuer: 'did:webvh:example.com:organizations:certification-body',
      credential_type: 'QualityCertificate',
      credential_data: {
        certificateNumber: `QC-2025-${String(i + 1).padStart(4, '0')}`,
        standard: 'EN 14351-1:2006+A2:2016',
        testResults: { airPermeability: 'Class 4', waterTightness: 'Class 9A' },
      },
      issued_date: new Date(Date.now() - i * 86400000).toISOString(),
      expiry_date: new Date(Date.now() + (1825 - i) * 86400000).toISOString(),
      verification_status: 'valid',
    });

    // Glass credential (50% chance)
    if (i % 2 === 0) {
      await localDB.insertCredential({
        dpp_id: glassData.id,
        credential_id: `urn:uuid:${Math.random().toString(36).substring(2, 15)}`,
        issuer: 'did:webvh:example.com:organizations:glass-certifier',
        credential_type: 'MaterialCertificate',
        credential_data: {
          material: 'Glass',
          standard: 'EN 1279',
          testResults: { uValue: 1.1, soundReduction: 32 },
        },
        issued_date: new Date(Date.now() - i * 86400000).toISOString(),
        expiry_date: new Date(Date.now() + (1825 - i) * 86400000).toISOString(),
        verification_status: 'valid',
      });
    }

    // Frame credential (33% chance)
    if (i % 3 === 0) {
      await localDB.insertCredential({
        dpp_id: frameData.id,
        credential_id: `urn:uuid:${Math.random().toString(36).substring(2, 15)}`,
        issuer: 'did:webvh:example.com:organizations:frame-certifier',
        credential_type: 'ComplianceCertificate',
        credential_data: {
          standard: 'EN 14351-1',
          airPermeability: 'Class 4',
          waterTightness: 'Class E1200',
        },
        issued_date: new Date(Date.now() - i * 86400000).toISOString(),
        expiry_date: new Date(Date.now() + (1825 - i) * 86400000).toISOString(),
        verification_status: 'valid',
      });
    }

    // Generate blockchain anchoring events
    await generateAnchoringEvents(windowData.id, windowDid, [glassDid, frameDid]);
    await generateAnchoringEvents(glassData.id, glassDid);
    await generateAnchoringEvents(frameData.id, frameDid);
  }
}
