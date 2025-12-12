# Production Code Reference

This document contains the implementation details and code snippets referenced in the [Production Plan](./PRODUCTION_PLAN.md).

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

### 2.2 Database Persistence

**File:** `backend/src/database.ts`

```typescript
import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';

let db: Database | null = null;

export async function initDB(): Promise<Database> {
  if (db) return db;
  
  // Use persistent volume path in production
  const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../data/dpp.sqlite');
  
  console.log(`📁 Database path: ${dbPath}`);
  
  db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  await db.exec(`
    -- DID Identities with full key material
    CREATE TABLE IF NOT EXISTS identities (
      did TEXT PRIMARY KEY,
      scid TEXT UNIQUE NOT NULL,
      public_key TEXT NOT NULL,
      private_key_encrypted TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER
    );

    -- DID Log entries (did:webvh compliance)
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

    -- Lifecycle events
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

    -- Anchor batches
    CREATE TABLE IF NOT EXISTS batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      merkle_root TEXT NOT NULL,
      tx_hash TEXT NOT NULL,
      block_number INTEGER NOT NULL,
      event_count INTEGER NOT NULL,
      status TEXT DEFAULT 'confirmed',
      created_at INTEGER NOT NULL
    );

    -- Merkle proofs for each event
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

    -- Indexes for performance
    CREATE INDEX IF NOT EXISTS idx_events_did ON events(did);
    CREATE INDEX IF NOT EXISTS idx_events_anchored ON events(anchored);
    CREATE INDEX IF NOT EXISTS idx_did_log_did ON did_log_entries(did);
  `);

  console.log("✅ Database initialized");
  return db;
}

export async function getDB(): Promise<Database> {
  if (!db) {
    return initDB();
  }
  return db;
}
```

### 2.3 Cryptographic Utilities

**File:** `backend/src/crypto.ts`

```typescript
import * as ed from '@noble/ed25519';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';

export async function verifySignature(
  publicKeyHex: string,
  message: string,
  signatureHex: string
): Promise<boolean> {
  try {
    const publicKey = hexToBytes(publicKeyHex);
    const signature = hexToBytes(signatureHex);
    const messageBytes = new TextEncoder().encode(message);
    
    return await ed.verifyAsync(signature, messageBytes, publicKey);
  } catch (error) {
    console.error('Signature verification failed:', error);
    return false;
  }
}

export async function verifyEventSignature(
  did: string,
  payload: any,
  signature: string
): Promise<boolean> {
  const db = await import('./database').then(m => m.getDB());
  
  const identity = await db.get('SELECT public_key FROM identities WHERE did = ?', [did]);
  if (!identity) {
    console.error(`DID not found: ${did}`);
    return false;
  }
  
  const message = canonicalizeForSigning(did, payload);
  return verifySignature(identity.public_key, message, signature);
}

export function canonicalizeForSigning(did: string, payload: any): string {
  return JSON.stringify({
    did,
    payload,
  }, Object.keys({ did, payload }).sort());
}

export function sha256Hash(data: string): string {
  const bytes = new TextEncoder().encode(data);
  return bytesToHex(sha256(bytes));
}

export function createLeafHash(event: {
  did: string;
  event_type: string;
  payload: string;
  timestamp: number;
}): string {
  const canonical = JSON.stringify({
    did: event.did,
    event_type: event.event_type,
    payload: JSON.parse(event.payload),
    timestamp: event.timestamp
  });
  return sha256Hash(canonical);
}
```

### 2.4 Local Storage Service

**File:** `backend/src/storage.ts`

```typescript
import * as fs from 'fs/promises';
import * as path from 'path';

// The Web Server root for serving static files
const STORAGE_ROOT = process.env.STORAGE_ROOT || '/var/www/html/dpp-identities';

export async function uploadToStorage(key: string, body: string, contentType: string) {
  try {
    const fullPath = path.join(STORAGE_ROOT, key);
    const dir = path.dirname(fullPath);

    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(fullPath, body, 'utf8');
    
    console.log(`✅ Written ${key} to local disk`);
  } catch (error) {
    console.error(`❌ Failed to write ${key} to disk:`, error);
  }
}
```

### 2.5 DID Resolver

**File:** `backend/src/did-resolver.ts`

```typescript
import { getDB } from './database';
import { sha256Hash } from './crypto';
import { uploadToStorage } from './storage';

interface DIDLogEntry {
  versionId: number;
  versionTime: string;
  method: 'create' | 'update' | 'deactivate';
  previousVersionHash?: string;
  updateKeys?: string[];
  params: {
    id: string;
    verificationMethod?: any[];
    authentication?: string[];
    service?: any[];
  };
  proof?: {
    type: string;
    created: string;
    verificationMethod: string;
    proofPurpose: string;
    proofValue: string;
  };
}

export async function resolveDID(scid: string): Promise<string> {
  const db = await getDB();
  
  const entries = await db.all(
    `SELECT * FROM did_log_entries 
     WHERE did = (SELECT did FROM identities WHERE scid = ?)
     ORDER BY version_id ASC`,
    [scid]
  );
  
  if (entries.length === 0) {
    throw new Error(`DID not found: ${scid}`);
  }
  
  const jsonl = entries.map(entry => {
    const logEntry: DIDLogEntry = {
      versionId: entry.version_id,
      versionTime: entry.version_time,
      method: entry.method,
      params: JSON.parse(entry.params),
    };
    
    if (entry.previous_version_hash) {
      logEntry.previousVersionHash = entry.previous_version_hash;
    }
    if (entry.update_keys) {
      logEntry.updateKeys = JSON.parse(entry.update_keys);
    }
    if (entry.proof) {
      logEntry.proof = JSON.parse(entry.proof);
    }
    
    return JSON.stringify(logEntry);
  }).join('\n');
  
  return jsonl;
}
```

### 2.6 Batch Processor

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

export async function processBatch(): Promise<{
  status: string;
  batchId?: number;
  txHash?: string;
  blockNumber?: number;
  eventCount?: number;
  merkleRoot?: string;
}> {
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

## 3. Client Verification

### 3.1 Verification Logic

**File:** `src/lib/utils/merkle.ts`

```typescript
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { ethers } from 'ethers';

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

---

## 4. Deployment Configuration

### 4.1 Caddy Configuration

**File:** `deployment/Caddyfile`

```caddyfile
{
    # Admin API off in production for security
    admin off
}

# Identity Service & Application Domain
webvh.web3connect.nl {
    # 1. Serve Static DID Logs (Direct from Disk)
    handle /.well-known/did/* {
        root * /var/www/html
        file_server
        header Access-Control-Allow-Origin "*"
    }

    # 2. Reverse Proxy to Identity & Trust Service (Node.js)
    handle /api/* {
        reverse_proxy localhost:3000
    }

    # 3. Serve Frontend Application
    handle {
        root * /var/www/html/app
        try_files {path} /index.html
        file_server
    }

    # Automatic HTTPS managed by Caddy
    tls email@example.com
}
```

### 4.2 Docker Compose Configuration

**File:** `deployment/docker-compose.yml`

```yaml
version: '3.8'

services:
  # Identity & Trust Service
  backend:
    build: 
      context: ..
      dockerfile: deployment/Dockerfile.backend
    restart: always
    environment:
      - NODE_ENV=production
      - PORT=3000
      - DATABASE_PATH=/data/dpp.sqlite
      - STORAGE_ROOT=/var/www/html/identities
    volumes:
      - dpp_data:/data
      - dpp_identities:/var/www/html/identities
    networks:
      - dpp_net

  # Secure Web Server
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

### 4.3 Environment Template

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
# Remove previous commits if keys were exposed.
```
