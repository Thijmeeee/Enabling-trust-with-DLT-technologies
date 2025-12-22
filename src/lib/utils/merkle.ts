/**
 * Merkle Tree Verification Utilities
 * 
 * Provides client-side verification of Merkle proofs for DPP events.
 * Referenced in PRODUCTION_CODE.md § 4.1
 */

import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';

export interface MerkleProofItem {
  position: 'left' | 'right';
  data: string;
}

export interface MerkleVerificationResult {
  valid: boolean;
  computedRoot: string;
}

/**
 * Verify a Merkle proof against an expected root
 * 
 * @param leafHash - The hash of the leaf node (event hash)
 * @param proof - Array of sibling hashes with position info
 * @param root - The expected Merkle root (from blockchain)
 * @returns Object containing validity and computed root
 */
export function verifyMerkleProof(
  leafHash: string,
  proof: MerkleProofItem[],
  root: string
): MerkleVerificationResult {
  // Normalize leaf hash (remove 0x prefix if present)
  const normalizedLeafHash = leafHash.startsWith('0x') ? leafHash.slice(2) : leafHash;
  let currentHash = hexToBytes(normalizedLeafHash);
  
  for (const item of proof) {
    // Normalize sibling data
    const siblingHex = item.data.startsWith('0x') ? item.data.slice(2) : item.data;
    const sibling = hexToBytes(siblingHex);
    const combined = new Uint8Array(currentHash.length + sibling.length);
    
    if (item.position === 'left') {
      // Sibling is on the left, so: hash(sibling || current)
      combined.set(sibling);
      combined.set(currentHash, sibling.length);
    } else {
      // Sibling is on the right, so: hash(current || sibling)
      combined.set(currentHash);
      combined.set(sibling, currentHash.length);
    }
    
    currentHash = sha256(combined);
  }
  
  const computedRoot = '0x' + bytesToHex(currentHash);
  const normalizedRoot = root.startsWith('0x') ? root : '0x' + root;
  
  return {
    valid: computedRoot.toLowerCase() === normalizedRoot.toLowerCase(),
    computedRoot
  };
}

/**
 * Compute the hash of a string or object (for leaf nodes)
 * 
 * @param data - The data to hash (string or serializable object)
 * @returns Hex string of the hash with 0x prefix
 */
export function computeHash(data: string | object): string {
  const input = typeof data === 'string' ? data : JSON.stringify(data);
  const encoder = new TextEncoder();
  const bytes = encoder.encode(input);
  const hash = sha256(bytes);
  return '0x' + bytesToHex(hash);
}

/**
 * Verify the hash chain integrity of a DID log
 * Each entry should have a backlink hash pointing to the previous entry
 * 
 * @param entries - Array of log entries in order
 * @returns Object with validity status and any broken links
 */
export interface HashChainEntry {
  versionId: string | number;
  logEntryHash?: string;
  backlink?: string;
  [key: string]: unknown;
}

export interface HashChainVerificationResult {
  valid: boolean;
  brokenLinks: Array<{
    versionId: string | number;
    expected: string;
    actual: string;
  }>;
}

export function verifyHashChain(entries: HashChainEntry[]): HashChainVerificationResult {
  const brokenLinks: HashChainVerificationResult['brokenLinks'] = [];
  
  if (entries.length === 0) {
    return { valid: true, brokenLinks: [] };
  }
  
  // First entry (genesis) should have no backlink or empty backlink
  for (let i = 1; i < entries.length; i++) {
    const currentEntry = entries[i];
    const previousEntry = entries[i - 1];
    
    // Compute what the backlink SHOULD be
    const expectedBacklink = previousEntry.logEntryHash || computeHash(previousEntry);
    const actualBacklink = currentEntry.backlink;
    
    if (actualBacklink && expectedBacklink.toLowerCase() !== actualBacklink.toLowerCase()) {
      brokenLinks.push({
        versionId: currentEntry.versionId,
        expected: expectedBacklink,
        actual: actualBacklink
      });
    }
  }
  
  return {
    valid: brokenLinks.length === 0,
    brokenLinks
  };
}

/**
 * Verify witness signatures on an event
 * In production, this would verify Ed25519 signatures
 * 
 * @param event - The event data
 * @param witnessProofs - Array of witness attestations
 * @returns Object with validity and count of valid witnesses
 */
export interface WitnessProof {
  witnessDid: string;
  signature: string;
  timestamp: string | number;
}

export interface WitnessVerificationResult {
  valid: boolean;
  validCount: number;
  totalCount: number;
  threshold: number;
}

export function verifyWitnessSignatures(
  _event: object,
  witnessProofs: WitnessProof[],
  threshold: number = 1
): WitnessVerificationResult {
  // In a production environment, this would:
  // 1. Fetch the witness public keys from their DIDs
  // 2. Verify each Ed25519 signature against the event hash
  // 3. Return true only if threshold is met
  
  // For demo purposes, we verify that proofs exist and have valid structure
  const validProofs = witnessProofs.filter(proof => 
    proof.witnessDid && 
    proof.signature && 
    proof.signature.length > 0 &&
    proof.timestamp
  );
  
  return {
    valid: validProofs.length >= threshold,
    validCount: validProofs.length,
    totalCount: witnessProofs.length,
    threshold
  };
}

/**
 * Build a Merkle tree from an array of leaf hashes
 * Returns the root hash
 * 
 * @param leaves - Array of leaf hashes (hex strings)
 * @returns The Merkle root hash
 */
export function buildMerkleRoot(leaves: string[]): string {
  if (leaves.length === 0) {
    return '0x' + bytesToHex(sha256(new Uint8Array(0)));
  }
  
  if (leaves.length === 1) {
    return leaves[0].startsWith('0x') ? leaves[0] : '0x' + leaves[0];
  }
  
  // Normalize all leaves
  let level = leaves.map(leaf => {
    const normalized = leaf.startsWith('0x') ? leaf.slice(2) : leaf;
    return hexToBytes(normalized);
  });
  
  // Build tree level by level
  while (level.length > 1) {
    const nextLevel: Uint8Array[] = [];
    
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = i + 1 < level.length ? level[i + 1] : level[i]; // Duplicate last if odd
      
      const combined = new Uint8Array(left.length + right.length);
      combined.set(left);
      combined.set(right, left.length);
      
      nextLevel.push(sha256(combined));
    }
    
    level = nextLevel;
  }
  
  return '0x' + bytesToHex(level[0]);
}

/**
 * Generate a Merkle proof for a leaf at a specific index
 * 
 * @param leaves - Array of leaf hashes
 * @param leafIndex - Index of the leaf to generate proof for
 * @returns Array of proof items
 */
export function generateMerkleProof(leaves: string[], leafIndex: number): MerkleProofItem[] {
  if (leaves.length === 0 || leafIndex < 0 || leafIndex >= leaves.length) {
    return [];
  }
  
  if (leaves.length === 1) {
    return [];
  }
  
  const proof: MerkleProofItem[] = [];
  
  // Normalize all leaves
  let level = leaves.map(leaf => {
    const normalized = leaf.startsWith('0x') ? leaf.slice(2) : leaf;
    return hexToBytes(normalized);
  });
  
  let currentIndex = leafIndex;
  
  // Build proof by traversing up the tree
  while (level.length > 1) {
    const siblingIndex = currentIndex % 2 === 0 ? currentIndex + 1 : currentIndex - 1;
    
    if (siblingIndex < level.length) {
      proof.push({
        position: currentIndex % 2 === 0 ? 'right' : 'left',
        data: '0x' + bytesToHex(level[siblingIndex])
      });
    } else {
      // Odd number of nodes, duplicate the last one
      proof.push({
        position: 'right',
        data: '0x' + bytesToHex(level[currentIndex])
      });
    }
    
    // Move to parent level
    const nextLevel: Uint8Array[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = i + 1 < level.length ? level[i + 1] : level[i];
      
      const combined = new Uint8Array(left.length + right.length);
      combined.set(left);
      combined.set(right, left.length);
      
      nextLevel.push(sha256(combined));
    }
    
    level = nextLevel;
    currentIndex = Math.floor(currentIndex / 2);
  }
  
  return proof;
}
