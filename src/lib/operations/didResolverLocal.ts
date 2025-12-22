/**
 * DID Resolver - Frontend
 * 
 * Resolves did:webvh DIDs using the backend API.
 * Supports local fallback for demo data compatibility.
 * 
 * Features:
 * - Resolve DID via backend /api/did/:did/resolve
 * - Parse DID components
 * - Verification status display
 * - Historical version support
 */

import { localDB, type DIDDocument } from '../data/localData';

// Backend API base URL
const API_BASE = 'http://localhost:3000';

// ============================================
// Types
// ============================================

export interface ResolvedDID {
  did: string;
  document: DIDDocument | any;
  metadata: {
    versionId?: string;
    versionTime?: string;
    verified?: boolean;
    created?: string;
    updated?: string;
  };
  verified: boolean;
  log?: any[];
}

export interface ParsedDID {
  method: string;
  domain: string;
  scid: string;
  path: string;
}

// ============================================
// DID Resolution Functions
// ============================================

/**
 * Fetch the DID log (did.jsonl entries)
 */
export async function fetchDIDLog(did: string): Promise<any[] | null> {
  try {
    const response = await fetch(
      `${API_BASE}/api/did/${encodeURIComponent(did)}/log`,
      { headers: { 'Accept': 'application/json' } }
    );

    if (response.ok) {
      const result = await response.json();
      return result.log || [];
    }
  } catch (error) {
    console.warn('[Resolver] Could not fetch DID log:', error);
  }

  return null;
}

/**
 * Resolve a DID using the backend API
 * Falls back to local storage for demo data compatibility
 */
export async function resolveDID(
  did: string,
  options?: {
    versionId?: string;
    versionTime?: string;
    includeLog?: boolean;
  }
): Promise<ResolvedDID | null> {
  // Try backend API first
  try {
    const params = new URLSearchParams();
    if (options?.versionId) params.set('versionId', options.versionId);
    if (options?.versionTime) params.set('versionTime', options.versionTime);

    const queryString = params.toString();
    const url = `${API_BASE}/api/did/${encodeURIComponent(did)}/resolve${queryString ? '?' + queryString : ''}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });

    if (response.ok) {
      const result = await response.json();

      // Optionally fetch log
      let log: any[] | undefined;
      if (options?.includeLog) {
        const fetchedLog = await fetchDIDLog(did);
        log = fetchedLog ?? undefined;
      }

      return {
        did: result.did,
        document: result.document,
        metadata: result.metadata || {},
        verified: result.verified ?? false,
        log
      };
    }

    // If 404, try local fallback
    if (response.status === 404) {
      console.log('[Resolver] DID not found in backend, trying local storage');
    } else {
      console.warn('[Resolver] Backend error:', response.status);
    }
  } catch (error) {
    console.warn('[Resolver] Backend unavailable, using local fallback:', error);
  }

  // Local fallback for demo data
  const localDoc = localDB.getDIDDocumentByDID(did);
  if (localDoc) {
    return {
      did,
      document: localDoc,
      metadata: {
        verified: false, // Local data not verified
        versionId: '1'
      },
      verified: false
    };
  }

  return null;
}

/**
 * Verify a DID - calls backend verification endpoint
 */
export async function verifyDID(did: string): Promise<{
  valid: boolean;
  details: string;
  hashChain: boolean;
  signatures: boolean;
}> {
  try {
    // Resolve and check verified status
    const resolved = await resolveDID(did, { includeLog: true });

    if (!resolved) {
      return {
        valid: false,
        details: 'DID not found',
        hashChain: false,
        signatures: false
      };
    }

    return {
      valid: resolved.verified,
      details: resolved.verified ? 'DID verified' : 'DID not verified (demo data)',
      hashChain: resolved.log ? resolved.log.length > 0 : false,
      signatures: resolved.verified
    };
  } catch (error: any) {
    return {
      valid: false,
      details: `Verification failed: ${error.message}`,
      hashChain: false,
      signatures: false
    };
  }
}

// ============================================
// DID Parsing Functions
// ============================================

/**
 * Parse a DID into its components
 * Format: did:webvh:{domain}:{scid}
 */
export function parseDID(did: string): ParsedDID {
  const parts = did.split(':');

  // did:webvh:domain:scid
  return {
    method: parts[1] || '',
    domain: parts[2] || '',
    scid: parts[3] || '',
    path: parts.slice(3).join(':') || ''
  };
}

/**
 * Transform DID to HTTPS URL for did.jsonl
 * did:webvh:example.com:abc123 -> https://example.com/.well-known/did/abc123/did.jsonl
 */
export function didToHttpsUrl(did: string): string {
  const parsed = parseDID(did);

  // Handle localhost with port
  const domain = parsed.domain.includes(':')
    ? `http://${parsed.domain}`
    : `https://${parsed.domain}`;

  return `${domain}/.well-known/did/${parsed.scid}/did.jsonl`;
}

/**
 * Check if a DID uses the webvh method
 */
export function isWebVHDID(did: string): boolean {
  return did.startsWith('did:webvh:');
}

/**
 * Extract SCID from a DID
 */
export function extractSCID(did: string): string {
  const parsed = parseDID(did);
  return parsed.scid;
}

// ============================================
// DID Operations (calls backend)
// ============================================

/**
 * Update a DID document via backend API
 */
export async function updateDID(
  did: string,
  keyId: string,
  updates: { document?: any }
): Promise<{ success: boolean; versionId?: string; error?: string }> {
  try {
    const response = await fetch(
      `${API_BASE}/api/did/${encodeURIComponent(did)}/update`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyId, updates })
      }
    );

    if (response.ok) {
      const result = await response.json();
      return { success: true, versionId: result.versionId };
    }

    const error = await response.json();
    return { success: false, error: error.error || 'Update failed' };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Deactivate a DID via backend API
 */
export async function deactivateDID(
  did: string,
  keyId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(
      `${API_BASE}/api/did/${encodeURIComponent(did)}/deactivate`,
      {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyId })
      }
    );

    if (response.ok) {
      return { success: true };
    }

    const error = await response.json();
    return { success: false, error: error.error || 'Deactivation failed' };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ============================================
// Export
// ============================================

export default {
  resolveDID,
  fetchDIDLog,
  verifyDID,
  parseDID,
  didToHttpsUrl,
  isWebVHDID,
  extractSCID,
  updateDID,
  deactivateDID
};
