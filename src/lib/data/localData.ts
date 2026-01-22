import { LifecycleStatus } from '../types/lifecycle';

export type DPP = {
  id: string;
  did: string;
  type: 'main' | 'component';
  model: string;
  parent_did: string | null;
  lifecycle_status: LifecycleStatus | string; // Allow string for backward compatibility during migration
  owner: string;
  custodian: string | null;
  metadata: Record<string, unknown>;
  version: number;
  previous_version_id: string | null;
  created_at: string;
  updated_at: string;
};

export type DIDDocument = {
  id: string;
  dpp_id: string;
  did: string;
  controller: string;
  verification_method: unknown[];
  service_endpoints: unknown[];
  proof: Record<string, unknown>;
  document_metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type DPPRelationship = {
  id: string;
  parent_did: string;
  child_did: string;
  relationship_type: string;
  position: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type AnchoringEvent = {
  id: string;
  dpp_id: string;
  did: string;
  transaction_hash: string;
  block_number: number;
  merkle_root: string | null;
  component_hashes: unknown;
  anchor_type: string;
  timestamp: string;
  metadata: Record<string, unknown>;
};

export type VerifiableCredential = {
  id: string;
  dpp_id: string;
  credential_id: string;
  issuer: string;
  credential_type: string;
  credential_data: Record<string, unknown>;
  issued_date: string;
  expiry_date: string | null;
  verification_status: string;
  created_at: string;
};

export type Watcher = {
  id: string;
  name: string;
  watcher_type: string;
  monitored_dids: string[];
  config: Record<string, unknown>;
  active: boolean;
  last_check: string | null;
  created_at: string;
};

export type WatcherAlert = {
  id: string;
  watcher_id: string;
  watcher_did: string;
  dpp_id: string | null;
  did: string | null;
  alert_type: string;
  severity: 'info' | 'warning' | 'critical';
  description: string;
  message: string;
  details: Record<string, unknown>;
  status: 'active' | 'resolved';
  resolved: boolean;
  detected_at: string;
  created_at: string;
  // Backend compatibility fields
  reason?: string;
  event_id?: number | null;
  reporter?: string;
};

export type WitnessAttestation = {
  id: string;
  dpp_id: string;
  did: string;
  witness_did: string;
  attestation_type: string;
  attestation_data: Record<string, unknown>;
  signature: string;
  timestamp: string;
  created_at: string;
  approval_status?: 'pending' | 'approved' | 'rejected';
  witness_status?: 'pending' | 'anchored';
  tx_hash?: string;
  witness_proofs?: any; // Add witness proofs for Merkle Tree visualization
  version_id?: string;
  leaf_hash?: string;
};

export type Specification = {
  id: string;
  dpp_id: string;
  spec_type: string;
  spec_data: Record<string, unknown>;
  supplier: string | null;
  created_at: string;
  updated_at: string;
};

// In-memory storage with optional persistence
class LocalDataStore {
  private dpps: Map<string, DPP> = new Map();
  private didDocuments: Map<string, DIDDocument> = new Map();
  private relationships: Map<string, DPPRelationship> = new Map();
  private anchoringEvents: Map<string, AnchoringEvent> = new Map();
  private credentials: Map<string, VerifiableCredential> = new Map();
  private watchers: Map<string, Watcher> = new Map();
  private alerts: Map<string, WatcherAlert> = new Map();
  private attestations: Map<string, WitnessAttestation> = new Map();
  private specifications: Map<string, Specification> = new Map();

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    try {
      const data = localStorage.getItem('dpp_local_storage');
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed.dpps) this.dpps = new Map(parsed.dpps);
        if (parsed.didDocuments) this.didDocuments = new Map(parsed.didDocuments);
        if (parsed.relationships) this.relationships = new Map(parsed.relationships);
        if (parsed.anchoringEvents) this.anchoringEvents = new Map(parsed.anchoringEvents);
        if (parsed.credentials) this.credentials = new Map(parsed.credentials);
        if (parsed.watchers) this.watchers = new Map(parsed.watchers);
        if (parsed.alerts) this.alerts = new Map(parsed.alerts);
        if (parsed.attestations) this.attestations = new Map(parsed.attestations);
        if (parsed.specifications) this.specifications = new Map(parsed.specifications);
        console.log(`[LocalDataStore] Loaded ${this.dpps.size} DPPs from storage`);
      }
    } catch (e) {
      console.error('[LocalDataStore] Failed to load from storage', e);
    }
  }

  private saveTimer: any = null;
  private saveToStorage() {
    if (this.saveTimer) return;

    // Debounce saves to prevent performance death during bulk inserts
    this.saveTimer = setTimeout(() => {
      try {
        const data = JSON.stringify({
          dpps: Array.from(this.dpps.entries()),
          didDocuments: Array.from(this.didDocuments.entries()),
          relationships: Array.from(this.relationships.entries()),
          anchoringEvents: Array.from(this.anchoringEvents.entries()),
          credentials: Array.from(this.credentials.entries()),
          watchers: Array.from(this.watchers.entries()),
          alerts: Array.from(this.alerts.entries()),
          attestations: Array.from(this.attestations.entries()),
          specifications: Array.from(this.specifications.entries()),
        });
        localStorage.setItem('dpp_local_storage', data);
      } catch (e) {
        console.error('[LocalDataStore] Failed to save to storage', e);
      } finally {
        this.saveTimer = null;
      }
    }, 1000); // Wait 1 second after last change
  }

  // DPPs
  async insertDPP(dpp: Omit<DPP, 'id' | 'created_at' | 'updated_at'>): Promise<DPP> {
    const id = this.generateId();
    const now = new Date().toISOString();
    const newDPP: DPP = { ...dpp, id, created_at: now, updated_at: now };
    this.dpps.set(id, newDPP);
    this.saveToStorage();
    return newDPP;
  }

  async getDPPs(limit?: number): Promise<DPP[]> {
    const dpps = Array.from(this.dpps.values());
    return limit ? dpps.slice(0, limit) : dpps;
  }

  async getDPP(id: string): Promise<DPP | null> {
    return this.dpps.get(id) || null;
  }

  async getDPPByDID(did: string): Promise<DPP | null> {
    return Array.from(this.dpps.values()).find(d => d.did === did) || null;
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
    this.saveToStorage();
    return updated;
  }

  // DID Documents
  async insertDIDDocument(doc: Omit<DIDDocument, 'id' | 'created_at' | 'updated_at'>): Promise<DIDDocument> {
    const id = this.generateId();
    const now = new Date().toISOString();
    const newDoc: DIDDocument = { ...doc, id, created_at: now, updated_at: now };
    this.didDocuments.set(id, newDoc);
    this.saveToStorage();
    return newDoc;
  }

  async getDIDDocumentByDID(did: string): Promise<DIDDocument | null> {
    return Array.from(this.didDocuments.values()).find(d => d.did === did) || null;
  }

  // Relationships
  async insertRelationship(rel: Omit<DPPRelationship, 'id' | 'created_at' | 'updated_at'>): Promise<DPPRelationship> {
    const id = this.generateId();
    const now = new Date().toISOString();
    const newRel: DPPRelationship = { ...rel, id, created_at: now, updated_at: now };
    this.relationships.set(id, newRel);
    this.saveToStorage();
    return newRel;
  }

  async getRelationshipsByParent(parentDid: string): Promise<DPPRelationship[]> {
    return Array.from(this.relationships.values()).filter(r => r.parent_did === parentDid);
  }

  async getRelationshipsByChild(childDid: string): Promise<DPPRelationship[]> {
    return Array.from(this.relationships.values()).filter(r => r.child_did === childDid);
  }

  // Anchoring Events
  async insertAnchoringEvent(event: Omit<AnchoringEvent, 'id' | 'timestamp'>): Promise<AnchoringEvent> {
    const id = this.generateId();
    const timestamp = new Date().toISOString();
    const newEvent: AnchoringEvent = { ...event, id, timestamp };
    this.anchoringEvents.set(id, newEvent);
    this.saveToStorage();
    return newEvent;
  }

  async getAnchoringEventsByDID(did: string): Promise<AnchoringEvent[]> {
    return Array.from(this.anchoringEvents.values()).filter(e => e.did === did);
  }

  // Credentials
  async insertCredential(cred: Omit<VerifiableCredential, 'id' | 'created_at'>): Promise<VerifiableCredential> {
    const id = this.generateId();
    const created_at = new Date().toISOString();
    const newCred: VerifiableCredential = { ...cred, id, created_at };
    this.credentials.set(id, newCred);
    this.saveToStorage();
    return newCred;
  }

  async getCredentialsByDPP(dppId: string): Promise<VerifiableCredential[]> {
    return Array.from(this.credentials.values()).filter(c => c.dpp_id === dppId);
  }

  // Watchers
  async insertWatcher(watcher: Omit<Watcher, 'id' | 'created_at'>): Promise<Watcher> {
    const id = this.generateId();
    const created_at = new Date().toISOString();
    const newWatcher: Watcher = { ...watcher, id, created_at };
    this.watchers.set(id, newWatcher);
    this.saveToStorage();
    return newWatcher;
  }

  async getWatchers(): Promise<Watcher[]> {
    return Array.from(this.watchers.values());
  }

  // Alerts
  async insertAlert(alert: Omit<WatcherAlert, 'id' | 'created_at'>): Promise<WatcherAlert> {
    const id = this.generateId();
    const created_at = new Date().toISOString();
    const newAlert: WatcherAlert = { ...alert, id, created_at };
    this.alerts.set(id, newAlert);
    this.saveToStorage();
    return newAlert;
  }

  async getAlerts(): Promise<WatcherAlert[]> {
    return Array.from(this.alerts.values()).sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  async updateAlert(id: string, updates: Partial<WatcherAlert>): Promise<WatcherAlert | null> {
    const alert = this.alerts.get(id);
    if (!alert) return null;
    const updated = { ...alert, ...updates };
    this.alerts.set(id, updated);
    this.saveToStorage();
    return updated;
  }

  // Attestations
  async insertAttestation(att: Omit<WitnessAttestation, 'id' | 'created_at' | 'timestamp'>): Promise<WitnessAttestation> {
    const id = this.generateId();
    const now = new Date().toISOString();
    const newAtt: WitnessAttestation = { ...att, id, created_at: now, timestamp: now };
    this.attestations.set(id, newAtt);
    this.saveToStorage();
    return newAtt;
  }

  async updateAttestation(id: string, updates: Partial<WitnessAttestation>): Promise<WitnessAttestation | null> {
    const existing = this.attestations.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...updates };
    this.attestations.set(id, updated);
    this.saveToStorage();
    return updated;
  }

  async getAttestationsByDID(did: string): Promise<WitnessAttestation[]> {
    return Array.from(this.attestations.values()).filter(a => a.did === did);
  }

  // Specifications
  async insertSpecification(spec: Omit<Specification, 'id' | 'created_at' | 'updated_at'>): Promise<Specification> {
    const id = this.generateId();
    const now = new Date().toISOString();
    const newSpec: Specification = { ...spec, id, created_at: now, updated_at: now };
    this.specifications.set(id, newSpec);
    this.saveToStorage();
    return newSpec;
  }

  async getSpecificationsByDPP(dppId: string): Promise<Specification[]> {
    return Array.from(this.specifications.values()).filter(s => s.dpp_id === dppId);
  }

  // Utility
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  clear() {
    this.dpps.clear();
    this.didDocuments.clear();
    this.relationships.clear();
    this.anchoringEvents.clear();
    this.credentials.clear();
    this.watchers.clear();
    this.alerts.clear();
    this.attestations.clear();
    this.specifications.clear();
    localStorage.removeItem('dpp_local_storage');
  }
}

export const localDB = new LocalDataStore();
