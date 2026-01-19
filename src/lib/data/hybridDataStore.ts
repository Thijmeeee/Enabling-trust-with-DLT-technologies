/**
 * Hybrid Data Store
 * 
 * Provides a unified interface that:
 * 1. Uses the real backend API when available
 * 2. Falls back to local in-memory data when backend is unavailable
 * 
 * This allows the app to work offline/demo mode while supporting production.
 */

import { api, blockchainClient, etherscanBlockUrl } from '../api';
import { API_CONFIG } from '../api/config';
import type { Identity, DIDEvent, Batch, Audit } from '../api/client';
import { localDB } from './localData';
import type { DPP, AnchoringEvent, WitnessAttestation, WatcherAlert, DPPRelationship } from './localData';
import { enhancedDB } from './enhancedDataStore';

// Mode configuration
let useBackendApi = true;
let backendAvailable = false;
let lastHealthCheck = 0;
const HEALTH_CHECK_INTERVAL = 30000; // 30 seconds

// Cache for backend DPPs to avoid repeated API calls
let cachedDPPs: DPP[] = [];
let cacheTimestamp = 0;
const CACHE_TTL = 10000; // 10 seconds

/**
 * Check if backend API is available
 */
async function checkBackendHealth(): Promise<boolean> {
  const now = Date.now();
  if (now - lastHealthCheck < HEALTH_CHECK_INTERVAL) {
    return backendAvailable;
  }

  try {
    // Use the same base URL as the API config, but hit /health endpoint
    const baseUrl = API_CONFIG.BASE_URL.replace('/api', '');
    const response = await fetch(`${baseUrl}/health`, { method: 'GET' });
    backendAvailable = response.ok;
    console.log(`[HybridDataStore] Backend health check: ${backendAvailable ? 'available' : 'unavailable'}`);
  } catch {
    backendAvailable = false;
    console.log('[HybridDataStore] Backend health check: unavailable (connection error)');
  }

  lastHealthCheck = now;
  return backendAvailable;
}

/**
 * Set whether to use backend API or local data
 */
export function setUseBackendApi(use: boolean): void {
  useBackendApi = use;
}

/**
 * Get current mode
 */
export function getDataStoreMode(): { useBackend: boolean; backendAvailable: boolean } {
  return { useBackend: useBackendApi, backendAvailable };
}

// ============================================
// DPP / Identity Operations
// ============================================


/**
 * Get all DPPs/Identities
 */
export async function getAllDPPs(): Promise<DPP[]> {
  if (useBackendApi) {
    try {
      await checkBackendHealth();
      if (backendAvailable) {
        const identities = await api.identity.listIdentities();

        // Fetch events to get model/type from create event payloads
        const dpps: DPP[] = [];

        // Fetch all alerts once to avoid N+1 and allow status overwriting
        const allAlerts = await getAllAlerts();
        const tamperedDids = new Set(allAlerts.filter(a => !a.resolved).map(a => a.did));

        for (const identity of identities) {
          // Use metadata directly from optimized backend query
          const payload = (identity as any).metadata as any;

          let effectiveStatus = identity.status || 'active';
          if (tamperedDids.has(identity.did)) {
            effectiveStatus = 'tampered';
          }

          // Harmonize metadata for UI expectations
          const metadata = payload || {};
          if (payload?.type && !payload.productType) {
            metadata.productType = payload.type;
          }

          dpps.push({
            id: identity.scid,
            did: identity.did,
            type: (payload?.type === 'window' || payload?.type === 'main') ? 'main' : 'component',
            model: payload?.model || `Product-${identity.scid.substring(0, 8)}`,
            parent_did: null,
            lifecycle_status: effectiveStatus,
            owner: identity.owner || 'did:webvh:unknown:owner',
            custodian: null,
            metadata: metadata,
            version: 1,
            previous_version_id: null,
            created_at: identity.created_at,
            updated_at: identity.updated_at,
          });
        }

        console.log('[HybridDataStore] Loaded', dpps.length, 'DPPs from backend. Sample owner:', dpps[0]?.owner);
        return dpps;
      }
    } catch (e) {
      console.warn('Backend unavailable, using local data:', e);
    }
  }

  return localDB.getDPPs();
}

/**
 * Get DPP by DID
 */
export async function getDPPByDID(did: string): Promise<DPP | null> {
  if (useBackendApi) {
    try {
      // Use getCachedDPPs which ensures cache is populated and backend is checked
      const allDPPs = await getCachedDPPs();
      const cached = allDPPs.find(d => d.did === did);
      if (cached) {
        console.log('[HybridDataStore] getDPPByDID: Found in cache:', did);
        return cached;
      }

      // If not in cache but backend available, try direct fetch
      if (backendAvailable) {
        const scid = extractScidFromDid(did);
        if (scid) {
          console.log('[HybridDataStore] getDPPByDID: Fetching from backend:', scid);
          const identity = await api.identity.getIdentity(scid);

          // Fetch events to get model/type like getAllDPPs does
          const events = await api.identity.getEvents(did);
          const createEvent = events.find(e => e.event_type === 'create');
          const payload = createEvent?.payload as { type?: string; model?: string } | undefined;

          return {
            id: identity.scid,
            did: identity.did,
            type: payload?.type === 'window' ? 'main' : 'main',
            model: payload?.model || `Product-${identity.scid.substring(0, 8)}`,
            parent_did: null,
            lifecycle_status: identity.status,
            owner: identity.owner || 'did:webvh:unknown:owner',
            custodian: null,
            metadata: payload || {},
            version: 1,
            previous_version_id: null,
            created_at: identity.created_at,
            updated_at: identity.updated_at,
          };
        }
      }
    } catch (e) {
      console.warn('[HybridDataStore] getDPPByDID: Backend fetch failed:', e);
    }
  }

  return localDB.getDPPByDID(did);
}

/**
 * Create a new product/DPP
 */
export async function createProduct(data: {
  type: string;
  model: string;
  metadata?: Record<string, unknown>;
}): Promise<{ did: string; scid: string }> {
  if (useBackendApi && backendAvailable) {
    try {
      const result = await api.identity.createProduct(data);
      return { did: result.did, scid: result.scid };
    } catch (e) {
      console.warn('Backend create failed, using local:', e);
    }
  }

  // Fallback to local
  const dpp = await localDB.insertDPP({
    did: `did:webvh:z${generateId()}:demo.local`,
    type: 'main',
    model: data.model,
    parent_did: null,
    lifecycle_status: 'created',
    owner: 'demo-owner',
    custodian: null,
    metadata: data.metadata || {},
    version: 1,
    previous_version_id: null,
  });

  return { did: dpp.did, scid: dpp.did.split(':')[2] };
}

// ============================================
// Anchoring / Blockchain Operations
// ============================================

/**
 * Get anchoring events for a DID
 */
export async function getAnchoringEventsByDID(did: string): Promise<AnchoringEvent[]> {
  if (useBackendApi && backendAvailable) {
    try {
      const events = await api.identity.getEvents(did);
      return events
        .filter(e => e.witness_proofs?.batchId !== undefined)
        .map(eventToAnchoringEvent);
    } catch (e) {
      console.warn('Backend fetch failed, using local:', e);
    }
  }

  return localDB.getAnchoringEventsByDID(did);
}

/**
 * Get all batches from witness service
 */
export async function getAllBatches(): Promise<Batch[]> {
  if (useBackendApi && backendAvailable) {
    try {
      return await api.witness.getBatches();
    } catch (e) {
      console.warn('Backend fetch failed:', e);
    }
  }

  // No local fallback for batches - return empty
  return [];
}

/**
 * Get blockchain verification status
 */
export async function getBlockchainVerification(batchId: number, expectedRoot: string): Promise<{
  verified: boolean;
  onChainRoot: string;
  blockNumber: number;
  etherscanUrl: string;
} | null> {
  try {
    const result = await blockchainClient.verifyOnChain(batchId, expectedRoot);
    return {
      verified: result.verified,
      onChainRoot: result.onChainRoot,
      blockNumber: result.blockNumber,
      etherscanUrl: result.etherscanBlockUrl,
    };
  } catch (e) {
    console.warn('Blockchain verification failed:', e);
    return null;
  }
}

/**
 * Get recent blockchain anchors with Etherscan links
 */
export async function getRecentBlockchainAnchors(count: number = 10): Promise<Array<{
  batchId: number;
  merkleRoot: string;
  blockNumber: number;
  timestamp: Date;
  txHash?: string;
  etherscanTxUrl?: string | null;
  etherscanBlockUrl: string | null;
}>> {
  try {
    // First try to get from contract events (has tx hashes)
    const events = await blockchainClient.getAnchoredEvents(0);
    return events.slice(0, count).map(e => ({
      batchId: e.batchId,
      merkleRoot: e.root,
      blockNumber: e.blockNumber,
      timestamp: new Date(e.timestamp * 1000),
      txHash: e.transactionHash,
      etherscanTxUrl: e.etherscanTxUrl,
      etherscanBlockUrl: etherscanBlockUrl(e.blockNumber),
    }));
  } catch (e) {
    console.warn('Failed to get blockchain anchors:', e);

    // Fallback to batch info without tx hashes
    try {
      const batches = await blockchainClient.getRecentBatches(count);
      return batches.map(b => ({
        batchId: b.batchId,
        merkleRoot: b.merkleRoot,
        blockNumber: b.blockNumber,
        timestamp: new Date(b.timestamp * 1000),
        etherscanBlockUrl: b.etherscanBlockUrl,
      }));
    } catch {
      return [];
    }
  }
}

// ============================================
// Witness / Attestation Operations
// ============================================

/**
 * Get attestations for a DID
 * Merges backend attestations (from events) with local attestations (UI-added)
 */
export async function getAttestationsByDID(did: string): Promise<WitnessAttestation[]> {
  // Always get local attestations (includes UI-added approved operations)
  const localAttestations = await localDB.getAttestationsByDID(did);

  // If backend is available, also fetch backend attestations and merge
  if (useBackendApi && backendAvailable) {
    try {
      const events = await api.identity.getEvents(did);
      const backendAttestations: WitnessAttestation[] = [];

      for (const event of events) {
        if (event.witness_proofs?.witnesses) {
          for (const witness of event.witness_proofs.witnesses) {
            backendAttestations.push({
              id: `${event.id}-${witness.witnessDid}`,
              dpp_id: '', // Will be filled by caller if needed
              did: event.did,
              witness_did: witness.witnessDid,
              attestation_type: event.event_type,
              attestation_data: event.payload,
              signature: witness.signature,
              timestamp: witness.timestamp,
              created_at: event.created_at,
              approval_status: 'approved' as const, // Backend events are considered approved
            });
          }
        } else if (event.signature) {
          // Handle events with a direct signature but no witness array (new format)
          backendAttestations.push({
            id: String(event.id),
            dpp_id: '', // Will be filled by caller if needed
            did: event.did,
            witness_did: event.witness_proofs?.batchId ? `batch-${event.witness_proofs.batchId}` : 'creator',
            attestation_type: event.event_type,
            attestation_data: event.payload,
            signature: event.signature,
            witness_proofs: event.witness_proofs, // Pass through Merkle proof info for visualization
            version_id: event.version_id, // Pass through version info for lookup
            timestamp: event.timestamp || event.created_at,
            created_at: event.created_at,
            approval_status: 'approved' as const,
          });
        }
      }

      // Merge: combine backend + local, avoiding duplicates by ID
      const seen = new Set<string>();
      const merged: WitnessAttestation[] = [];

      // Local attestations take priority (they're more recent)
      for (const att of localAttestations) {
        if (!seen.has(att.id)) {
          seen.add(att.id);
          merged.push(att);
        }
      }

      // Add backend attestations that weren't in local
      for (const att of backendAttestations) {
        if (!seen.has(att.id)) {
          seen.add(att.id);
          merged.push(att);
        }
      }

      return merged;
    } catch (e) {
      console.warn('Backend fetch failed, using local only:', e);
    }
  }

  return localAttestations;
}

// ============================================
// Watcher / Audit Operations
// ============================================

/**
 * Get audits for a DID
 */
export async function getAuditsByDID(did: string): Promise<Audit[]> {
  if (useBackendApi && backendAvailable) {
    try {
      return await api.watcher.getAudits(did);
    } catch (e) {
      console.warn('Backend fetch failed:', e);
    }
  }

  // No direct audit equivalent in local data
  return [];
}

/**
 * Get watcher status
 */
export async function getWatcherStatus(): Promise<{
  healthy: boolean;
  lastCheck: string;
  activeWatchers: number;
}> {
  if (useBackendApi && backendAvailable) {
    try {
      return await api.watcher.getStatus();
    } catch (e) {
      console.warn('Backend fetch failed:', e);
    }
  }

  // Fallback to local watchers
  const watchers = await localDB.getWatchers();
  return {
    healthy: true,
    lastCheck: new Date().toISOString(),
    activeWatchers: watchers.filter(w => w.active).length,
  };
}

/**
 * Get all alerts
 */
/**
 * Get all alerts
 * Includes backend alerts and local-only flags
 */
export async function getAllAlerts(): Promise<WatcherAlert[]> {
  const localAlerts = await localDB.getAlerts();

  if (useBackendApi && backendAvailable) {
    try {
      const backendAlerts = await api.watcher.getAlerts();

      // Merge: unique by DID + Reason
      const seen = new Set<string>();
      const merged: WatcherAlert[] = [...localAlerts];

      merged.forEach(a => seen.add(`${a.did}-${a.reason}-${a.event_id || 'global'}`));

      backendAlerts.forEach(a => {
        const key = `${a.did}-${a.reason}-${a.event_id || 'global'}`;
        if (!seen.has(key)) {
          seen.add(key);
          merged.push({
            ...a,
            id: a.id || `backend-${a.did}-${a.reason}`
          });
        }
      });

      if (backendAlerts.length > 0) {
        console.log('[HybridDataStore] Backend alerts:', backendAlerts.length, 'Merged total:', merged.length);
      }

      return merged;
    } catch (err) {
      console.warn('Error fetching alerts from backend:', err);
      return localAlerts;
    }
  }

  return localAlerts;
}

/**
 * Get credentials by DPP ID
 */
export async function getCredentialsByDPPId(dppId: string): Promise<any[]> {
  const { enhancedDB } = await import('./enhancedDataStore');
  return enhancedDB.getCredentialsByDPPId(dppId);
}

/**
 * Update an alert
 */
export async function updateAlert(alertId: string, updates: Partial<WatcherAlert>): Promise<WatcherAlert | null> {
  return localDB.updateAlert(alertId, updates);
}

/**
 * Get alerts by DID
 */
export async function getAlertsByDID(did: string): Promise<WatcherAlert[]> {
  const allAlerts = await getAllAlerts();
  const dppScid = extractScidFromDid(did);

  return allAlerts.filter(a => {
    const alertScid = extractScidFromDid(a.did);
    return alertScid === dppScid;
  });
}

/**
 * Clear all alerts
 */
export async function clearAllAlerts(): Promise<void> {
  const { enhancedDB } = await import('./enhancedDataStore');
  await enhancedDB.clearAlerts();
}

/**
 * Clear alerts for a specific DID
 */
export async function clearAlertsByDID(did: string): Promise<void> {
  const { enhancedDB } = await import('./enhancedDataStore');
  await enhancedDB.clearAlertsByDID(did);
}

/**
 * Get DID Document - generates on-the-fly if not found
 */
export async function getDIDDocumentByDID(did: string) {
  // First, try to get from enhancedDB
  const { enhancedDB } = await import('./enhancedDataStore');
  const existingDoc = await enhancedDB.getDIDDocumentByDID(did);
  if (existingDoc) {
    return existingDoc;
  }

  // If not found, generate a DID document from identity/DPP data
  const dpp = await getDPPByDID(did);
  if (dpp) {
    // Generate a basic DID document from the DPP data
    const didDocument = {
      id: `diddoc-${dpp.id}`,
      did: did,
      dpp_id: dpp.id,
      controller: dpp.owner || did,
      verification_method: [
        {
          id: `${did}#key-1`,
          type: 'Ed25519VerificationKey2020',
          controller: did,
          publicKeyMultibase: 'z6MkhaXgBZDvotDkLqmQYz8eTqEDGxh8ukMoQoM2RiEgPseQ'
        }
      ],
      authentication: [`${did}#key-1`],
      assertion_method: [`${did}#key-1`],
      service: [
        {
          id: `${did}#product-service`,
          type: 'ProductPassport',
          serviceEndpoint: `https://dpp.example.com/products/${dpp.id}`
        }
      ],
      service_endpoints: [`https://dpp.example.com/products/${dpp.id}`],
      proof: {},
      document_metadata: {},
      created_at: dpp.created_at,
      updated_at: dpp.updated_at || dpp.created_at
    };

    return didDocument;
  }

  return null;
}

/**
 * Insert DPP (for forms)
 */
export async function insertDPP(data: Omit<DPP, 'id' | 'created_at' | 'updated_at'>) {
  if (useBackendApi && backendAvailable) {
    try {
      const result = await api.identity.createProduct({
        type: data.type,
        model: data.model,
        metadata: data.metadata as Record<string, unknown>,
      });
      return { ...data, id: result.scid, did: result.did, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    } catch (e) {
      console.warn('Backend insert failed, using local:', e);
    }
  }
  return localDB.insertDPP(data);
}

/**
 * Insert Relationship
 */
export async function insertRelationship(data: { parent_did: string; child_did: string; relationship_type: string; position?: number; metadata?: Record<string, any> }) {
  if (useBackendApi && backendAvailable) {
    try {
      const result = await api.identity.createRelationship(data);
      return {
        id: result.id,
        parent_did: result.parent_did,
        child_did: result.child_did,
        relationship_type: result.relationship_type,
        created_at: result.created_at
      };
    } catch (e) {
      console.warn('Backend insert relationship failed, using local:', e);
    }
  }

  const { enhancedDB } = await import('./enhancedDataStore');
  return enhancedDB.insertRelationship({
    ...data,
    position: data.position ?? 0,
    metadata: data.metadata ?? {},
  });
}

/**
 * Insert DID Document
 */
export async function insertDIDDocument(data: any) {
  const { enhancedDB } = await import('./enhancedDataStore');
  return enhancedDB.insertDIDDocument(data);
}

/**
 * Get relationships by parent DID
 */
export async function getRelationshipsByParent(parentDid: string): Promise<any[]> {
  if (useBackendApi && backendAvailable) {
    try {
      const relationships = await api.identity.getRelationships(parentDid, 'child');
      return relationships;
    } catch (e) {
      console.warn('Backend fetch relationships failed, using local:', e);
    }
  }

  const { enhancedDB } = await import('./enhancedDataStore');
  return enhancedDB.getRelationshipsByParent(parentDid);
}

/**
 * Get relationships by child DID
 */
export async function getRelationshipsByChild(childDid: string): Promise<any[]> {
  if (useBackendApi && backendAvailable) {
    try {
      const relationships = await api.identity.getRelationships(childDid, 'parent');
      return relationships;
    } catch (e) {
      console.warn('Backend fetch relationships failed, using local:', e);
    }
  }

  const { enhancedDB } = await import('./enhancedDataStore');
  return enhancedDB.getRelationshipsByChild(childDid);
}

/**
 * Insert Attestation
 */
export async function insertAttestation(data: Omit<WitnessAttestation, 'id' | 'created_at'>) {
  return localDB.insertAttestation(data);
}

/**
 * Insert Anchoring Event
 */
export async function insertAnchoringEvent(data: Omit<AnchoringEvent, 'id'>) {
  return localDB.insertAnchoringEvent(data);
}

// ============================================
// Helper Functions
// ============================================

function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

function extractScidFromDid(did: string): string | null {
  if (!did) return null;
  try {
    const parts = did.split(':');
    const lastPart = parts[parts.length - 1];
    return lastPart.split('?')[0].split('#')[0].trim();
  } catch (e) {
    return (did || '').split(':').pop() || null;
  }
}

function identityToDPP(identity: Identity): DPP {
  return {
    id: identity.scid,
    did: identity.did,
    type: 'main',
    model: 'Unknown', // Would need additional metadata
    parent_did: null,
    lifecycle_status: identity.status,
    owner: identity.owner || 'Unknown',
    custodian: null,
    metadata: {},
    version: 1,
    previous_version_id: null,
    created_at: identity.created_at,
    updated_at: identity.updated_at,
  };
}

function eventToAnchoringEvent(event: DIDEvent): AnchoringEvent {
  const batchId = event.witness_proofs?.batchId;
  return {
    id: String(event.id),
    dpp_id: '',
    did: event.did,
    transaction_hash: '', // Would need to fetch from batch
    block_number: 0, // Would need to fetch from batch
    merkle_root: null,
    component_hashes: null,
    anchor_type: event.event_type,
    timestamp: new Date(event.timestamp).toISOString(),
    metadata: { batchId, versionId: event.version_id },
  };
}

// ============================================
// Export combined interface
// ============================================

async function getCachedDPPs(): Promise<DPP[]> {
  const now = Date.now();
  if (now - cacheTimestamp < CACHE_TTL && cachedDPPs.length > 0) {
    return cachedDPPs;
  }
  cachedDPPs = await getAllDPPs();
  cacheTimestamp = now;
  return cachedDPPs;
}

/**
 * Get stats from backend data
 */
async function getStats(): Promise<{
  totalDPPs: number;
  mainProducts: number;
  components: number;
  byProductType: Record<string, number>;
  byStatus: Record<string, number>;
}> {
  const dpps = await getCachedDPPs();

  const byProductType: Record<string, number> = {};
  const byStatus: Record<string, number> = {};

  for (const dpp of dpps) {
    // Count by product type (inferred from model)
    const productType = dpp.model.toLowerCase().includes('window') ? 'window' :
      dpp.model.toLowerCase().includes('glass') ? 'glass' :
        dpp.model.toLowerCase().includes('frame') ? 'frame' : 'other';
    byProductType[productType] = (byProductType[productType] || 0) + 1;

    // Count by status
    byStatus[dpp.lifecycle_status] = (byStatus[dpp.lifecycle_status] || 0) + 1;
  }

  return {
    totalDPPs: dpps.length,
    mainProducts: dpps.filter(d => d.type === 'main').length,
    components: dpps.filter(d => d.type === 'component').length,
    byProductType,
    byStatus,
  };
}

/**
 * Search DPPs from backend data
 */
async function searchDPPs(query: {
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
  let dpps = await getCachedDPPs();

  // Apply filters
  if (query.type) {
    dpps = dpps.filter(d => d.type === query.type);
  }

  if (query.status) {
    dpps = dpps.filter(d => d.lifecycle_status === query.status);
  }

  if (query.owner) {
    dpps = dpps.filter(d => d.owner === query.owner);
  }

  if (query.model) {
    dpps = dpps.filter(d => d.model.toLowerCase().includes(query.model!.toLowerCase()));
  }

  if (query.text) {
    const searchText = query.text.toLowerCase();
    dpps = dpps.filter(d =>
      d.model.toLowerCase().includes(searchText) ||
      d.did.toLowerCase().includes(searchText) ||
      d.lifecycle_status.toLowerCase().includes(searchText)
    );
  }

  if (query.productType) {
    dpps = dpps.filter(d => {
      const pt = d.model.toLowerCase().includes('window') ? 'window' :
        d.model.toLowerCase().includes('glass') ? 'glass' :
          d.model.toLowerCase().includes('frame') ? 'frame' : 'other';
      return pt === query.productType;
    });
  }

  const total = dpps.length;

  // Apply pagination
  const offset = query.offset || 0;
  const limit = query.limit || 50;
  dpps = dpps.slice(offset, offset + limit);

  return { dpps, total };
}

/**
 * Clear cache (no actual data deletion since data is in backend)
 */
async function clearAll(): Promise<void> {
  cachedDPPs = [];
  cacheTimestamp = 0;
  console.log('[HybridDataStore] Cache cleared');
}

/**
 * Get DPP by ID (string ID)
 * Used by WitnessDashboard and DID operations
 */
async function getDPPById(id: string): Promise<DPP | null> {
  try {
    const allDPPs = await getCachedDPPs();
    // ID could be the scid or internal id
    const found = allDPPs.find(d => d.id === id || extractScidFromDid(d.did) === id);
    if (found) {
      console.log('[HybridDataStore] getDPPById: Found:', id);
      return found;
    }
  } catch (e) {
    console.warn('[HybridDataStore] getDPPById: Error:', e);
  }

  // Fallback: try to find by DID if ID looks like a DID
  if (id.startsWith('did:')) {
    return localDB.getDPPByDID(id);
  }

  // Search all local DPPs
  const localDPPs = await localDB.getDPPs();
  return localDPPs.find(d => d.id === id) || null;
}

/**
 * Update DPP
 * Note: For backend mode, this only updates local cache/storage
 * Real backend updates would require API endpoint
 */
async function updateDPP(id: string, updates: Partial<DPP>): Promise<DPP | null> {
  try {
    // Update in localDB for now (backend doesn't have update endpoint yet)
    const updated = await localDB.updateDPP(id, updates);

    // Also invalidate cache so next fetch gets fresh data
    cacheTimestamp = 0;

    return updated;
  } catch (e) {
    console.warn('[HybridDataStore] updateDPP: Error:', e);
    return null;
  }
}

/**
 * Update Attestation status
 * Used by WitnessDashboard for approving/rejecting events
 */
async function updateAttestation(
  attestationId: string,
  updates: Partial<WitnessAttestation>
): Promise<WitnessAttestation | null> {
  try {
    // Update in localDB (backend would need API endpoint)
    const updated = await localDB.updateAttestation(attestationId, updates);
    return updated;
  } catch (e) {
    console.warn('[HybridDataStore] updateAttestation: Error:', e);
    return null;
  }
}


export const hybridDataStore = {
  // Mode
  setUseBackendApi,
  getDataStoreMode,

  // DPP/Identity
  getAllDPPs,
  getDPPByDID,
  getDPPById,
  createProduct,
  insertDPP,
  updateDPP,

  // Stats & Search (now implemented for backend data)
  getStats,
  searchDPPs,
  clearAll,

  // Anchoring/Blockchain
  getAnchoringEventsByDID,
  getAllBatches,
  getBlockchainVerification,
  getRecentBlockchainAnchors,
  insertAnchoringEvent,

  // Witness
  getAttestationsByDID,
  insertAttestation,
  updateAttestation,
  getAlertsByDID,
  getCredentialsByDPPId,

  // Watcher
  getAuditsByDID,
  getWatcherStatus,
  getAllAlerts,
  updateAlert,
  clearAllAlerts,
  clearAlertsByDID,

  // DID Documents
  getDIDDocumentByDID,
  insertDIDDocument,
  insertRelationship,
  getRelationshipsByParent,
  getRelationshipsByChild,
};

export default hybridDataStore;
