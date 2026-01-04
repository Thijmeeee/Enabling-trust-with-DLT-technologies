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

  // Parse children from metadata.components if available
  const children: any[] = [];
  if (dpp.metadata && Array.isArray(dpp.metadata.components)) {
    console.log('Found components in metadata:', dpp.metadata.components);
    // Map components to the expected child format
    // We try to find the full DPP for each component if possible, otherwise use the metadata
    for (const comp of dpp.metadata.components) {
      if (comp.did) {
        const childDpp = await dataStore.getDPPByDID(comp.did);
        if (childDpp) {
          children.push(childDpp);
        } else {
          // If we can't find the full DPP (e.g. strict permissioning), create a skeleton from the metadata reference
          children.push({
            id: 'unknown-id-' + Math.random(), // Temporary ID
            did: comp.did,
            type: comp.type || 'component',
            model: comp.description || 'Verified Component', // Use description as model name fallack
            owner: 'Unknown',
            status: 'active',
            compliance_status: 'compliant',
            lifecycle_status: 'installed', // Assume installed if part of a product
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            metadata: {
              productType: comp.type,
              ...comp
            }
          });
        }
      }
    }
  }

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
