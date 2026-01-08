import { localDB } from '../data/localData';
import { enhancedDB } from '../data/enhancedDataStore';
import { hybridDataStore } from '../data/hybridDataStore';
import type { DPP } from '../data/localData';

export async function verifyDPPIntegrity(dpp: DPP): Promise<{
  valid: boolean;
  errors: string[];
}> {
  const errors: string[] = [];

  // Check DID format
  if (!dpp.did.startsWith('did:')) {
    errors.push('Invalid DID format');
  }

  // Check required fields
  if (!dpp.owner) {
    errors.push('Missing owner');
  }

  // Check relationships for component DPPs
  if (dpp.type === 'component' && !dpp.parent_did) {
    errors.push('Component DPP must have a parent');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export async function verifyHierarchy(mainDid: string): Promise<{
  valid: boolean;
  issues: string[];
}> {
  const issues: string[] = [];
  const mainDPP = await hybridDataStore.getDPPByDID(mainDid);

  if (!mainDPP) {
    return { valid: false, issues: ['Main DPP not found'] };
  }

  if (mainDPP.type !== 'main') {
    issues.push('DPP is not a main type');
  }

  const relationships = await hybridDataStore.getRelationshipsByParent(mainDid);
  
  for (const rel of relationships) {
    const childDPP = await hybridDataStore.getDPPByDID(rel.child_did);
    if (!childDPP) {
      issues.push(`Child DPP ${rel.child_did} not found`);
    } else if (childDPP.type !== 'component') {
      issues.push(`Child ${rel.child_did} is not a component type`);
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

export async function calculateTrustScore(dppId: string): Promise<{
  score: number;
  breakdown: Record<string, number>;
}> {
  let didResolutionScore = 0;
  let anchoringScore = 0;
  let credentialScore = 0;
  let hierarchyScore = 0;
  let attestationScore = 0;

  // Get DPP by ID - use hybridDataStore which checks both stores
  const allDpps = await hybridDataStore.getAllDPPs();
  let dppData = allDpps.find(d => d.id === dppId);
  
  // Also try to find by DID if not found by ID
  if (!dppData) {
    dppData = allDpps.find(d => d.did === dppId);
  }

  if (!dppData) {
    console.log('calculateTrustScore: DPP not found for ID:', dppId);
    return { score: 0, breakdown: {} };
  }

  console.log('calculateTrustScore: Found DPP:', dppData.did, dppData.model);

  // 1. DID Document Resolution - check if document exists and has valid verification methods
  const didDoc = await hybridDataStore.getDIDDocumentByDID(dppData.did);

  if (didDoc) {
    // Base score for having a DID document
    didResolutionScore = 15;
    if (didDoc.verification_method && Array.isArray(didDoc.verification_method) && didDoc.verification_method.length > 0) {
      didResolutionScore = 25;
    }
  } else if (dppData.did && dppData.did.startsWith('did:webvh:')) {
    // If DPP has a valid DID format, give partial credit
    didResolutionScore = 10;
  }

  // 2. Blockchain Anchoring - check for anchoring events
  const anchors = await hybridDataStore.getAnchoringEventsByDID(dppData.did);

  if (anchors && anchors.length > 0) {
    anchoringScore = 25;
  }

  // 3. Witness Attestations - check for attestations (DID events)
  const attestations = await hybridDataStore.getAttestationsByDID(dppData.did);

  if (attestations && attestations.length > 0) {
    // Filter for approved attestations
    const approvedAttestations = attestations.filter(a => 
      a.approval_status === 'approved' || 
      (a.signature && !a.signature.startsWith('pending-'))
    );
    
    if (approvedAttestations.length > 0) {
      // Base 15 points for having attestations, up to 25 for multiple
      attestationScore = Math.min(25, 15 + approvedAttestations.length * 2);
    } else if (attestations.length > 0) {
      // Pending attestations give partial credit
      attestationScore = 5;
    }
  }

  // 4. Credentials - check for verified credentials
  let allCredentials = await enhancedDB.getCredentialsByDPPId(dppId);
  if (!allCredentials || allCredentials.length === 0) {
    allCredentials = await localDB.getCredentialsByDPP(dppId);
  }
  const validCredentials = allCredentials.filter((c: any) => c.verification_status === 'valid');

  if (validCredentials && validCredentials.length > 0) {
    credentialScore = Math.min(15, validCredentials.length * 5);
  }

  // 5. Hierarchy Validation - for main products, check component structure
  if (dppData.type === 'main') {
    const hierarchyCheck = await verifyHierarchy(dppData.did);
    if (hierarchyCheck.valid) {
      hierarchyScore = 10;
    } else {
      // Give partial credit if hierarchy exists but has issues
      hierarchyScore = Math.max(0, 10 - hierarchyCheck.issues.length * 2);
    }
  } else {
    // Components get credit if they have a parent
    hierarchyScore = dppData.parent_did ? 10 : 5;
  }

  const totalScore = didResolutionScore + anchoringScore + attestationScore + credentialScore + hierarchyScore;
  
  // Ensure we always have at least a baseline score for registered products
  const finalScore = Math.max(totalScore, dppData.did ? 20 : 0);

  return {
    score: Math.min(100, finalScore),
    breakdown: {
      didResolution: didResolutionScore,
      anchoring: anchoringScore,
      attestations: attestationScore,
      credentials: credentialScore,
      hierarchy: hierarchyScore,
    },
  };
}
