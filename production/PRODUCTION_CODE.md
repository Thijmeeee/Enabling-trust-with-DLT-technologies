# Production Code Reference

This document contains the implementation details and code snippets referenced in the [Production Plan](./PRODUCTION_PLAN.md).

---

## Table of Contents

1. [Smart Contract Implementation](#1-smart-contract-implementation)
2. [Backend Implementation](#2-backend-implementation)
3. [Witness & Watcher Integration](#3-witness--watcher-integration)
4. [Client Verification](#4-client-verification)
5. [Deployment Configuration](#5-deployment-configuration)

---

## 1. Smart Contract Implementation

### 1.1 WitnessAnchorRegistry.sol

**File:** `contracts/contracts/WitnessAnchorRegistry.sol`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title WitnessAnchorRegistry
 * @notice Stores Merkle roots of batched DPP events for immutable verification
 * @dev Each batch contains multiple events hashed into a Merkle tree
 */
contract WitnessAnchorRegistry {
    /// @notice Counter for batch IDs (auto-incrementing)
    uint256 public batchCount;
    
    /// @notice Mapping from batchId to Merkle root
    mapping(uint256 => bytes32) public roots;
    
    /// @notice Mapping from batchId to block timestamp
    mapping(uint256 => uint256) public timestamps;
    
    /// @notice Mapping from batchId to block number (for Etherscan links)
    mapping(uint256 => uint256) public blockNumbers;

    /// @notice Emitted when a new batch is anchored
    event Anchored(
        uint256 indexed batchId, 
        bytes32 indexed root, 
        uint256 timestamp,
        uint256 blockNumber
    );

    /**
     * @notice Anchor a Merkle root to the blockchain
     * @param merkleRoot The root hash of the Merkle tree containing event hashes
     * @return batchId The ID assigned to this batch
     */
    function anchor(bytes32 merkleRoot) external returns (uint256 batchId) {
        batchId = batchCount++;
        roots[batchId] = merkleRoot;
        timestamps[batchId] = block.timestamp;
        blockNumbers[batchId] = block.number;
        
        emit Anchored(batchId, merkleRoot, block.timestamp, block.number);
    }

    /**
     * @notice Verify that a given root matches the stored root for a batch
     * @param batchId The batch to check
     * @param expectedRoot The root to compare against
     * @return bool True if roots match
     */
    function verify(uint256 batchId, bytes32 expectedRoot) external view returns (bool) {
        return roots[batchId] == expectedRoot;
    }
    
    /**
     * @notice Get full batch details
     * @param batchId The batch to query
     * @return root The Merkle root
     * @return timestamp When the batch was anchored
     * @return blockNum The block number
     */
    function getBatch(uint256 batchId) external view returns (
        bytes32 root,
        uint256 timestamp,
        uint256 blockNum
    ) {
        return (roots[batchId], timestamps[batchId], blockNumbers[batchId]);
    }
}
```

### 1.2 Hardhat Configuration

**File:** `contracts/hardhat.config.ts`

```typescript
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const config: HardhatUserConfig = {
  solidity: "0.8.20",
  networks: {
    sepolia: {
      url: process.env.ALCHEMY_SEPOLIA_URL || "",
      accounts: process.env.DEPLOYER_PRIVATE_KEY 
        ? [process.env.DEPLOYER_PRIVATE_KEY] 
        : [],
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY || "",
  },
};

export default config;
```

### 1.3 Deployment Script

**File:** `contracts/scripts/deploy.ts`

```typescript
import { ethers } from "hardhat";

async function main() {
  console.log("Deploying WitnessAnchorRegistry to Sepolia...");
  
  const WitnessAnchorRegistry = await ethers.getContractFactory("WitnessAnchorRegistry");
  const contract = await WitnessAnchorRegistry.deploy();
  
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  
  console.log(`✅ WitnessAnchorRegistry deployed to: ${address}`);
  console.log(`   View on Etherscan: https://sepolia.etherscan.io/address/${address}`);
  console.log("");
  console.log("Add this to your .env file:");
  console.log(`CONTRACT_ADDRESS=${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

---

## 2. Backend Implementation

### 2.1 Contract ABI

**File:** `backend/src/contract-abi.ts`

```typescript
export const WITNESS_ANCHOR_REGISTRY_ABI = [
  "function anchor(bytes32 merkleRoot) external returns (uint256 batchId)",
  "function verify(uint256 batchId, bytes32 expectedRoot) external view returns (bool)",
  "function roots(uint256 batchId) external view returns (bytes32)",
  "function timestamps(uint256 batchId) external view returns (uint256)",
  "function blockNumbers(uint256 batchId) external view returns (uint256)",
  "function getBatch(uint256 batchId) external view returns (bytes32 root, uint256 timestamp, uint256 blockNum)",
  "function batchCount() external view returns (uint256)",
  "event Anchored(uint256 indexed batchId, bytes32 indexed root, uint256 timestamp, uint256 blockNumber)"
];
```

### 2.2 Database Schema

**File:** `backend/src/database.ts`

```typescript
import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';

let db: Database | null = null;

export async function initDB(): Promise<Database> {
  if (db) return db;
  
  const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../data/dpp.sqlite');
  console.log(`📁 Database path: ${dbPath}`);
  
  db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS identities (
      did TEXT PRIMARY KEY,
      scid TEXT UNIQUE NOT NULL,
      public_key TEXT NOT NULL,
      private_key_encrypted TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS did_log_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      did TEXT NOT NULL,
      version_id INTEGER NOT NULL,
      version_time TEXT NOT NULL,
      method TEXT NOT NULL,
      previous_version_hash TEXT,
      update_keys TEXT,
      params TEXT NOT NULL,
      proof TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY(did) REFERENCES identities(did),
      UNIQUE(did, version_id)
    );

    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      did TEXT NOT NULL,
      event_type TEXT NOT NULL,
      payload TEXT NOT NULL,
      signature TEXT NOT NULL,
      leaf_hash TEXT,
      timestamp INTEGER NOT NULL,
      batch_id INTEGER,
      anchored INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      FOREIGN KEY(did) REFERENCES identities(did)
    );

    CREATE TABLE IF NOT EXISTS batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      merkle_root TEXT NOT NULL,
      tx_hash TEXT NOT NULL,
      block_number INTEGER NOT NULL,
      event_count INTEGER NOT NULL,
      status TEXT DEFAULT 'confirmed',
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS witness_proofs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL,
      batch_id INTEGER NOT NULL,
      leaf_hash TEXT NOT NULL,
      proof TEXT NOT NULL,
      leaf_index INTEGER NOT NULL,
      FOREIGN KEY(event_id) REFERENCES events(id),
      FOREIGN KEY(batch_id) REFERENCES batches(id),
      UNIQUE(event_id)
    );

    CREATE INDEX IF NOT EXISTS idx_events_did ON events(did);
    CREATE INDEX IF NOT EXISTS idx_events_anchored ON events(anchored);
    CREATE INDEX IF NOT EXISTS idx_did_log_did ON did_log_entries(did);
  `);

  console.log("✅ Database initialized");
  return db;
}

export async function getDB(): Promise<Database> {
  if (!db) return initDB();
  return db;
}
```

### 2.3 Batch Processor

**File:** `backend/src/batch-processor.ts`

```typescript
import { MerkleTree } from 'merkletreejs';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { ethers } from 'ethers';
import { getDB } from './database';
import { createLeafHash } from './crypto';
import { WITNESS_ANCHOR_REGISTRY_ABI } from './contract-abi';

function sha256Buffer(data: Buffer): Buffer {
  return Buffer.from(sha256(data));
}

export async function processBatch() {
  const db = await getDB();
  
  const events = await db.all('SELECT * FROM events WHERE anchored = 0 ORDER BY id ASC');
  
  if (events.length === 0) {
    return { status: 'no_pending_events' };
  }
  
  console.log(`📦 Processing batch with ${events.length} events...`);
  
  const leaves: Buffer[] = [];
  const leafHashes: string[] = [];
  
  for (const event of events) {
    const leafHash = createLeafHash(event);
    leafHashes.push(leafHash);
    leaves.push(Buffer.from(hexToBytes(leafHash)));
    
    await db.run('UPDATE events SET leaf_hash = ? WHERE id = ?', [leafHash, event.id]);
  }
  
  const tree = new MerkleTree(leaves, sha256Buffer, { sortPairs: true });
  const root = tree.getRoot().toString('hex');
  const rootBytes = '0x' + root;
  
  console.log(`🌲 Merkle Root: ${rootBytes}`);
  
  const provider = new ethers.JsonRpcProvider(process.env.ALCHEMY_SEPOLIA_URL);
  const signer = new ethers.Wallet(process.env.RELAYER_PRIVATE_KEY!, provider);
  const contract = new ethers.Contract(
    process.env.CONTRACT_ADDRESS!, 
    WITNESS_ANCHOR_REGISTRY_ABI, 
    signer
  );
  
  console.log('⛓️ Sending anchor transaction...');
  const tx = await contract.anchor(rootBytes);
  console.log(`   Tx Hash: ${tx.hash}`);
  
  const receipt = await tx.wait();
  console.log(`✅ Anchored in block ${receipt.blockNumber}`);
  
  const batchResult = await db.run(
    `INSERT INTO batches (merkle_root, tx_hash, block_number, event_count, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [rootBytes, tx.hash, receipt.blockNumber, events.length, Date.now()]
  );
  
  const batchId = batchResult.lastID;
  
  await db.run('UPDATE events SET anchored = 1, batch_id = ? WHERE leaf_hash IN (' + leafHashes.map(() => '?').join(',') + ')', [batchId, ...leafHashes]);
  
  // Store proofs
  for (let i = 0; i < leaves.length; i++) {
    const proof = tree.getProof(leaves[i]);
    const proofJSON = JSON.stringify(proof.map(p => ({
      position: p.position,
      data: p.data.toString('hex')
    })));
    
    await db.run(
      `INSERT INTO witness_proofs (event_id, batch_id, leaf_hash, proof, leaf_index)
       VALUES (?, ?, ?, ?, ?)`,
      [events[i].id, batchId, leafHashes[i], proofJSON, i]
    );
  }
  
  return {
    status: 'anchored',
    batchId: batchId as number,
    txHash: tx.hash,
    blockNumber: receipt.blockNumber,
    eventCount: events.length,
    merkleRoot: rootBytes
  };
}
```

---


### 2.4 Scheduler Implementation

**Reference:** [PRODUCTION_PLAN.md § 3.3](./PRODUCTION_PLAN.md#33-scheduled-tasks-cron-style-batch-processing)

```javascript
const cron = require('node-cron');
const { processBatch } = require('./batch-processor');

// Every 10 minutes
cron.schedule('*/10 * * * *', async () => {
  console.log('[Trust Engine] Starting batch anchor...');
  try {
    const result = await processBatch();
    console.log(`[Trust Engine] Batch result:`, result);
  } catch (err) {
    console.error('[Trust Engine] Batch failed:', err);
  }
});

console.log('Trust Engine scheduler started');
```

---

### 2.5 DID:WebVH Utilities (Spec v1.0 Compliant)

**File:** `backend/src/didwebvh.ts`

This module implements the core did:webvh v1.0 specification requirements:
- SCID generation (Self-Certifying Identifier)
- Entry hash computation
- Spec-compliant log entry structure

```typescript
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';
import * as ed from '@noble/ed25519';

// Base58-btc alphabet (Bitcoin standard)
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

/**
 * Encode bytes to base58-btc string
 */
function encodeBase58(bytes: Uint8Array): string {
  let num = BigInt('0x' + bytesToHex(bytes));
  let result = '';
  while (num > 0n) {
    const remainder = Number(num % 58n);
    num = num / 58n;
    result = BASE58_ALPHABET[remainder] + result;
  }
  // Handle leading zeros
  for (const byte of bytes) {
    if (byte === 0) result = '1' + result;
    else break;
  }
  return result;
}

/**
 * Generate SCID (Self-Certifying Identifier) per did:webvh v1.0 spec
 * 
 * The SCID MUST be generated from the initial log entry content.
 * Returns a 46-character base58-btc encoded string.
 */
export function generateSCID(initialLogEntry: object): string {
  // Canonicalize: sort keys and stringify
  const canonicalJson = JSON.stringify(initialLogEntry, Object.keys(initialLogEntry).sort());
  const hash = sha256(new TextEncoder().encode(canonicalJson));
  const encoded = encodeBase58(hash);
  return encoded.slice(0, 46); // SCID is 46 characters
}

/**
 * Compute entryHash for a log entry (used in versionId)
 * 
 * Per spec: versionId = "{versionNumber}-{entryHash}"
 */
export function computeEntryHash(logEntry: object): string {
  const canonicalJson = JSON.stringify(logEntry, Object.keys(logEntry).sort());
  const hash = sha256(new TextEncoder().encode(canonicalJson));
  return bytesToHex(hash).slice(0, 16); // First 16 hex chars (64 bits)
}

/**
 * Generate multikey from Ed25519 public key
 * 
 * Per spec: updateKeys must be in multikey format
 */
export function toMultikey(publicKey: Uint8Array): string {
  // Multicodec prefix for Ed25519 public key: 0xed01
  const prefix = new Uint8Array([0xed, 0x01]);
  const combined = new Uint8Array(prefix.length + publicKey.length);
  combined.set(prefix);
  combined.set(publicKey, prefix.length);
  return 'z' + encodeBase58(combined); // 'z' indicates base58-btc
}

/**
 * Create a spec-compliant DID Log Entry
 * 
 * Per did:webvh v1.0, each entry MUST have:
 * - versionId: "{number}-{entryHash}"
 * - versionTime: ISO8601 timestamp
 * - parameters: {method, scid, updateKeys, ...}
 * - state: DIDDoc
 * - proof: Data Integrity Proof array
 */
export interface DIDLogEntry {
  versionId: string;
  versionTime: string;
  parameters: {
    method: string;
    scid: string;
    updateKeys: string[];
    prerotation?: boolean;
    nextKeyHashes?: string[];
    witnessConfig?: {
      witnesses: string[];
      threshold: number;
    };
  };
  state: DIDDocument;
  proof: DataIntegrityProof[];
}

export interface DIDDocument {
  '@context': string[];
  id: string;
  controller?: string;
  verificationMethod?: VerificationMethod[];
  authentication?: string[];
  assertionMethod?: string[];
  service?: ServiceEndpoint[];
}

export interface VerificationMethod {
  id: string;
  type: string;
  controller: string;
  publicKeyMultibase: string;
}

export interface ServiceEndpoint {
  id: string;
  type: string;
  serviceEndpoint: string;
}

export interface DataIntegrityProof {
  type: string;
  created: string;
  verificationMethod: string;
  proofPurpose: string;
  proofValue: string;
}

/**
 * Create initial log entry for DID creation
 */
export async function createInitialLogEntry(
  domain: string,
  publicKey: Uint8Array,
  privateKey: Uint8Array,
  metadata?: Record<string, unknown>
): Promise<{ did: string; scid: string; logEntry: DIDLogEntry }> {
  const multikey = toMultikey(publicKey);
  const versionTime = new Date().toISOString();
  
  // Placeholder SCID for initial computation
  const placeholderSCID = '{SCID}';
  const placeholderDID = `did:webvh:${placeholderSCID}:${domain}`;
  
  // Build parameters
  const parameters = {
    method: 'sha256',
    scid: placeholderSCID,
    updateKeys: [multikey],
  };
  
  // Build initial DIDDoc (state)
  const state: DIDDocument = {
    '@context': [
      'https://www.w3.org/ns/did/v1',
      'https://w3id.org/security/multikey/v1'
    ],
    id: placeholderDID,
    controller: placeholderDID,
    verificationMethod: [{
      id: `${placeholderDID}#key-1`,
      type: 'Multikey',
      controller: placeholderDID,
      publicKeyMultibase: multikey
    }],
    authentication: [`${placeholderDID}#key-1`],
    assertionMethod: [`${placeholderDID}#key-1`],
  };
  
  // Build entry WITHOUT versionId (needed for SCID computation)
  const entryForSCID = {
    versionId: '1-{HASH}',
    versionTime,
    parameters,
    state,
  };
  
  // Generate SCID from initial entry
  const scid = generateSCID(entryForSCID);
  const did = `did:webvh:${scid}:${domain}`;
  
  // Update all placeholders with real SCID/DID
  parameters.scid = scid;
  state.id = did;
  state.controller = did;
  state.verificationMethod![0].id = `${did}#key-1`;
  state.verificationMethod![0].controller = did;
  state.authentication = [`${did}#key-1`];
  state.assertionMethod = [`${did}#key-1`];
  
  // Build entry for hash computation (without versionId hash part)
  const entryForHash = {
    versionId: '1',
    versionTime,
    parameters,
    state,
  };
  
  const entryHash = computeEntryHash(entryForHash);
  const versionId = `1-${entryHash}`;
  
  // Build final entry
  const logEntry: DIDLogEntry = {
    versionId,
    versionTime,
    parameters,
    state,
    proof: [] // Will be added after signing
  };
  
  // Sign the entry
  const proofValue = await signLogEntry(logEntry, privateKey, did);
  logEntry.proof = [{
    type: 'DataIntegrityProof',
    created: versionTime,
    verificationMethod: `${did}#key-1`,
    proofPurpose: 'assertionMethod',
    proofValue
  }];
  
  return { did, scid, logEntry };
}

/**
 * Create update log entry
 */
export async function createUpdateLogEntry(
  previousEntry: DIDLogEntry,
  updatedState: Partial<DIDDocument>,
  privateKey: Uint8Array
): Promise<DIDLogEntry> {
  const versionNumber = parseInt(previousEntry.versionId.split('-')[0]) + 1;
  const versionTime = new Date().toISOString();
  const did = previousEntry.state.id;
  
  // Merge state updates
  const state: DIDDocument = {
    ...previousEntry.state,
    ...updatedState
  };
  
  // Copy parameters (can be updated if needed)
  const parameters = { ...previousEntry.parameters };
  
  // Build entry for hash
  const entryForHash = {
    versionId: String(versionNumber),
    versionTime,
    parameters,
    state,
  };
  
  const entryHash = computeEntryHash(entryForHash);
  const versionId = `${versionNumber}-${entryHash}`;
  
  const logEntry: DIDLogEntry = {
    versionId,
    versionTime,
    parameters,
    state,
    proof: []
  };
  
  // Sign
  const proofValue = await signLogEntry(logEntry, privateKey, did);
  logEntry.proof = [{
    type: 'DataIntegrityProof',
    created: versionTime,
    verificationMethod: `${did}#key-1`,
    proofPurpose: 'assertionMethod',
    proofValue
  }];
  
  return logEntry;
}

/**
 * Sign a log entry with Ed25519
 */
async function signLogEntry(
  logEntry: Omit<DIDLogEntry, 'proof'>,
  privateKey: Uint8Array,
  did: string
): Promise<string> {
  const message = JSON.stringify(logEntry, Object.keys(logEntry).sort());
  const signature = await ed.signAsync(
    new TextEncoder().encode(message),
    privateKey
  );
  return 'z' + encodeBase58(signature); // base58-btc encoded
}

/**
 * Build DID string per did:webvh v1.0 spec
 * 
 * Format: did:webvh:{scid}:{domain}
 * 
 * CRITICAL: SCID MUST be first element after "did:webvh:"
 */
export function buildDID(scid: string, domain: string, path?: string): string {
  if (path) {
    // Path segments use colons instead of slashes
    const pathSegments = path.split('/').filter(Boolean).join(':');
    return `did:webvh:${scid}:${domain}:${pathSegments}`;
  }
  return `did:webvh:${scid}:${domain}`;
}

/**
 * Parse a did:webvh DID string
 */
export function parseDID(did: string): { scid: string; domain: string; path?: string } {
  const parts = did.split(':');
  if (parts[0] !== 'did' || parts[1] !== 'webvh') {
    throw new Error('Invalid did:webvh DID');
  }
  const scid = parts[2];
  const domain = parts[3];
  const path = parts.length > 4 ? parts.slice(4).join('/') : undefined;
  return { scid, domain, path };
}

/**
 * Transform DID to HTTPS URL for log retrieval
 * 
 * did:webvh:{scid}:{domain} → https://{domain}/.well-known/did/{scid}/did.jsonl
 */
export function didToHttps(did: string): string {
  const { scid, domain, path } = parseDID(did);
  if (path) {
    return `https://${domain}/${path}/did.jsonl`;
  }
  return `https://${domain}/.well-known/did/${scid}/did.jsonl`;
}
```

---

## 3. Witness & Watcher Integration

### 3.1 Product Creation Endpoint

**File:** `backend/src/api/products.ts`

**Referenced in:** [PRODUCTION_PLAN.md § 5.1](./PRODUCTION_PLAN.md#51-how-users-request-and-receive-dids)

```typescript
import * as ed from '@noble/ed25519';
import * as fs from 'fs/promises';
import { 
  createInitialLogEntry, 
  parseDID,
  type DIDLogEntry 
} from './didwebvh';

const DOMAIN = 'webvh.web3connect.nl';

// POST /api/products/create endpoint (did:webvh v1.0 compliant)
async function createProduct(req, res) {
  const { type, model, metadata } = req.body;
  
  try {
    // 1. Generate Ed25519 key pair for this DID
    const privateKey = ed.utils.randomPrivateKey();
    const publicKey = await ed.getPublicKeyAsync(privateKey);
    
    // 2. Create spec-compliant DID and initial log entry
    // This handles SCID generation, versionId with hash, proper structure
    const { did, scid, logEntry } = await createInitialLogEntry(
      DOMAIN,
      publicKey,
      privateKey,
      { type, model, ...metadata }
    );
    
    // 3. Store private key securely (encrypted)
    await storePrivateKey(scid, privateKey);
    
    // 4. Create directory and write did.jsonl
    const storageRoot = process.env.STORAGE_ROOT || './did-logs';
    await fs.mkdir(`${storageRoot}/${scid}`, { recursive: true });
    await fs.writeFile(
      `${storageRoot}/${scid}/did.jsonl`, 
      JSON.stringify(logEntry) + '\n'
    );
    
    // 5. Store in database
    await db.run(
      `INSERT INTO identities (did, scid, public_key, created_at) VALUES (?, ?, ?, ?)`,
      [did, scid, logEntry.parameters.updateKeys[0], Date.now()]
    );
    
    // 6. Request witness attestation (async)
    await requestWitnessProof(scid, logEntry);
    
    return res.json({ 
      did, 
      versionId: logEntry.versionId, 
      status: 'pending_witness' 
    });
    
  } catch (error) {
    console.error('Failed to create product:', error);
    return res.status(500).json({ error: 'Failed to create DID' });
  }
}
```

### 3.2 Event Addition with Witness-First Workflow

**File:** `backend/src/api/events.ts`

**Referenced in:** [PRODUCTION_PLAN.md § 5.2](./PRODUCTION_PLAN.md#52-how-didjsonl-is-updated)

```typescript
import { 
  createUpdateLogEntry, 
  parseDID, 
  computeEntryHash,
  type DIDLogEntry 
} from './didwebvh';

/**
 * Add event to DID log (did:webvh v1.0 compliant)
 * 
 * Implements witness-first workflow: witnesses must sign before log is updated.
 */
async function addEvent(did: string, eventData: {
  type: string;
  data: Record<string, unknown>;
}) {
  const { scid } = parseDID(did);
  
  // 1. Read current log and get latest entry
  const storageRoot = process.env.STORAGE_ROOT || './did-logs';
  const logPath = `${storageRoot}/${scid}/did.jsonl`;
  const logContent = await fs.readFile(logPath, 'utf-8');
  const entries = logContent.trim().split('\n').map(line => JSON.parse(line) as DIDLogEntry);
  const previousEntry = entries[entries.length - 1];
  
  // 2. Get private key for signing
  const privateKey = await getPrivateKey(scid);
  
  // 3. Create spec-compliant update entry
  // Note: For events, we add a service endpoint to state
  const newService = {
    id: `${did}#event-${Date.now()}`,
    type: eventData.type,
    serviceEndpoint: JSON.stringify(eventData.data)
  };
  
  const updatedState = {
    ...previousEntry.state,
    service: [...(previousEntry.state.service || []), newService]
  };
  
  const logEntry = await createUpdateLogEntry(
    previousEntry,
    updatedState,
    privateKey
  );
  
  // 4. Compute leaf hash for witness attestation
  const leafHash = computeEntryHash(logEntry);
  
  // 5. Request witness attestations (parallel)
  const witnessProofs = await Promise.all(
    witnesses.map(w => w.attest(scid, logEntry.versionId, leafHash))
  );
  
  // 6. CRITICAL: Publish witnesses FIRST (spec requirement)
  await updateWitnessFile(scid, {
    versionId: logEntry.versionId,
    leafHash,
    merkleIndex: null, // Pending batch
    merkleProof: null,
    witnessProofs
  });
  
  // 7. THEN append to did.jsonl
  await fs.appendFile(logPath, JSON.stringify(logEntry) + '\n');
  
  // 8. Add to pending batch queue for blockchain anchoring
  await db.run(
    `INSERT INTO events (did, event_type, payload, signature, leaf_hash, timestamp, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [did, eventData.type, JSON.stringify(eventData.data), 
     logEntry.proof[0].proofValue, leafHash, Date.now(), Date.now()]
  );
  
  return { versionId: logEntry.versionId, status: 'witnessed' };
}

// Key Invariant Enforcement
function validateWitnessFirst(witnessProofs: any[], logEntry: DIDLogEntry) {
  if (!witnessProofs || witnessProofs.length < 3) {
    throw new Error('Cannot publish log entry without minimum 3 witness proofs');
  }
}
```

### 3.3 Watcher Audit Implementation

**File:** `backend/src/services/watcher.ts`

**Referenced in:** [PRODUCTION_PLAN.md § 5.3](./PRODUCTION_PLAN.md#53-how-watchers-detect-fraudulent-events)

```javascript
async function auditDID(did) {
  const scid = extractSCID(did);
  const alerts = [];
  
  const didLog = await fetchDIDLog(scid);
  const witnessFile = await fetchWitnessFile(scid);
  
  // Verify hash chain
  for (let i = 0; i < didLog.length - 1; i++) {
    const computed = sha256(JSON.stringify(didLog[i]));
    if (didLog[i + 1].previousHash !== computed) {
      alerts.push({
        severity: "CRITICAL",
        type: "HASH_CHAIN_BROKEN",
        versionId: didLog[i + 1].versionId,
        message: `Hash chain break detected between v${i} and v${i+1}`
      });
    }
  }
  
  // Verify Merkle proofs
  for (const entry of didLog) {
    const witnessData = witnessFile.find(w => w.versionId === entry.versionId);
    
    if (witnessData?.merkleProof) {
      const verified = verifyMerkleProof(
        witnessData.leafHash,
        witnessData.merkleProof,
        witnessData.merkleIndex
      );
      
      if (!verified) {
        alerts.push({
          severity: "CRITICAL",
          type: "MERKLE_PROOF_INVALID",
          versionId: entry.versionId,
          message: "Merkle proof does not reconstruct to anchored root"
        });
      }
    }
  }
  
  return {
    did,
    status: alerts.length === 0 ? "VALID" : "COMPROMISED",
    alerts
  };
}

function verifyMerkleProof(leafHash, proof, index) {
  let hash = leafHash;
  let idx = index;
  
  for (const sibling of proof) {
    hash = (idx % 2 === 0)
      ? sha256(hash + sibling)  // Left sibling
      : sha256(sibling + hash); // Right sibling
    idx = Math.floor(idx / 2);
  }
  
  const anchoredRoot = getBlockchainRoot(); // From smart contract
  return hash === anchoredRoot;
}
```

---

## 4. Client Verification

### 4.1 Frontend Merkle Verification

**File:** `src/lib/utils/merkle.ts`

**Referenced in:** [PRODUCTION_PLAN.md § 5.4](./PRODUCTION_PLAN.md#54-uiux-integration)

```typescript
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';

export function verifyMerkleProof(
  leafHash: string,
  proof: Array<{ position: 'left' | 'right'; data: string }>,
  root: string
): { valid: boolean; computedRoot: string } {
  let currentHash = hexToBytes(leafHash);
  
  for (const item of proof) {
    const sibling = hexToBytes(item.data);
    const combined = new Uint8Array(currentHash.length + sibling.length);
    
    if (item.position === 'left') {
      combined.set(sibling);
      combined.set(currentHash, sibling.length);
    } else {
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
```

### 4.2 React Trust Validation Component

**File:** `src/components/TrustValidationTab.tsx` (enhancement)

**Referenced in:** [PRODUCTION_PLAN.md § 5.4](./PRODUCTION_PLAN.md#54-uiux-integration)

```jsx
function TrustValidationTab({ did }) {
  const [verification, setVerification] = useState({
    hashChain: 'checking',
    witnesses: 'checking',
    blockchain: 'checking'
  });

  useEffect(() => {
    async function verify() {
      const didLog = await fetchDIDLog(did);
      const witnessFile = await fetchWitnessFile(did);

      // 1. Hash chain
      const hashChainValid = verifyHashChain(didLog);
      setVerification(prev => ({ ...prev, hashChain: hashChainValid ? 'valid' : 'invalid' }));

      // 2. Witnesses
      const witnessValid = await verifyWitnessSignatures(witnessFile);
      setVerification(prev => ({ ...prev, witnesses: witnessValid ? 'valid' : 'invalid' }));

      // 3. Blockchain (slowest)
      const blockchainValid = await verifyMerkleAnchors(witnessFile);
      setVerification(prev => ({ ...prev, blockchain: blockchainValid ? 'valid' : 'invalid' }));
    }
    verify();
  }, [did]);

  return (
    <div className="space-y-4">
      <VerificationCheck 
        label="Hash Chain Integrity"
        status={verification.hashChain}
      />
      <VerificationCheck 
        label="Witness Attestations"
        status={verification.witnesses}
        details={`${witnessCount} independent witnesses`}
      />
      <VerificationCheck 
        label="Blockchain Anchor"
        status={verification.blockchain}
        details={blockNumber ? `Block #${blockNumber}` : 'Pending next batch'}
      />
    </div>
  );
}
```

---

## 5. Deployment Configuration

### 5.1 Caddy Configuration

**File:** `deployment/Caddyfile`

```caddyfile
{
    admin off
}

webvh.web3connect.nl {
    # Serve Static DID Logs
    handle /.well-known/did/* {
        root * /var/www/html/.well-known/did
        file_server
        header Access-Control-Allow-Origin "*"
    }

    # Reverse Proxy to Backend
    handle /api/* {
        reverse_proxy backend:3000
    }

    # Serve Frontend
    handle {
        root * /var/www/html/app
        try_files {path} /index.html
        file_server
    }

    tls email@example.com
}
```

### 5.2 Docker Compose

**File:** `deployment/docker-compose.yml`

```yaml
version: '3.8'

services:
  backend:
    build: 
      context: ..
      dockerfile: deployment/Dockerfile.backend
    restart: always
    env_file:
      - .env
    environment:
      - NODE_ENV=production
      - PORT=3000
      - DATABASE_PATH=/data/dpp.sqlite
      - STORAGE_ROOT=/var/www/html/.well-known/did
    volumes:
      - dpp_data:/data
      - dpp_identities:/var/www/html/.well-known/did
    networks:
      - dpp_net

  caddy:
    image: caddy:2
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - dpp_identities:/var/www/html/.well-known/did
      - ../dist:/var/www/html/app
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      - backend
    networks:
      - dpp_net

volumes:
  dpp_data:
  dpp_identities:
  caddy_data:
  caddy_config:

networks:
  dpp_net:
```

### 5.3 Environment Template

**File:** `deployment/.env.example`

```bash
# Blockchain
ALCHEMY_SEPOLIA_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY
RELAYER_PRIVATE_KEY=0x...
CONTRACT_ADDRESS=0x...

# Service
PORT=3000
NODE_ENV=production
FRONTEND_URL=https://webvh.web3connect.nl

# Security Note:
# Do NOT commit real keys to git.
```
