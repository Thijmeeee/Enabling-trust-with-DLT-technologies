import { localDB } from './localData';
import { enhancedDB } from './enhancedDataStore';
import type { DPP } from './localData';

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
  const mainDPP = await localDB.getDPPByDID(mainDid);

  if (!mainDPP) {
    return { valid: false, issues: ['Main DPP not found'] };
  }

  if (mainDPP.type !== 'main') {
    issues.push('DPP is not a main type');
  }

  const relationships = await localDB.getRelationshipsByParent(mainDid);
  
  for (const rel of relationships) {
    const childDPP = await localDB.getDPPByDID(rel.child_did);
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

  // Get DPP by ID - try enhancedDB first, fallback to localDB
  let dppData = await enhancedDB.getDPPById(dppId);
  
  if (!dppData) {
    const allDpps = await localDB.getDPPs();
    dppData = allDpps.find(d => d.id === dppId);
  }

  if (!dppData) {
    return { score: 0, breakdown: {} };
  }

  // Try to get DID document from enhancedDB first, then localDB
  let didDoc = await enhancedDB.getDIDDocumentByDID(dppData.did);
  if (!didDoc) {
    didDoc = await localDB.getDIDDocumentByDID(dppData.did);
  }

  if (didDoc && didDoc.verification_method && Array.isArray(didDoc.verification_method) && didDoc.verification_method.length > 0) {
    didResolutionScore = 25;
  }

  // Try to get anchoring events from enhancedDB first, then localDB
  let anchors = await enhancedDB.getAnchoringEventsByDID(dppData.did);
  if (!anchors || anchors.length === 0) {
    anchors = await localDB.getAnchoringEventsByDID(dppData.did);
  }

  if (anchors && anchors.length > 0) {
    anchoringScore = 25;
  }

  // Try to get credentials from enhancedDB first, then localDB
  let allCredentials = await enhancedDB.getCredentialsByDPPId(dppId);
  if (!allCredentials || allCredentials.length === 0) {
    allCredentials = await localDB.getCredentialsByDPP(dppId);
  }
  const validCredentials = allCredentials.filter((c: any) => c.verification_status === 'valid');

  if (validCredentials && validCredentials.length > 0) {
    credentialScore = Math.min(25, validCredentials.length * 8);
  }

  if (dppData.type === 'main') {
    const hierarchyCheck = await verifyHierarchy(dppData.did);
    if (hierarchyCheck.valid) {
      hierarchyScore = 25;
    } else {
      hierarchyScore = Math.max(0, 25 - hierarchyCheck.issues.length * 5);
    }
  } else {
    hierarchyScore = dppData.parent_did ? 25 : 0;
  }

  const totalScore = didResolutionScore + anchoringScore + credentialScore + hierarchyScore;

  return {
    score: totalScore,
    breakdown: {
      didResolution: didResolutionScore,
      anchoring: anchoringScore,
      credentials: credentialScore,
      hierarchy: hierarchyScore,
    },
  };
}
