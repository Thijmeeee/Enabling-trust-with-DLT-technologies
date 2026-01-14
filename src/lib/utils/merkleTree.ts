/**
 * Merkle Tree Utilities for DID Event Verification
 * 
 * This module provides functions to build and verify Merkle trees from DID operations,
 * enabling trustless verification of event integrity.
 * 
 * Browser-compatible: Uses @noble/hashes instead of Node.js Buffer
 */

import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';
import { type AnchoringProof } from '../../types/witness';

export interface DIDOperation {
  id: string;
  dpp_id: string;
  did: string;
  attestation_type: string;
  attestation_data: Record<string, unknown>;
  signature: string;
  timestamp: string;
  approval_status?: 'pending' | 'approved' | 'rejected';
  witness_did?: string;
  witness_status?: 'pending' | 'anchored';
  created_at?: string;
}

export interface MerkleNodeData {
  id: string;
  hash: string;
  label: string;
  type: 'root' | 'internal' | 'leaf';
  depth: number;
  index: number;
  leftChild?: MerkleNodeData;
  rightChild?: MerkleNodeData;
  operation?: DIDOperation;
  isOnProofPath?: boolean;
  isSelected?: boolean;
  hasError?: boolean;
  errorMessage?: string;
  siblingHash?: string;
}

export interface MerkleTreeResult {
  root: string;
  tree: MerkleNodeData;
  leaves: MerkleNodeData[];
  leafCount: number;
  depth: number;
}

export interface MerkleProof {
  leaf: string;
  proof: string[];
  positions: ('left' | 'right')[];
  path: string[]; // Intermediate hashes including root
  root: string;
  valid: boolean;
}

/**
 * Format operation type for display
 */
export function formatOperationType(type: string): string {
    return type
        .replace(/_/g, ' ')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

/**
 * Hash a single DID operation to create a leaf
 */
export function hashOperation(operation: DIDOperation): string {
  // Create a deterministic string representation of the CONTENT
  // We exclude 'id' because it's an internal DB key and can differ between stores
  const dataToHash = JSON.stringify({
    did: operation.did,
    type: operation.attestation_type,
    data: operation.attestation_data,
    signature: operation.signature,
    timestamp: operation.timestamp,
  });
  
  const hashBytes = sha256(new TextEncoder().encode(dataToHash));
  return bytesToHex(hashBytes);
}

/**
 * Hash a DID log entry using the exact same logic as the Witness service.
 * This is used to verify that the witness leaf matches the actual data.
 */
export function hashWitnessEntry(entry: any): string {
    // The witness uses the raw JSON of the entry in the DID log
    const hashBytes = sha256(new TextEncoder().encode(JSON.stringify(entry)));
    return '0x' + bytesToHex(hashBytes);
}

/**
 * Combine two hashes into a parent hash using sorted pairing (Standard for many Merkle implementations)
 */
function combineHashes(left: string, right: string, useSorted: boolean = true): string {
  const leftClean = left.startsWith('0x') ? left.slice(2) : left;
  const rightClean = right.startsWith('0x') ? right.slice(2) : right;
  
  let combined: Uint8Array;
  if (useSorted) {
    // Sort hashes as strings (lexicographical order) to match merkletreejs sortPairs: true
    const sorted = [leftClean, rightClean].sort();
    combined = hexToBytes(sorted[0] + sorted[1]);
  } else {
    combined = hexToBytes(leftClean + rightClean);
  }
  
  return bytesToHex(sha256(combined));
}

/**
 * Build a Merkle tree from DID operations (browser-compatible)
 */
export function buildMerkleTree(operations: DIDOperation[]): MerkleTreeResult {
  if (operations.length === 0) {
    return {
      root: '0'.repeat(64),
      tree: {
        id: 'root',
        hash: '0'.repeat(64),
        label: 'Empty Tree',
        type: 'root',
        depth: 0,
        index: 0,
      },
      leaves: [],
      leafCount: 0,
      depth: 0,
    };
  }

  // Sort operations by timestamp for consistent ordering
  const sortedOps = [...operations].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  // Create leaf hashes
  const leafHashes = sortedOps.map(op => hashOperation(op));
  
  // Build the Merkle tree layers
  const layers: string[][] = [leafHashes];
  
  // Build tree bottom-up
  let currentLayer = leafHashes;
  while (currentLayer.length > 1) {
    const nextLayer: string[] = [];
    for (let i = 0; i < currentLayer.length; i += 2) {
      const left = currentLayer[i];
      // If odd number, duplicate the last hash (classic Merkle approach or RFC 6962)
      // Here we follow the simple "duplicate if odd" pattern
      const right = currentLayer[i + 1] || currentLayer[i];
      nextLayer.push(combineHashes(left, right));
    }
    layers.push(nextLayer);
    currentLayer = nextLayer;
  }
  
  const rootHash = layers[layers.length - 1][0] || '0'.repeat(64);
  const treeDepth = layers.length - 1;

  // Create leaf nodes with operation data
  const leaves: MerkleNodeData[] = sortedOps.map((op, index) => ({
    id: `leaf-${index}`,
    hash: leafHashes[index],
    label: formatOperationType(op.attestation_type),
    type: 'leaf' as const,
    depth: treeDepth,
    index,
    operation: op,
  }));

  // Build the full tree structure for visualization
  const treeStructure = buildTreeStructure(layers, leaves, rootHash);

  return {
    root: rootHash,
    tree: treeStructure,
    leaves,
    leafCount: sortedOps.length,
    depth: treeDepth,
  };
}

/**
 * Build a tree structure suitable for visualization
 */
function buildTreeStructure(
  layers: string[][], 
  leaves: MerkleNodeData[],
  rootHash: string
): MerkleNodeData {
  if (layers.length === 0 || layers[0].length === 0) {
    return {
      id: 'root',
      hash: rootHash,
      label: 'Root',
      type: 'root',
      depth: 0,
      index: 0,
    };
  }

  // Build nodes from bottom up
  const nodesByLayer: MerkleNodeData[][] = [];
  
  // Leaf layer
  nodesByLayer.push(leaves);
  
  // Internal layers
  for (let layerIdx = 1; layerIdx < layers.length; layerIdx++) {
    const layer = layers[layerIdx];
    const prevLayer = nodesByLayer[layerIdx - 1];
    const currentLayer: MerkleNodeData[] = [];
    
    for (let i = 0; i < layer.length; i++) {
      const hash = layer[i];
      const leftChildIdx = i * 2;
      const rightChildIdx = i * 2 + 1;
      
      const isRoot = layerIdx === layers.length - 1 && layer.length === 1;
      
      const node: MerkleNodeData = {
        id: isRoot ? 'root' : `internal-${layerIdx}-${i}`,
        hash,
        label: isRoot ? 'Merkle Root' : `Node ${layerIdx}-${i}`,
        type: isRoot ? 'root' : 'internal',
        depth: layers.length - 1 - layerIdx,
        index: i,
        leftChild: prevLayer[leftChildIdx],
        // Do NOT duplicate the right child visually if it was just padding in the calculation
        rightChild: rightChildIdx < prevLayer.length ? prevLayer[rightChildIdx] : undefined,
      };
      
      currentLayer.push(node);
    }
    
    nodesByLayer.push(currentLayer);
  }
  
  // Return root node
  return nodesByLayer[nodesByLayer.length - 1][0];
}

/**
 * Get the Merkle proof for a specific operation
 */
export function getMerkleProof(
  operations: DIDOperation[], 
  targetOperation: DIDOperation
): MerkleProof {
  const sortedOps = [...operations].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  
  const leafHashes = sortedOps.map(op => hashOperation(op));
  const targetHash = hashOperation(targetOperation);
  let targetIndex = leafHashes.indexOf(targetHash);
  
  if (targetIndex === -1) {
    return {
      leaf: targetHash,
      proof: [],
      positions: [],
      path: [],
      root: '',
      valid: false,
    };
  }
  
  // Build layers
  const layers: string[][] = [leafHashes];
  let currentLayer = leafHashes;
  while (currentLayer.length > 1) {
    const nextLayer: string[] = [];
    for (let i = 0; i < currentLayer.length; i += 2) {
      const left = currentLayer[i];
      const right = currentLayer[i + 1] || currentLayer[i];
      nextLayer.push(combineHashes(left, right));
    }
    layers.push(nextLayer);
    currentLayer = nextLayer;
  }
  
  // Build proof
  const proof: string[] = [];
  const positions: ('left' | 'right')[] = [];
  const path: string[] = [targetHash];
  let idx = targetIndex;
  
  for (let layerIdx = 0; layerIdx < layers.length - 1; layerIdx++) {
    const layer = layers[layerIdx];
    const isRightNode = idx % 2 === 1;
    const siblingIdx = isRightNode ? idx - 1 : idx + 1;
    
    if (siblingIdx < layer.length) {
      proof.push(layer[siblingIdx]);
      positions.push(isRightNode ? 'left' : 'right');
    } else {
      // Odd node duplicated
      proof.push(layer[idx]);
      positions.push('right');
    }
    
    idx = Math.floor(idx / 2);
    // Add the next hash in the path
    path.push(layers[layerIdx + 1][idx]);
  }
  
  const rootHash = layers[layers.length - 1][0];
  const valid = verifyMerkleProof(targetHash, proof, positions, rootHash);
  
  return {
    leaf: targetHash,
    proof,
    positions,
    path,
    root: rootHash,
    valid,
  };
}

/**
 * Verify a Merkle proof
 */
export function verifyMerkleProof(
  leaf: string,
  proof: string[],
  positions: ('left' | 'right')[],
  expectedRoot: string
): boolean {
  let currentHash = leaf;
  
  for (let i = 0; i < proof.length; i++) {
    const sibling = proof[i];
    const pos = positions[i];
    
    if (pos === 'left') {
      currentHash = combineHashes(sibling, currentHash);
    } else {
      currentHash = combineHashes(currentHash, sibling);
    }
  }
  
  return currentHash === expectedRoot;
}

export interface ProofPathLevel {
  depth: number;
  currentHash: string;
  siblingHash: string;
  isLeftChild: boolean;
  parentHash: string;
}

export interface ProofPathStructure {
  levels: ProofPathLevel[];
  leafHash: string;
  merkleRoot: string;
  isValid: boolean;
  totalLevels: number;
}

export interface VerificationStep {
  level: number;
  leftInput: string;
  rightInput: string;
  output: string;
  description: string;
}

export interface VerificationResult {
  steps: VerificationStep[];
  computedRoot: string;
  expectedRoot: string;
  isValid: boolean;
}

/**
 * Reconstructs the vertical proof path from a witness anchoring proof.
 * This is what the Watcher actually uses to verify an operation.
 */
export function buildProofPath(proof: any): ProofPathStructure {
  const levels: ProofPathLevel[] = [];
  
  // Normalize proof data (handle both AnchoringProof and WitnessProof types)
  const merkleProof = proof.merkleProof || proof.siblings || [];
  const leafHash = (proof.leafHash || proof.hash || '0x' + '0'.repeat(64)).replace('0x', '');
  const merkleRoot = (proof.merkleRoot || '').replace('0x', '');
  const leafIndex = typeof proof.leafIndex === 'number' ? proof.leafIndex : 0;
  
  let currentHash = leafHash;
  // No longer rely on currentIndex for sorting, as backend uses sortPairs: true
  
  for (let i = 0; i < merkleProof.length; i++) {
    const siblingHash = merkleProof[i].replace('0x', '');
    
    // Determine order based on hash values (standard for sortPairs: true)
    const isLeftChild = currentHash.toLowerCase() < siblingHash.toLowerCase();
    
    const leftInput = isLeftChild ? currentHash : siblingHash;
    const rightInput = isLeftChild ? siblingHash : currentHash;
    
    const parentHash = combineHashes(leftInput, rightInput, true);
    
    levels.push({
      depth: i, // depth from bottom
      currentHash: '0x' + currentHash,
      siblingHash: '0x' + siblingHash,
      isLeftChild,
      parentHash: '0x' + parentHash
    });
    
    currentHash = parentHash;
  }

  const isValid = currentHash === merkleRoot;

  return {
    levels,
    leafHash: '0x' + leafHash,
    merkleRoot: '0x' + merkleRoot,
    isValid,
    totalLevels: levels.length
  };
}

/**
 * Generates a step-by-step verification trace for the animation.
 */
export function verifyProofPath(proof: any): VerificationResult {
  const steps: VerificationStep[] = [];
  
  // Normalize proof data
  const merkleProof = proof.merkleProof || proof.siblings || [];
  const leafHash = (proof.leafHash || proof.hash || '0x' + '0'.repeat(64)).replace('0x', '');
  const merkleRoot = (proof.merkleRoot || '').replace('0x', '');
  const leafIndex = typeof proof.leafIndex === 'number' ? proof.leafIndex : 0;

  let currentHash = leafHash;

  for (let i = 0; i < merkleProof.length; i++) {
    const siblingHash = merkleProof[i].replace('0x', '');
    const isLeftChild = currentHash.toLowerCase() < siblingHash.toLowerCase();
    
    const leftInput = isLeftChild ? currentHash : siblingHash;
    const rightInput = isLeftChild ? siblingHash : currentHash;
    const parentHash = combineHashes(leftInput, rightInput, true);
    
    steps.push({
      level: i,
      leftInput: '0x' + leftInput,
      rightInput: '0x' + rightInput,
      output: '0x' + parentHash,
      description: `Step ${i + 1}: Hash ${isLeftChild ? 'current with right sibling' : 'left sibling with current'}`
    });
    
    currentHash = parentHash;
  }

  return {
    steps,
    computedRoot: '0x' + currentHash,
    expectedRoot: '0x' + merkleRoot,
    isValid: currentHash === merkleRoot
  };
}

/**
 * Wrapper for combineHashes to be used in verification logic
 */
export function computeParentHash(left: string, right: string): string {
  const leftClean = left.startsWith('0x') ? left.slice(2) : left;
  const rightClean = right.startsWith('0x') ? right.slice(2) : right;
  return '0x' + combineHashes(leftClean, rightClean);
}
