import { DIDResolutionResult, LogEntry, DIDVerificationResult } from '../../types/didwebvh';

const BACKEND_URL = '/api'; // Proxied by Vite or absolute if needed

export class ResolverApi {
  /**
   * Resolves a DID document using the identity oracle (backend)
   */
  static async resolve(did: string): Promise<DIDResolutionResult> {
    try {
      const response = await fetch(`${BACKEND_URL}/did/${encodeURIComponent(did)}/resolve`);
      if (!response.ok) {
        // Even on 404/500, the backend might return a valid DID Resolution Result with errors
        try {
          const errorData = await response.json();
          if (errorData.didResolutionMetadata || errorData.didDocumentMetadata) {
            return errorData;
          }
        } catch (e) { /* ignore parse error */ }
        
        throw new Error(`Resolution failed: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Resolver API Error (Resolve):', error);
      return {
        didDocument: null,
        didDocumentMetadata: {},
        didResolutionMetadata: {
          error: 'notFound',
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  /**
   * Fetches the verifiable history log for a DID
   */
  static async getLog(did: string): Promise<LogEntry[]> {
    try {
      const response = await fetch(`${BACKEND_URL}/did/${encodeURIComponent(did)}/log`);
      if (!response.ok) {
        throw new Error(`Log retrieval failed: ${response.statusText}`);
      }
      const data = await response.json();
      return data.log || [];
    } catch (error) {
      console.error('Resolver API Error (Log):', error);
      return [];
    }
  }

  /**
   * Verifies the entire hash chain and witnesses for a DID
   */
  static async verify(did: string): Promise<DIDVerificationResult> {
    try {
      const response = await fetch(`${BACKEND_URL}/did/${encodeURIComponent(did)}/verify`);
      if (!response.ok) {
        throw new Error(`Verification failed: ${response.statusText}`);
      }
      const data = await response.json();
      
      return {
        valid: data.valid,
        did: did,
        versionId: data.versionId || '0',
        checks: data.checks || { 
          hashChain: data.valid, 
          signatures: data.valid, 
          witnesses: data.valid 
        },
        error: data.error
      };
    } catch (error) {
      console.error('Resolver API Error (Verify):', error);
      return {
        valid: false,
        did,
        versionId: '0',
        checks: { hashChain: false, signatures: false, witnesses: false },
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

