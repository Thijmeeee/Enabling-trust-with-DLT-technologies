/**
 * Adapter layer to make enhanced datastore compatible with existing components
 */

import { hybridDataStore as dataStore } from '../data/hybridDataStore';
import { localDB } from '../data/localData';
import { enhancedDB } from '../data/enhancedDataStore';
import { exportHierarchyToJSON } from '../operations/bulkOperations';

export async function getDPPWithRelations(did: string) {
  console.log('getDPPWithRelations called for:', did);
  const dpp = await dataStore.getDPPByDID(did);
  if (!dpp) {
    console.error('DPP not found:', did);
    return null;
  }

  console.log('Found DPP:', dpp);

  // Get data using available methods
  const didDocument = await dataStore.getDIDDocumentByDID(did);
  const attestations = await dataStore.getAttestationsByDID(did);
  const anchoringEvents = await dataStore.getAnchoringEventsByDID(did);
  
  // Get credentials and specifications (check both stores)
  let credentials = await localDB.getCredentialsByDPP(dpp.id);
  if (credentials.length === 0) {
    credentials = await enhancedDB.getCredentialsByDPPId(dpp.id);
  }
  
  let specifications = await localDB.getSpecificationsByDPP(dpp.id);
  if (specifications.length === 0) {
    specifications = await enhancedDB.getSpecificationsByDPPId(dpp.id);
  }

  // Get relationships using hybridDataStore which checks both stores
  const relationships = await dataStore.getRelationshipsByParent(did);

  console.log('Specifications found:', specifications);
  console.log('Relationships found:', relationships);

  // Get parent if this is a component
  let parent = null;
  if (dpp.type === 'component') {
    const parentRelations = await dataStore.getRelationshipsByChild(did);
    if (parentRelations.length > 0) {
      const parentDpp = await dataStore.getDPPByDID(parentRelations[0].parent_did);
      if (parentDpp) {
        parent = { did: parentDpp.did, model: parentDpp.model };
      }
    }
  }

  // Get children from relationships table
  const children: any[] = [];
  for (const rel of relationships) {
    const childDpp = await dataStore.getDPPByDID(rel.child_did);
    if (childDpp) {
      const childDidDocument = await dataStore.getDIDDocumentByDID(rel.child_did);
      children.push({
        dpp: childDpp,
        didDocument: childDidDocument,
        relationship: rel,
      });
    }
  }

  console.log('Children found:', children.length);

  return {
    dpp,
    didDocument,
    parent,
    relationships,
    children,
    credentials,
    attestations,
    anchoringEvents,
    specifications,
    events: attestations, // Use attestations as events for now
  };
}

export async function updateDPP(_id: string, _updates: Partial<any>): Promise<any | null> {
  // Not yet implemented in backend - return null for now
  console.warn('updateDPP not yet implemented for backend');
  return null;
}

export async function getAggregatedMetrics(dppId: string) {
  const dpps = await dataStore.getAllDPPs();
  const dpp = dpps.find(d => d.id === dppId);
  if (!dpp) return null;

  const attestations = await dataStore.getAttestationsByDID(dpp.did);
  const anchoringEvents = await dataStore.getAnchoringEventsByDID(dpp.did);
  
  // Get credentials from both stores
  let credentials = await localDB.getCredentialsByDPP(dppId);
  if (credentials.length === 0) {
    credentials = await enhancedDB.getCredentialsByDPPId(dppId);
  }
  
  // Get relationships using hybridDataStore
  const relationships = await dataStore.getRelationshipsByParent(dpp.did);

  return {
    componentCount: relationships.length,
    credentialCount: credentials.length,
    attestationCount: attestations.length,
    anchoringCount: anchoringEvents.length,
    verifiedCredentials: credentials.filter((c: any) => c.verification_status === 'valid').length,
    aggregatedSustainability: {
      totalCO2Footprint: 0,
      avgRecycledContent: 0,
      avgRecyclability: 0,
    },
  };
}

export { exportHierarchyToJSON as exportDPPHierarchyToJSON };
