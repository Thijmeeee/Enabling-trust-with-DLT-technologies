import { localDB } from '../data/localData';
import type { DPP } from '../data/localData';
import { getAllDPPs } from '../data/hybridDataStore';

export async function getDPPWithRelations(did: string) {
  const dpp = await localDB.getDPPByDID(did);
  if (!dpp) return null;

  const didDocument = await localDB.getDIDDocumentByDID(did);
  const childRelations = await localDB.getRelationshipsByParent(did);
  
  const children = [];
  for (const rel of childRelations) {
    const child = await localDB.getDPPByDID(rel.child_did);
    if (child) children.push(child);
  }

  let parent = null;
  let parentRelation = null;
  if (dpp.parent_did) {
    parent = await localDB.getDPPByDID(dpp.parent_did);
    const rels = await localDB.getRelationshipsByChild(did);
    parentRelation = rels[0] || null;
  }

  const anchors = await localDB.getAnchoringEventsByDID(did);
  const credentials = await localDB.getCredentialsByDPP(dpp.id);
  const specifications = await localDB.getSpecificationsByDPP(dpp.id);
  const attestations = await localDB.getAttestationsByDID(did);

  return {
    dpp,
    didDocument,
    children,
    childRelations,
    parent,
    parentRelation,
    anchors,
    credentials,
    specifications,
    attestations,
  };
}

export async function getHierarchyTree(rootDid: string) {
  async function buildTree(did: string, depth = 0): Promise<unknown> {
    if (depth > 10) return null;

    const dpp = await localDB.getDPPByDID(did);
    if (!dpp) return null;

    const childRelations = await localDB.getRelationshipsByParent(did);
    const children = [];
    
    for (const rel of childRelations) {
      const child = await buildTree(rel.child_did, depth + 1);
      if (child) {
        children.push({
          ...child,
          relationship: rel,
        });
      }
    }

    return { dpp, children };
  }

  return buildTree(rootDid);
}

export async function searchDPPs(filters: {
  searchTerm?: string;
  type?: 'main' | 'component';
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<{ data: DPP[]; count: number }> {
  // Use hybridDataStore instead of localDB to bridge backend/frontend data
  let dpps = await getAllDPPs();

  if (filters.type) {
    dpps = dpps.filter(d => d.type === filters.type);
  }

  if (filters.status) {
    dpps = dpps.filter(d => d.lifecycle_status === filters.status);
  }

  if (filters.searchTerm) {
    const term = filters.searchTerm.toLowerCase();
    dpps = dpps.filter(d => 
      d.did.toLowerCase().includes(term) ||
      d.model.toLowerCase().includes(term) ||
      d.owner.toLowerCase().includes(term)
    );
  }

  const count = dpps.length;
  const offset = filters.offset || 0;
  const limit = filters.limit || 50;
  const paginatedDpps = dpps.slice(offset, offset + limit);

  return { data: paginatedDpps, count };
}

export async function getAggregatedMetrics(dppId: string) {
  const allDpps = await localDB.getDPPs();
  const dpp = allDpps.find(d => d.id === dppId);

  if (!dpp || dpp.type !== 'main') {
    return null;
  }

  const childRelations = await localDB.getRelationshipsByParent(dpp.did);
  const children = [];
  
  for (const rel of childRelations) {
    const child = await localDB.getDPPByDID(rel.child_did);
    if (child) children.push(child);
  }

  let totalCO2 = 0;
  let totalRecycledContent = 0;
  let totalRecyclability = 0;
  let count = 0;

  for (const child of children) {
    const specs = await localDB.getSpecificationsByDPP(child.id);
    specs.forEach((spec) => {
      const data = spec.spec_data as Record<string, number>;
      if (data.co2Footprint) totalCO2 += data.co2Footprint;
      if (data.recycledContent) totalRecycledContent += data.recycledContent;
      if (data.recyclability) totalRecyclability += data.recyclability;
      count++;
    });
  }

  return {
    componentCount: children.length,
    aggregatedSustainability: {
      totalCO2Footprint: totalCO2,
      avgRecycledContent: count > 0 ? totalRecycledContent / count : 0,
      avgRecyclability: count > 0 ? totalRecyclability / count : 0,
    },
    components: children,
  };
}

export function exportDPPHierarchyToJSON(hierarchyData: unknown) {
  return JSON.stringify(hierarchyData, null, 2);
}

export function generateQRCodeData(did: string) {
  return {
    did,
    url: `https://example.com/dpp/${encodeURIComponent(did)}`,
    type: 'DPP',
  };
}

export async function getDPPByDID(did: string): Promise<DPP | null> {
  return localDB.getDPPByDID(did);
}

export async function updateDPP(id: string, updates: Partial<DPP>): Promise<DPP | null> {
  return localDB.updateDPP(id, updates);
}
