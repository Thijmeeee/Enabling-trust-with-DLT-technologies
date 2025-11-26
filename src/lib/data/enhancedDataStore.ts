/**
 * Enhanced Data Store with Indexing, Caching, and Multi-level Hierarchy Support
 */

import { DPP, DIDDocument, DPPRelationship, AnchoringEvent, VerifiableCredential, 
         WitnessAttestation, Specification, Watcher, WatcherAlert } from './localData';

// Search index for fast lookups
type SearchIndex = {
  byDID: Map<string, string>; // did -> dpp_id
  byModel: Map<string, Set<string>>; // model -> Set<dpp_id>
  byOwner: Map<string, Set<string>>; // owner -> Set<dpp_id>
  byType: Map<string, Set<string>>; // type -> Set<dpp_id>
  byStatus: Map<string, Set<string>>; // status -> Set<dpp_id>
  byProductType: Map<string, Set<string>>; // productType -> Set<dpp_id>
  fullText: Map<string, Set<string>>; // searchTerm -> Set<dpp_id>
};

// Cache for computed results
type CacheEntry<T> = {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in ms
};

export class EnhancedDataStore {
  private dpps: Map<string, DPP> = new Map();
  private didDocuments: Map<string, DIDDocument> = new Map();
  private relationships: Map<string, DPPRelationship> = new Map();
  private anchoringEvents: Map<string, AnchoringEvent> = new Map();
  private credentials: Map<string, VerifiableCredential> = new Map();
  private attestations: Map<string, WitnessAttestation> = new Map();
  private specifications: Map<string, Specification> = new Map();
  private watchers: Map<string, Watcher> = new Map();
  private alerts: Map<string, WatcherAlert> = new Map();
  
  // Indexes
  private searchIndex: SearchIndex = {
    byDID: new Map(),
    byModel: new Map(),
    byOwner: new Map(),
    byType: new Map(),
    byStatus: new Map(),
    byProductType: new Map(),
    fullText: new Map(),
  };
  
  // Hierarchy cache
  private hierarchyCache: Map<string, CacheEntry<any>> = new Map();
  
  // Cache TTL (5 minutes)
  private readonly CACHE_TTL = 5 * 60 * 1000;
  
  private idCounter = 0;
  
  private generateId(): string {
    return `${Date.now()}-${this.idCounter++}`;
  }
  
  // ========== Indexing Methods ==========
  
  private addToIndex(dpp: DPP): void {
    // DID index
    this.searchIndex.byDID.set(dpp.did, dpp.id);
    
    // Model index
    if (!this.searchIndex.byModel.has(dpp.model)) {
      this.searchIndex.byModel.set(dpp.model, new Set());
    }
    this.searchIndex.byModel.get(dpp.model)!.add(dpp.id);
    
    // Owner index
    if (!this.searchIndex.byOwner.has(dpp.owner)) {
      this.searchIndex.byOwner.set(dpp.owner, new Set());
    }
    this.searchIndex.byOwner.get(dpp.owner)!.add(dpp.id);
    
    // Type index
    if (!this.searchIndex.byType.has(dpp.type)) {
      this.searchIndex.byType.set(dpp.type, new Set());
    }
    this.searchIndex.byType.get(dpp.type)!.add(dpp.id);
    
    // Status index
    if (!this.searchIndex.byStatus.has(dpp.lifecycle_status)) {
      this.searchIndex.byStatus.set(dpp.lifecycle_status, new Set());
    }
    this.searchIndex.byStatus.get(dpp.lifecycle_status)!.add(dpp.id);
    
    // Product type index (extracted from metadata or model)
    const productType = this.extractProductType(dpp);
    if (!this.searchIndex.byProductType.has(productType)) {
      this.searchIndex.byProductType.set(productType, new Set());
    }
    this.searchIndex.byProductType.get(productType)!.add(dpp.id);
    
    // Full-text index
    this.indexFullText(dpp);
  }
  
  // Note: removeFromIndex not currently used but kept for future delete operations
  /*
  private removeFromIndex(dpp: DPP): void {
    this.searchIndex.byDID.delete(dpp.did);
    this.searchIndex.byModel.get(dpp.model)?.delete(dpp.id);
    this.searchIndex.byOwner.get(dpp.owner)?.delete(dpp.id);
    this.searchIndex.byType.get(dpp.type)?.delete(dpp.id);
    this.searchIndex.byStatus.get(dpp.lifecycle_status)?.delete(dpp.id);
    
    // Clear from full-text
    for (const [_term, ids] of this.searchIndex.fullText.entries()) {
      ids.delete(dpp.id);
    }
  }
  */
  
  private indexFullText(dpp: DPP): void {
    const terms = [
      dpp.did,
      dpp.model,
      dpp.owner,
      dpp.type,
      dpp.lifecycle_status,
      ...Object.values(dpp.metadata).map(v => String(v)),
    ].join(' ').toLowerCase().split(/\s+/);
    
    for (const term of terms) {
      if (term.length < 2) continue;
      if (!this.searchIndex.fullText.has(term)) {
        this.searchIndex.fullText.set(term, new Set());
      }
      this.searchIndex.fullText.get(term)!.add(dpp.id);
    }
  }
  
  private extractProductType(dpp: DPP): string {
    // Try to extract from metadata
    if (dpp.metadata.productType) {
      return String(dpp.metadata.productType);
    }
    
    // Fallback: infer from model name
    const model = dpp.model.toLowerCase();
    if (model.includes('window')) return 'window';
    if (model.includes('glass')) return 'glass';
    if (model.includes('frame')) return 'frame';
    if (model.includes('door')) return 'door';
    
    return 'unknown';
  }
  
  // ========== Cache Methods ==========
  
  private getCached<T>(key: string): T | null {
    const entry = this.hierarchyCache.get(key);
    if (!entry) return null;
    
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.hierarchyCache.delete(key);
      return null;
    }
    
    return entry.data as T;
  }
  
  private setCache<T>(key: string, data: T, ttl: number = this.CACHE_TTL): void {
    this.hierarchyCache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }
  
  private invalidateCache(pattern?: string): void {
    if (!pattern) {
      this.hierarchyCache.clear();
      return;
    }
    
    for (const key of this.hierarchyCache.keys()) {
      if (key.includes(pattern)) {
        this.hierarchyCache.delete(key);
      }
    }
  }
  
  // ========== CRUD Operations ==========
  
  async insertDPP(data: Omit<DPP, 'id' | 'created_at' | 'updated_at'>): Promise<DPP> {
    const id = this.generateId();
    const now = new Date().toISOString();
    const newDPP: DPP = {
      ...data,
      id,
      created_at: now,
      updated_at: now,
    };
    
    this.dpps.set(id, newDPP);
    this.addToIndex(newDPP);
    this.invalidateCache(newDPP.did);
    
    return newDPP;
  }
  
  async getDPPById(id: string): Promise<DPP | null> {
    return this.dpps.get(id) || null;
  }
  
  async getDPPByDID(did: string): Promise<DPP | null> {
    const id = this.searchIndex.byDID.get(did);
    return id ? this.dpps.get(id) || null : null;
  }
  
  async getAllDPPs(): Promise<DPP[]> {
    return Array.from(this.dpps.values());
  }
  
  async updateDPP(id: string, updates: Partial<DPP>): Promise<DPP | null> {
    const dpp = this.dpps.get(id);
    if (!dpp) return null;
    
    // Deep merge metadata if it's being updated
    const updated = { 
      ...dpp, 
      ...updates, 
      metadata: updates.metadata ? { ...dpp.metadata, ...updates.metadata } : dpp.metadata,
      updated_at: new Date().toISOString() 
    };
    
    this.dpps.set(id, updated);
    
    // Update indexes if relevant fields changed
    if (updates.did || updates.model || updates.owner || updates.type || 
        updates.lifecycle_status || updates.metadata) {
      // Re-index the updated DPP
      this.addToIndex(updated);
    }
    
    // Invalidate relevant caches
    this.invalidateCache(updated.did);
    
    return updated;
  }
  
  // ========== Advanced Query Methods ==========
  
  async searchDPPs(query: {
    text?: string;
    type?: 'main' | 'component';
    productType?: string;
    componentSubType?: 'glass' | 'frame' | '';
    status?: string;
    owner?: string;
    model?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ dpps: DPP[]; total: number }> {
    let resultIds = new Set<string>(Array.from(this.dpps.keys()));
    
    // Apply filters
    if (query.type) {
      const typeIds = this.searchIndex.byType.get(query.type);
      if (typeIds) {
        resultIds = new Set([...resultIds].filter(id => typeIds.has(id)));
      } else {
        resultIds.clear();
      }
    }
    
    if (query.productType) {
      const ptIds = this.searchIndex.byProductType.get(query.productType);
      if (ptIds) {
        resultIds = new Set([...resultIds].filter(id => ptIds.has(id)));
      } else {
        resultIds.clear();
      }
    }
    
    // Component sub-type filter (glass or frame)
    if (query.componentSubType) {
      const subTypeIds = this.searchIndex.byProductType.get(query.componentSubType);
      if (subTypeIds) {
        resultIds = new Set([...resultIds].filter(id => subTypeIds.has(id)));
      } else {
        resultIds.clear();
      }
    }
    
    if (query.status) {
      const statusIds = this.searchIndex.byStatus.get(query.status);
      if (statusIds) {
        resultIds = new Set([...resultIds].filter(id => statusIds.has(id)));
      } else {
        resultIds.clear();
      }
    }
    
    if (query.owner) {
      const ownerIds = this.searchIndex.byOwner.get(query.owner);
      if (ownerIds) {
        resultIds = new Set([...resultIds].filter(id => ownerIds.has(id)));
      } else {
        resultIds.clear();
      }
    }
    
    if (query.model) {
      const modelIds = this.searchIndex.byModel.get(query.model);
      if (modelIds) {
        resultIds = new Set([...resultIds].filter(id => modelIds.has(id)));
      } else {
        resultIds.clear();
      }
    }
    
    // Full-text search
    if (query.text) {
      const terms = query.text.toLowerCase().split(/\s+/);
      const textIds = new Set<string>();
      
      for (const term of terms) {
        const matchingIds = this.searchIndex.fullText.get(term);
        if (matchingIds) {
          matchingIds.forEach(id => textIds.add(id));
        }
      }
      
      if (textIds.size > 0) {
        resultIds = new Set([...resultIds].filter(id => textIds.has(id)));
      } else if (terms.length > 0) {
        resultIds.clear();
      }
    }
    
    const total = resultIds.size;
    const ids = Array.from(resultIds);
    
    // Apply pagination
    const offset = query.offset || 0;
    const limit = query.limit || 50;
    const paginatedIds = ids.slice(offset, offset + limit);
    
    const dpps = paginatedIds
      .map(id => this.dpps.get(id))
      .filter((dpp): dpp is DPP => dpp !== undefined);
    
    return { dpps, total };
  }
  
  // ========== Hierarchy Methods with Multi-level Support ==========
  
  async getFullHierarchy(did: string, maxDepth: number = 10): Promise<any> {
    const cacheKey = `hierarchy:${did}:${maxDepth}`;
    const cached = this.getCached<any>(cacheKey);
    if (cached) return cached;
    
    const dpp = await this.getDPPByDID(did);
    if (!dpp) return null;
    
    const result = {
      dpp,
      children: await this.getChildrenRecursive(did, maxDepth, 0),
      depth: 0,
    };
    
    this.setCache(cacheKey, result);
    return result;
  }
  
  private async getChildrenRecursive(
    parentDid: string,
    maxDepth: number,
    currentDepth: number
  ): Promise<any[]> {
    if (currentDepth >= maxDepth) return [];
    
    const relationships = Array.from(this.relationships.values())
      .filter(r => r.parent_did === parentDid)
      .sort((a, b) => a.position - b.position);
    
    const children = [];
    for (const rel of relationships) {
      const childDpp = await this.getDPPByDID(rel.child_did);
      if (childDpp) {
        children.push({
          dpp: childDpp,
          relationship: rel,
          children: await this.getChildrenRecursive(rel.child_did, maxDepth, currentDepth + 1),
          depth: currentDepth + 1,
        });
      }
    }
    
    return children;
  }
  
  async getAncestryPath(did: string): Promise<DPP[]> {
    const path: DPP[] = [];
    let currentDid: string | null = did;
    
    while (currentDid) {
      const dpp = await this.getDPPByDID(currentDid);
      if (!dpp) break;
      
      path.unshift(dpp);
      currentDid = dpp.parent_did;
    }
    
    return path;
  }
  
  // ========== Relationship Operations ==========
  
  async insertRelationship(data: Omit<DPPRelationship, 'id' | 'created_at' | 'updated_at'>): Promise<DPPRelationship> {
    const id = this.generateId();
    const now = new Date().toISOString();
    const newRel: DPPRelationship = {
      ...data,
      id,
      created_at: now,
      updated_at: now,
    };
    
    this.relationships.set(id, newRel);
    this.invalidateCache(data.parent_did);
    this.invalidateCache(data.child_did);
    
    return newRel;
  }
  
  async getRelationshipsByParent(parentDid: string): Promise<DPPRelationship[]> {
    return Array.from(this.relationships.values())
      .filter(r => r.parent_did === parentDid)
      .sort((a, b) => a.position - b.position);
  }
  
  async getRelationshipsByChild(childDid: string): Promise<DPPRelationship[]> {
    return Array.from(this.relationships.values())
      .filter(r => r.child_did === childDid);
  }
  
  // ========== Other Entity Operations ==========
  
  async insertDIDDocument(data: Omit<DIDDocument, 'id' | 'created_at' | 'updated_at'>): Promise<DIDDocument> {
    const id = this.generateId();
    const now = new Date().toISOString();
    const doc: DIDDocument = { ...data, id, created_at: now, updated_at: now };
    this.didDocuments.set(id, doc);
    return doc;
  }
  
  async getDIDDocumentByDID(did: string): Promise<DIDDocument | null> {
    return Array.from(this.didDocuments.values()).find(d => d.did === did) || null;
  }
  
  async insertAnchoringEvent(event: Omit<AnchoringEvent, 'id' | 'timestamp'>): Promise<AnchoringEvent> {
    const id = this.generateId();
    const timestamp = new Date().toISOString();
    const newEvent: AnchoringEvent = { ...event, id, timestamp };
    this.anchoringEvents.set(id, newEvent);
    return newEvent;
  }
  
  async getAnchoringEventsByDID(did: string): Promise<AnchoringEvent[]> {
    return Array.from(this.anchoringEvents.values()).filter(e => e.did === did);
  }
  
  async insertCredential(data: Omit<VerifiableCredential, 'id' | 'created_at'>): Promise<VerifiableCredential> {
    const id = this.generateId();
    const cred: VerifiableCredential = { ...data, id, created_at: new Date().toISOString() };
    this.credentials.set(id, cred);
    return cred;
  }
  
  async getCredentialsByDPPId(dppId: string): Promise<VerifiableCredential[]> {
    return Array.from(this.credentials.values()).filter(c => c.dpp_id === dppId);
  }
  
  async insertAttestation(data: Omit<WitnessAttestation, 'id' | 'timestamp' | 'created_at'>): Promise<WitnessAttestation> {
    const id = this.generateId();
    const now = new Date().toISOString();
    const att: WitnessAttestation = { ...data, id, timestamp: now, created_at: now };
    this.attestations.set(id, att);
    return att;
  }
  
  async updateAttestation(id: string, updates: Partial<WitnessAttestation>): Promise<WitnessAttestation | null> {
    const existing = this.attestations.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...updates };
    this.attestations.set(id, updated);
    return updated;
  }
  
  async getAttestationsByDID(did: string): Promise<WitnessAttestation[]> {
    return Array.from(this.attestations.values()).filter(a => a.did === did);
  }
  
  async insertSpecification(data: Omit<Specification, 'id' | 'created_at' | 'updated_at'>): Promise<Specification> {
    const id = this.generateId();
    const now = new Date().toISOString();
    const spec: Specification = { ...data, id, created_at: now, updated_at: now };
    this.specifications.set(id, spec);
    return spec;
  }
  
  async getSpecificationsByDPPId(dppId: string): Promise<Specification[]> {
    return Array.from(this.specifications.values()).filter(s => s.dpp_id === dppId);
  }
  
  async insertWatcher(data: Omit<Watcher, 'id' | 'created_at'>): Promise<Watcher> {
    const id = this.generateId();
    const watcher: Watcher = { ...data, id, created_at: new Date().toISOString() };
    this.watchers.set(id, watcher);
    return watcher;
  }
  
  async getAllWatchers(): Promise<Watcher[]> {
    return Array.from(this.watchers.values());
  }
  
  async insertAlert(data: Omit<WatcherAlert, 'id' | 'created_at'>): Promise<WatcherAlert> {
    const id = this.generateId();
    const alert: WatcherAlert = { ...data, id, created_at: new Date().toISOString() };
    this.alerts.set(id, alert);
    return alert;
  }
  
  async getAlertsByWatcherId(watcherId: string): Promise<WatcherAlert[]> {
    return Array.from(this.alerts.values()).filter(a => a.watcher_id === watcherId);
  }
  
  async getAlertsByWatcherDID(watcherDID: string): Promise<WatcherAlert[]> {
    return Array.from(this.alerts.values()).filter(a => a.watcher_did === watcherDID);
  }
  
  // ========== Bulk Operations ==========
  
  async bulkInsertDPPs(dpps: Omit<DPP, 'id' | 'created_at' | 'updated_at'>[]): Promise<DPP[]> {
    const results: DPP[] = [];
    for (const dpp of dpps) {
      results.push(await this.insertDPP(dpp));
    }
    return results;
  }
  
  async clearAll(): Promise<void> {
    this.dpps.clear();
    this.didDocuments.clear();
    this.relationships.clear();
    this.anchoringEvents.clear();
    this.credentials.clear();
    this.attestations.clear();
    this.specifications.clear();
    this.watchers.clear();
    this.alerts.clear();
    
    // Clear indexes
    this.searchIndex = {
      byDID: new Map(),
      byModel: new Map(),
      byOwner: new Map(),
      byType: new Map(),
      byStatus: new Map(),
      byProductType: new Map(),
      fullText: new Map(),
    };
    
    this.invalidateCache();
    this.idCounter = 0;
  }
  
  // ========== Statistics ==========
  
  async getStats(): Promise<{
    totalDPPs: number;
    mainProducts: number;
    components: number;
    byProductType: Record<string, number>;
    byStatus: Record<string, number>;
  }> {
    const dpps = Array.from(this.dpps.values());
    
    return {
      totalDPPs: dpps.length,
      mainProducts: dpps.filter(d => d.type === 'main').length,
      components: dpps.filter(d => d.type === 'component').length,
      byProductType: Object.fromEntries(
        Array.from(this.searchIndex.byProductType.entries()).map(([type, ids]) => [type, ids.size])
      ),
      byStatus: Object.fromEntries(
        Array.from(this.searchIndex.byStatus.entries()).map(([status, ids]) => [status, ids.size])
      ),
    };
  }
}

export const enhancedDB = new EnhancedDataStore();
