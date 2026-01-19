/**
 * DID:webvh Type Definitions
 * Based on W3C DID Core and did:webvh v1.0 specifications.
 */

export interface DIDDocument {
  id: string;
  controller?: string | string[];
  verificationMethod?: Array<{
    id: string;
    type: string;
    controller: string;
    publicKeyMultibase?: string;
    publicKeyJwk?: any;
    revoked?: string;
  }>;
  authentication?: string[];
  assertionMethod?: string[];
  capabilityInvocation?: string[];
  capabilityDelegation?: string[];
  service?: Array<{
    id: string;
    type: string;
    serviceEndpoint: string | Record<string, any>;
  }>;
  alsoKnownAs?: string[];
  created?: string;
  updated?: string;
  
  // did:webvh Verifiable Entry fields (when resolved as a state)
  versionId?: string;
  versionTime?: string;
  parameters?: any;
  state?: any;
  proof?: any[];
}

export interface DIDDocumentMetadata {
  created?: string;
  updated?: string;
  versionId?: string;
  nextUpdate?: string;
  nextVersionId?: string;
  equivalentId?: string[];
  canonicalId?: string;
  deactivated?: boolean;
}

export interface DIDResolutionMetadata {
  contentType?: string;
  retrieved?: string;
  error?: string;
  errorMessage?: string;
  driver?: string;
  duration?: number;
}

export interface DIDResolutionResult {
  didDocument: DIDDocument | null;
  didDocumentMetadata: DIDDocumentMetadata;
  didResolutionMetadata: DIDResolutionMetadata;
}

export interface LogEntry {
  versionId: string;
  versionTime: string;
  parameters: {
    prevVersionHash?: string;
    method: string;
    scid?: string;
    witnessThreshold?: number;
    witnesses?: string[];
    updateKeys?: string[];
    [key: string]: any;
  };
  state?: any; // DID Document at this version (optional)
  proof: Array<{
    type: string;
    proofPurpose: string;
    created?: string;
    verificationMethod?: string;
    cryptosuite?: string;
    proofValue?: string;
    merkleRoot?: string;
    path?: string[];
    [key: string]: any;
  }>;
}

export interface DIDVerificationResult {
  valid: boolean;
  did: string;
  versionId: string;
  checks: {
    hashChain: boolean;
    signatures: boolean;
    witnesses: boolean;
  };
  details?: string;
  error?: string;
}
