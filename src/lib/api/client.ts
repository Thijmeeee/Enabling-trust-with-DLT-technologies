/**
 * API Client
 * 
 * Central HTTP client for all backend API calls.
 * Provides typed methods for Identity, Witness, and Watcher services.
 */

import { apiUrl, API_CONFIG } from './config';

// Types matching backend database schema
export interface Identity {
  did: string;
  scid: string;
  public_key: string;
  owner?: string;
  status: 'active' | 'deactivated';
  created_at: string;
  updated_at: string;
}

export interface DIDEvent {
  id: number;
  did: string;
  event_type: string;
  payload: Record<string, unknown>;
  signature: string;
  leaf_hash: string;
  version_id: string;
  timestamp: string | number;
  witness_proofs: AnchoringProof | null;
  created_at: string;
}

export interface AnchoringProof {
  versionId: string;
  batchId: number;
  merkleRoot: string;
  leafHash: string;
  merkleProof: string[];
  leafIndex: number;
  txHash: string;
  blockNumber: number;
  timestamp: string;
}

export interface Batch {
  batch_id: number;
  merkle_root: string;
  tx_hash: string | null;
  block_number: number | null;
  status: 'pending' | 'anchored' | 'confirmed';
  timestamp: string;
}

export interface Audit {
  id: number;
  did: string;
  check_type: 'hash_chain' | 'merkle_proof';
  status: 'valid' | 'invalid';
  details: string;
  checked_at: string;
}

// API Response types
export interface CreateProductResponse {
  did: string;
  scid: string;
  status: string;
  versionId: string;
}

export interface ApiError {
  error: string;
  details?: string;
}

// HTTP helper with error handling
async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = apiUrl(endpoint);

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error: ApiError = await response.json().catch(() => ({
      error: `HTTP ${response.status}: ${response.statusText}`
    }));
    throw new Error(error.error || 'API request failed');
  }

  return response.json();
}

// ============================================
// Identity Service API
// ============================================

export const identityApi = {
  /**
   * Create a new product with DID
   */
  async createProduct(data: {
    type: string;
    model: string;
    metadata?: Record<string, unknown>;
    ownerDid?: string;
    requestedDid?: string;
  }): Promise<CreateProductResponse> {
    return fetchApi<CreateProductResponse>(API_CONFIG.IDENTITY.CREATE, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Get identity by SCID
   */
  async getIdentity(scid: string): Promise<Identity> {
    return fetchApi<Identity>(`${API_CONFIG.IDENTITY.GET}/${scid}`);
  },

  /**
   * List all identities
   */
  async listIdentities(): Promise<Identity[]> {
    return fetchApi<Identity[]>(API_CONFIG.IDENTITY.LIST);
  },

  /**
   * Add an event to a DID
   */
  async addEvent(data: {
    did: string;
    eventType: string;
    payload: Record<string, unknown>;
  }): Promise<{ status: string; versionId: string }> {
    return fetchApi(`${API_CONFIG.IDENTITY.EVENTS}/add`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Get events for a DID
   */
  async getEvents(did: string): Promise<DIDEvent[]> {
    return fetchApi<DIDEvent[]>(`${API_CONFIG.IDENTITY.EVENTS}?did=${encodeURIComponent(did)}`);
  },

  /**
   * Transfer ownership of a DID
   */
  async transferOwnership(did: string, data: {
    newOwnerDID: string;
    newOwnerPublicKey?: string;
    reason?: string;
    signature: string;
    signerAddress: string;
  }): Promise<{ status: string; versionId: string }> {
    return fetchApi(`${API_CONFIG.IDENTITY.TRANSFER}/${encodeURIComponent(did)}/transfer`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Rotate signing key for a DID
   */
  async rotateKey(did: string, data: {
    newPublicKey: string;
    signature: string;
    signerAddress: string;
  }): Promise<{ status: string; versionId: string }> {
    return fetchApi(`${API_CONFIG.IDENTITY.ROTATE}/${encodeURIComponent(did)}/rotate`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Update DID document data
   */
  async updateDID(did: string, data: {
    updates: any;
    signature: string;
    signerAddress: string;
  }): Promise<{ status: string; versionId: string }> {
    return fetchApi(`${API_CONFIG.IDENTITY.UPDATE}/${encodeURIComponent(did)}/update`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Deactivate a DID
   */
  async deactivateDID(did: string, data: {
    signature: string;
    signerAddress: string;
  }): Promise<{ status: string; versionId: string }> {
    return fetchApi(`${API_CONFIG.IDENTITY.DEACTIVATE}/${encodeURIComponent(did)}/deactivate`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Create a relationship between two DIDs
   */
  async createRelationship(data: {
    parent_did: string;
    child_did: string;
    relationship_type: string;
    position?: number;
    metadata?: Record<string, unknown>;
  }): Promise<{ status: string }> {
    return fetchApi(API_CONFIG.IDENTITY.RELATIONSHIPS, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Get relationships for a DID or all relationships
   */
  async getRelationships(did?: string, type?: 'parent' | 'child' | 'all'): Promise<any[]> {
    let url = API_CONFIG.IDENTITY.RELATIONSHIPS;
    if (did) {
      url = `${url}/${encodeURIComponent(did)}${type ? `?type=${type}` : ''}`;
    }
    return fetchApi<any[]>(url);
  },
};

// ============================================
// Witness Service API
// ============================================

export const witnessApi = {
  /**
   * Request witness attestation for an event
   */
  async requestAttestation(data: {
    scid: string;
    versionId: string;
    leafHash: string;
  }): Promise<{ signature: string; witnessDid: string; timestamp: string }> {
    return fetchApi(API_CONFIG.WITNESS.ATTEST, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Get all batches
   */
  async getBatches(): Promise<Batch[]> {
    return fetchApi<Batch[]>(API_CONFIG.WITNESS.BATCHES);
  },

  /**
   * Get Merkle proof for an event
   */
  async getMerkleProof(eventId: string): Promise<{
    proof: Array<{ position: 'left' | 'right'; data: string }>;
    leaf: string;
    root: string;
    batchId: number;
  }> {
    return fetchApi(`${API_CONFIG.WITNESS.PROOF}/${eventId}`);
  },
};

// ============================================
// Watcher Service API
// ============================================

export const watcherApi = {
  /**
   * Get audit results
   */
  async getAudits(did?: string): Promise<Audit[]> {
    const params = did ? `?did=${encodeURIComponent(did)}` : '';
    return fetchApi<Audit[]>(`${API_CONFIG.WATCHER.AUDITS}${params}`);
  },

  /**
   * Get watcher status
   */
  async getStatus(): Promise<{
    healthy: boolean;
    lastCheck: string;
    activeWatchers: number;
  }> {
    return fetchApi(API_CONFIG.WATCHER.STATUS);
  },

  /**
   * Trigger manual audit for a DID
   */
  async triggerAudit(did: string): Promise<Audit> {
    return fetchApi(`${API_CONFIG.WATCHER.AUDITS}/trigger`, {
      method: 'POST',
      body: JSON.stringify({ did }),
    });
  },

  /**
   * Get all active alerts
   */
  async getAlerts(): Promise<any[]> {
    return fetchApi(API_CONFIG.WATCHER.ALERTS);
  },

  /**
   * Create a new alert
   */
  async createAlert(data: {
    did: string;
    event_id?: number | null;
    reason: string;
    details: string;
    reporter: string;
  }): Promise<any> {
    return fetchApi(API_CONFIG.WATCHER.ALERTS, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Delete alerts for a DID
   */
  async deleteAlerts(did: string, eventId?: string | number): Promise<any> {
    const query = eventId ? `?event_id=${eventId}` : '';
    return fetchApi(`${API_CONFIG.WATCHER.ALERTS}/${encodeURIComponent(did)}${query}`, {
      method: 'DELETE',
    });
  },
};

// ============================================
// Combined API object
// ============================================

export const api = {
  identity: identityApi,
  witness: witnessApi,
  watcher: watcherApi,
};

export default api;
