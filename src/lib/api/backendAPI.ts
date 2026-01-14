/**
 * Backend API Service
 * Connects frontend to real backend services (Identity, Witness, Watcher)
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export interface BackendIdentity {
    did: string;
    scid: string;
    public_key: string;
    status: string;
    created_at: string;
}

export interface BackendEvent {
    id: number;
    did: string;
    event_type: string;
    payload: Record<string, unknown>;
    version_id: string;
    witness_proofs: { batchId: number } | null;
    created_at: string;
}

export interface BackendBatch {
    batch_id: number;
    merkle_root: string;
    tx_hash: string;
    block_number: number;
    status: string;
    timestamp: string;
}

export interface BackendAudit {
    id: number;
    did: string;
    check_type: string;
    status: string;
    details: string;
    checked_at: string;
}

export interface WatcherAlert {
    id: number;
    did: string;
    event_id: number | null;
    reason: string;
    details: string;
    reporter: string;
    created_at: string;
}

class BackendAPI {
    private baseUrl: string;

    constructor(baseUrl: string = API_BASE_URL) {
        this.baseUrl = baseUrl;
    }

    private async fetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options?.headers,
            },
        });

        if (!response.ok) {
            throw new Error(`API Error: ${response.status} ${response.statusText}`);
        }

        return response.json();
    }

    // Identity Service APIs
    async getIdentities(): Promise<BackendIdentity[]> {
        return this.fetch<BackendIdentity[]>('/api/identities');
    }

    async getIdentity(scid: string): Promise<BackendIdentity | null> {
        try {
            return await this.fetch<BackendIdentity>(`/api/identity/${scid}`);
        } catch {
            return null;
        }
    }

    async createProduct(data: { type: string; model: string; metadata?: Record<string, unknown> }): Promise<{
        did: string;
        scid: string;
        status: string;
        versionId: string;
    }> {
        return this.fetch('/api/products/create', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    // Witness Service APIs (via database proxy)
    async getBatches(): Promise<BackendBatch[]> {
        try {
            return await this.fetch<BackendBatch[]>('/api/batches');
        } catch {
            return [];
        }
    }

    async getBatchByDID(did: string): Promise<BackendBatch | null> {
        try {
            // Get events for this DID first, then get their batch info
            const events = await this.getEventsByDID(did);
            if (events.length > 0 && events[0].witness_proofs?.batchId !== undefined) {
                const batches = await this.getBatches();
                return batches.find(b => b.batch_id === events[0].witness_proofs?.batchId) || null;
            }
            return null;
        } catch {
            return null;
        }
    }

    async getEventsByDID(did: string): Promise<BackendEvent[]> {
        try {
            return await this.fetch<BackendEvent[]>(`/api/events?did=${encodeURIComponent(did)}`);
        } catch {
            return [];
        }
    }

    // Watcher Service APIs
    async getAuditsByDID(did: string): Promise<BackendAudit[]> {
        try {
            return await this.fetch<BackendAudit[]>(`/api/audits?did=${encodeURIComponent(did)}`);
        } catch {
            return [];
        }
    }

    async getAllAudits(): Promise<BackendAudit[]> {
        try {
            return await this.fetch<BackendAudit[]>('/api/audits');
        } catch {
            return [];
        }
    }

    // Watcher Alerts
    async getWatcherAlerts(did?: string): Promise<WatcherAlert[]> {
        try {
            const query = did ? `?did=${encodeURIComponent(did)}` : '';
            return await this.fetch<WatcherAlert[]>(`/api/watcher/alerts${query}`);
        } catch {
            return [];
        }
    }

    async createWatcherAlert(alert: Omit<WatcherAlert, 'id' | 'created_at'>): Promise<WatcherAlert | null> {
        try {
            return await this.fetch<WatcherAlert>('/api/watcher/alerts', {
                method: 'POST',
                body: JSON.stringify(alert),
            });
        } catch {
            return null;
        }
    }

    // Health check
    async healthCheck(): Promise<{ status: string; service: string }> {
        return this.fetch('/health');
    }
}

export const backendAPI = new BackendAPI();
export default backendAPI;
