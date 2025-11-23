/**
 * Adapter layer to make enhanced datastore compatible with existing components
 */

import { enhancedDB } from './enhancedDataStore';
import { exportHierarchyToJSON } from './bulkOperations';

export async function getDPPWithRelations(did: string) {
  console.log('getDPPWithRelations called for:', did);
  const dpp = await enhancedDB.getDPPByDID(did);
  if (!dpp) {
    console.error('DPP not found:', did);
    return null;
  }
  
  console.log('Found DPP:', dpp);
  
  const didDocument = await enhancedDB.getDIDDocumentByDID(did);
  const relationships = await enhancedDB.getRelationshipsByParent(did);
  const credentials = await enhancedDB.getCredentialsByDPPId(dpp.id);
  const attestations = await enhancedDB.getAttestationsByDID(did);
  const anchoringEvents = await enhancedDB.getAnchoringEventsByDID(did);
  const specifications = await enhancedDB.getSpecificationsByDPPId(dpp.id);
  
  console.log('Specifications found:', specifications);
  
  // Get parent if this is a component
  let parent = null;
  if (dpp.type === 'component') {
    const parentRels = await enhancedDB.getRelationshipsByChild(did);
    if (parentRels.length > 0) {
      const parentDpp = await enhancedDB.getDPPByDID(parentRels[0].parent_did);
      if (parentDpp) {
        parent = {
          did: parentDpp.did,
          model: parentDpp.model,
        };
      }
    }
  }
  
  // Get children with their full data
  const children = [];
  for (const rel of relationships) {
    const childDpp = await enhancedDB.getDPPByDID(rel.child_did);
    if (childDpp) {
      const childDidDoc = await enhancedDB.getDIDDocumentByDID(rel.child_did);
      children.push({
        dpp: childDpp,
        didDocument: childDidDoc,
        relationship: rel,
      });
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

export async function getAggregatedMetrics(dppId: string) {
  const dpp = await enhancedDB.getDPPById(dppId);
  if (!dpp) return null;
  
  const relationships = await enhancedDB.getRelationshipsByParent(dpp.did);
  const credentials = await enhancedDB.getCredentialsByDPPId(dppId);
  const attestations = await enhancedDB.getAttestationsByDID(dpp.did);
  const anchoringEvents = await enhancedDB.getAnchoringEventsByDID(dpp.did);
  const specifications = await enhancedDB.getSpecificationsByDPPId(dppId);
  
  // Calculate aggregated sustainability metrics from specifications
  let totalCO2 = 0;
  let totalRecycledContent = 0;
  let totalRecyclability = 0;
  let sustainabilityCount = 0;
  
  for (const spec of specifications) {
    if (spec.spec_type === 'sustainability' && spec.spec_data) {
      const data = spec.spec_data as any;
      if (data.carbonFootprint?.total) {
        totalCO2 += parseFloat(data.carbonFootprint.total) || 0;
      }
      if (data.recycledContent) {
        totalRecycledContent += parseFloat(data.recycledContent) || 0;
      }
      if (data.recyclability) {
        totalRecyclability += parseFloat(data.recyclability) || 0;
      }
      sustainabilityCount++;
    }
  }
  
  // Also aggregate from child components
  for (const rel of relationships) {
    const childDpp = await enhancedDB.getDPPByDID(rel.child_did);
    if (childDpp) {
      const childSpecs = await enhancedDB.getSpecificationsByDPPId(childDpp.id);
      for (const spec of childSpecs) {
        if (spec.spec_type === 'sustainability' && spec.spec_data) {
          const data = spec.spec_data as any;
          if (data.carbonFootprint?.total) {
            totalCO2 += parseFloat(data.carbonFootprint.total) || 0;
          }
          if (data.recycledContent) {
            totalRecycledContent += parseFloat(data.recycledContent) || 0;
          }
          if (data.recyclability) {
            totalRecyclability += parseFloat(data.recyclability) || 0;
          }
          sustainabilityCount++;
        }
      }
    }
  }
  
  return {
    componentCount: relationships.length,
    credentialCount: credentials.length,
    attestationCount: attestations.length,
    anchoringCount: anchoringEvents.length,
    verifiedCredentials: credentials.filter(c => c.verification_status === 'valid').length,
    aggregatedSustainability: {
      totalCO2Footprint: totalCO2,
      avgRecycledContent: sustainabilityCount > 0 ? totalRecycledContent / sustainabilityCount : 0,
      avgRecyclability: sustainabilityCount > 0 ? totalRecyclability / sustainabilityCount : 0,
    },
  };
}

export { exportHierarchyToJSON as exportDPPHierarchyToJSON };
