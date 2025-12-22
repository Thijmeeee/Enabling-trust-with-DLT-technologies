/**
 * Adapter layer to make enhanced datastore compatible with existing components
 */

import { hybridDataStore as dataStore } from '../data/hybridDataStore';
import { exportHierarchyToJSON } from '../operations/bulkOperations';

export async function getDPPWithRelations(did: string) {
  console.log('getDPPWithRelations called for:', did);
  const dpp = await dataStore.getDPPByDID(did);
  if (!dpp) {
    console.error('DPP not found:', did);
    return null;
  }

  console.log('Found DPP:', dpp);

  // Get data using available methods, with fallbacks for unavailable ones
  const didDocument = await dataStore.getDIDDocumentByDID(did);
  const attestations = await dataStore.getAttestationsByDID(did);
  const anchoringEvents = await dataStore.getAnchoringEventsByDID(did);

  // Methods not yet implemented - return empty arrays
  const relationships: any[] = [];
  const credentials: any[] = [];
  const specifications: any[] = [];

  console.log('Specifications found:', specifications);

  // No parent/child relationships in backend data yet
  const parent = null;
  const children: any[] = [];

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
  // Simplified metrics without component relationships
  const dpps = await dataStore.getAllDPPs();
  const dpp = dpps.find(d => d.id === dppId);
  if (!dpp) return null;

  const attestations = await dataStore.getAttestationsByDID(dpp.did);
  const anchoringEvents = await dataStore.getAnchoringEventsByDID(dpp.did);

  return {
    componentCount: 0,
    credentialCount: 0,
    attestationCount: attestations.length,
    anchoringCount: anchoringEvents.length,
    verifiedCredentials: 0,
    aggregatedSustainability: {
      totalCO2Footprint: 0,
      avgRecycledContent: 0,
      avgRecyclability: 0,
    },
  };
}

export { exportHierarchyToJSON as exportDPPHierarchyToJSON };
