
export type DPP = {
  id: string;
  did: string;
  type: 'main' | 'component';
  model: string;
  parent_did: string | null;
  lifecycle_status: string;
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

// In-memory storage
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

  // DPPs
  async insertDPP(dpp: Omit<DPP, 'id' | 'created_at' | 'updated_at'>): Promise<DPP> {
    const id = this.generateId();
    const now = new Date().toISOString();
    const newDPP: DPP = { ...dpp, id, created_at: now, updated_at: now };
    this.dpps.set(id, newDPP);
    return newDPP;
  }

  async getDPPs(limit?: number): Promise<DPP[]> {
    const dpps = Array.from(this.dpps.values());
    return limit ? dpps.slice(0, limit) : dpps;
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
    return updated;
  }

  // DID Documents
  async insertDIDDocument(doc: Omit<DIDDocument, 'id' | 'created_at' | 'updated_at'>): Promise<DIDDocument> {
    const id = this.generateId();
    const now = new Date().toISOString();
    const newDoc: DIDDocument = { ...doc, id, created_at: now, updated_at: now };
    this.didDocuments.set(id, newDoc);
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
    return updated;
  }

  // Attestations
  async insertAttestation(att: Omit<WitnessAttestation, 'id' | 'created_at' | 'timestamp'>): Promise<WitnessAttestation> {
    const id = this.generateId();
    const now = new Date().toISOString();
    const newAtt: WitnessAttestation = { ...att, id, created_at: now, timestamp: now };
    this.attestations.set(id, newAtt);
    return newAtt;
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

  // Specifications
  async insertSpecification(spec: Omit<Specification, 'id' | 'created_at' | 'updated_at'>): Promise<Specification> {
    const id = this.generateId();
    const now = new Date().toISOString();
    const newSpec: Specification = { ...spec, id, created_at: now, updated_at: now };
    this.specifications.set(id, newSpec);
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
  }
}

export const localDB = new LocalDataStore();
