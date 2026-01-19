/**
 * @title AnchoringProof Interface
 * @description Based on did:webvh v1.0 Specification (Section 7.2: Witnesses)
 * Stores blockchain anchoring metadata for Merkle proof verification.
 */
export interface AnchoringProof {
  versionId: string;        // From DID log entry
  batchId: number;          // Blockchain batch ID
  merkleRoot: string;       // Root anchored on-chain
  leafHash: string;         // Hash for this version
  merkleProof: string[];    // Sibling hashes for verification
  leafIndex: number;        // Position in Merkle tree
  txHash: string;           // Blockchain transaction hash
  blockNumber: number;      // Block where anchored
  timestamp: string;        // ISO timestamp
  chainId?: string;         // Optional: for multi-chain
}

/**
 * @title WitnessFile Type
 * @description Represents the structure of did-witness.json
 */
export type WitnessFile = AnchoringProof[];
