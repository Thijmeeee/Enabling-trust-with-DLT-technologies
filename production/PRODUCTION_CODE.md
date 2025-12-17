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
      url: process.env.RPC_URL || "",
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

## 2. Service & Database Implementation

### 2.1 Database Schema (PostgreSQL)

**File:** `backend/db/schema.sql`

We use PostgreSQL to handle concurrent state access from multiple microservices.

```sql
-- Identities (Managed by Identity Service)
CREATE TABLE identities (
    did VARCHAR(255) PRIMARY KEY,
    scid VARCHAR(255) UNIQUE NOT NULL,
    public_key TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Anchoring Events (Managed by Witness Service)
CREATE TABLE events (
    id SERIAL PRIMARY KEY,
    did VARCHAR(255) REFERENCES identities(did),
    event_type VARCHAR(50) NOT NULL,
    payload JSONB NOT NULL,
    signature TEXT NOT NULL,
    leaf_hash VARCHAR(66) NOT NULL,
    version_id VARCHAR(100) NOT NULL,
    timestamp BIGINT NOT NULL,
    witness_proofs JSONB, -- Array of witness signatures
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Merkle Batches (Managed by Witness Service)
CREATE TABLE batches (
    batch_id INTEGER PRIMARY KEY,
    merkle_root VARCHAR(66) NOT NULL,
    tx_hash VARCHAR(66),
    block_number INTEGER,
    status VARCHAR(50) DEFAULT 'pending', -- pending, anchored, confirmed
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Watcher Audits (Managed by Watcher Service)
CREATE TABLE audits (
    id SERIAL PRIMARY KEY,
    did VARCHAR(255) REFERENCES identities(did),
    check_type VARCHAR(50), -- 'hash_chain' or 'merkle_proof'
    status VARCHAR(20),     -- 'valid' or 'invalid'
    details TEXT,
    checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 2.2 Identity Service

**File:** `backend/services/identity/index.ts`

**Role**: Manages DID Life-cycle (Create, Update). Writes to `identities` table and `did-logs` volume.

```typescript
import express from 'express';
import { Pool } from 'pg';
import * as fs from 'fs/promises';
// LIBRARY INTEGRATION: using official method
import { WebVH } from 'didwebvh-ts'; 
import { Ed25519KeyManager } from 'didwebvh-ts/plugin-key-ed25519'; // Hypothetical plugin structure

const app = express();
const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB
});

// Endpoint: Create Product (DID)
app.post('/api/products/create', async (req, res) => {
  const { type, model, metadata } = req.body;
  const DOMAIN = 'webvh.web3connect.nl';

  try {
    // 1. Initialize Library
    const webvh = new WebVH({ domain: DOMAIN });
    
    // 2. Generate Keys & DID
    const keyManager = new Ed25519KeyManager();
    const handle = await webvh.create({
      keyManager,
      initialState: {
        service: [], // Add initial services if needed
        ...metadata
      }
    });
    
    // 3. Extract artifacts
    const { did, scid, logEntry } = handle;
    const privateKey = await keyManager.exportPrivate(did); // Securely handle this
    
    // 4. Persistence
    const storageRoot = process.env.STORAGE_ROOT || './did-logs';
    await fs.mkdir(`${storageRoot}/${scid}`, { recursive: true });
    await fs.writeFile(`${storageRoot}/${scid}/did.jsonl`, JSON.stringify(logEntry) + '\n');
    
    // 5. DB
    await pool.query(
      `INSERT INTO identities (did, scid, public_key) VALUES ($1, $2, $3)`,
      [did, scid, handle.didDocument.verificationMethod[0].publicKeyMultibase]
    );

    return res.json({ did, status: 'created' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint: Add Event
app.post('/api/events/add', async (req, res) => {
  const { did, eventType, data } = req.body;
  
  try {
    // 1. Load Current State using Library
    const webvh = new WebVH();
    // In a real app, you might load the KeyManager from KMS
    const keyManager = await loadKeyManagerFor(did); 
    
    // 2. Prepare Update (Library handles versionId, hash chain, multikeys)
    const updateResult = await webvh.update(did, {
      keyManager,
      updates: (doc) => {
        doc.service = [
          ...(doc.service || []),
          {
            id: `${did}#event-${Date.now()}`,
            type: eventType,
            serviceEndpoint: JSON.stringify(data)
          }
        ];
        return doc;
      }
    });
    
    const logEntry = updateResult.logEntry;
    const scid = updateResult.scid;
    
    // 3. Witness Flow (Still Custom / Hybrid)
    // The library creates the entry, we now need to add our Witness Proof 
    // BEFORE finalizing/publishing if the library allows hooking or if we append manually.
    
    // Assuming library returns the "signed by controller" entry:
    const leafHash = webvh.computeEntryHash(logEntry);
    
    const witnessRes = await fetch('http://witness:3000/attest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scid, versionId: logEntry.versionId, leafHash })
    });
    const witnessProof = await witnessRes.json();
    
    // Append Witness Proof
    logEntry.proof.push(witnessProof);
    
    // 4. Publish
    const storageRoot = process.env.STORAGE_ROOT || './did-logs';
    await fs.appendFile(`${storageRoot}/${scid}/did.jsonl`, JSON.stringify(logEntry) + '\n');
    
    // 5. DB Sync
    await pool.query(
      `INSERT INTO events (did, event_type, payload, leaf_hash, version_id, timestamp) VALUES ($1, $2, $3, $4, $5, $6)`,
      [did, eventType, JSON.stringify(data), leafHash, logEntry.versionId, Date.now()]
    );

    res.json({ status: 'success', versionId: logEntry.versionId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


app.listen(3000, () => console.log('Identity Service running on 3000'));
```

### 2.3 Witness Engine

**File:** `backend/services/witness/index.ts`

**Role**: Listens for new events, aggregates them into batches, and anchors to Ethereum.

```typescript
import { CronJob } from 'cron';
import { Pool } from 'pg';
import { ethers } from 'ethers';
import { MerkleTree } from 'merkletreejs';
import { sha256 } from '@noble/hashes/sha256';

// 1. Batch Processor (Runs every 10 mins)
const batchJob = new CronJob('*/10 * * * *', async () => {
  const pool = new Pool({ 
    host: process.env.DB_HOST,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DB
  });
  
  // A. Fetch unanchored events
  const { rows: events } = await pool.query(
    "SELECT * FROM events WHERE version_id NOT IN (SELECT version_id FROM batches) LIMIT 100"
  );
  if (events.length === 0) return;

  // B. Build Merkle Tree
  // Leaves must be hashed buffers or hex strings
  const leaves = events.map(e => e.leaf_hash); 
  const tree = new MerkleTree(leaves, sha256);
  const root = tree.getHexRoot();

  // C. Anchor to Blockchain (Local Hardhat or Sepolia)
  const rpcUrl = process.env.RPC_URL || "http://blockchain:8545";
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  
  // Use a predefined account from Hardhat or key from env
  const privateKey = process.env.RELAYER_PRIVATE_KEY;
  const wallet = new ethers.Wallet(privateKey, provider);
  
  // Contract Logic
  const contractAddress = process.env.CONTRACT_ADDRESS;
  const ABI = [
    "function anchor(bytes32 merkleRoot) external returns (uint256 batchId)"
  ];
  const contract = new ethers.Contract(contractAddress, ABI, wallet);
  
  try {
    const tx = await contract.anchor(root);
    await tx.wait();
  
    // D. Store Batch
    await pool.query(
      "INSERT INTO batches (merkle_root, tx_hash, status) VALUES ($1, $2, 'confirmed')",
      [root, tx.hash]
    );
    console.log(`Anchored batch with root ${root} in tx ${tx.hash}`);
  } catch (err) {
    console.error("Anchoring failed:", err);
  } finally {
    await pool.end();
  }
});

batchJob.start();
console.log('Witness Engine started');
```

### 2.4 Watcher Engine

**File:** `backend/services/watcher/index.ts`

**Role**: Periodically validates on-chain roots against local logs to detect fraud.

```typescript
import { CronJob } from 'cron';

const auditJob = new CronJob('0 * * * *', async () => { // Hourly
  // 1. Compare Blockchain Roots vs Local Logs
  // 2. Alert on mismatch
});

auditJob.start();
console.log('Watcher Engine started');
```

---

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

### 5.1 Caddy Configuration with OWASP CRS

**File:** `deployment/Caddyfile`

We use the **Coraza WAF** module to protect the gateway.

```caddyfile
{
    # Enable Coraza WAF
    order coraza_waf first
}

webvh.web3connect.nl {
    # 1. Apply OWASP Core Rule Set
    coraza_waf {
        directives `
            Include /etc/caddy/coraza.conf-recommended
            Include /etc/caddy/crs-setup.conf
            Include /etc/caddy/rules/*.conf
            SecRuleEngine On
        `
    }

    # 2. Route to Static Content Containers
    handle /.well-known/did/* {
        reverse_proxy did-static:80
    }

    handle_path /app/* {
        reverse_proxy frontend-static:80
    }

    # 3. Microservice Routing
    handle /api/identity/* {
        reverse_proxy identity:3000
    }

    handle /api/witness/* {
        reverse_proxy witness:3000
    }

    handle /api/watcher/* {
        reverse_proxy watcher:3000
    }

    # Default to Frontend
    handle {
        reverse_proxy frontend-static:80
    }

    tls email@example.com
}
```

### 5.2 Podman Compose Definition

**File:** `deployment/compose.yaml` (Standard Podman Pod definition)

```yaml
version: "3.8"

services:
  # --- Gateway ---
  gateway:
    build:
      context: .
      dockerfile: Dockerfile.caddy
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - caddy_data:/data
      - caddy_config:/config
    networks:
      - shared_pod

  # --- Static Content Hosts ---
  frontend-static:
    image: caddy:alpine
    command: caddy file-server --root /usr/share/caddy --listen :80
    volumes:
      - ./dist-app:/usr/share/caddy:ro
    networks:
      - shared_pod

  did-static:
    image: caddy:alpine
    command: caddy file-server --root /usr/share/caddy --listen :80
    volumes:
      - ./did-logs:/usr/share/caddy/.well-known/did:ro
    networks:
      - shared_pod

  # --- Data Layer ---
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASS}
      POSTGRES_DB: dpp_db
    volumes:
      - pg_data:/var/lib/postgresql/data
    networks:
      - shared_pod

  # --- Microservices ---
  identity:
    build:
      context: ..
      dockerfile: deployment/Dockerfile.identity
    env_file: .env
    environment:
      - SERVICE_ROLE=identity
      - DB_HOST=postgres
      - STORAGE_ROOT=/var/www/did-logs
    depends_on:
      - postgres
    networks:
      - shared_pod
    volumes:
      - ./did-logs:/var/www/did-logs

  witness:
    build:
      context: ..
      dockerfile: deployment/Dockerfile.witness
    env_file: .env
    environment:
      - SERVICE_ROLE=witness
      - DB_HOST=postgres
      # Use internal service name for blockchain
      - RPC_URL=http://blockchain:8545
    depends_on:
      - postgres
      - blockchain
    networks:
      - shared_pod

  watcher:
    build:
      context: ..
      dockerfile: deployment/Dockerfile.watcher
    env_file: .env
    environment:
      - SERVICE_ROLE=watcher
      - DB_HOST=postgres
      # Use internal service name for blockchain
      - RPC_URL=http://blockchain:8545
    depends_on:
      - postgres
      - blockchain
    networks:
      - shared_pod

  # --- Local Blockchain (Included for Local Dev/Demo) ---
  blockchain:
    image: ghcr.io/nomicfoundation/hardhat:latest
    # Simple command to run standard node
    command: ["npx", "hardhat", "node", "--hostname", "0.0.0.0"]
    ports:
      - "8545:8545" # Exposed for host interactions (Metamask/Remix)
    networks:
      - shared_pod

volumes:
  caddy_data:
  caddy_config:
  pg_data:

networks:
  shared_pod:
    driver: bridge
```

### 5.3 Environment Template

**File:** `deployment/.env.example`

```bash
# Blockchain (Local Hardhat Node)
# Use 'http://blockchain:8545' for internal pod communication
RPC_URL=http://blockchain:8545
# Hardhat Account #0 Private Key (TEST ONLY)
RELAYER_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
CONTRACT_ADDRESS=0x...

# Database (PostgreSQL)
DB_USER=dpp_admin
DB_PASS=secure_password_change_me
DB_HOST=postgres
DB_PORT=5432
DB_NAME=dpp_db

# Service Configuration
PORT=3000
NODE_ENV=production
FRONTEND_URL=https://webvh.web3connect.nl

# Security Note:
# Do NOT commit real keys to git.
```

### 5.4 Microservice Dockerfiles

**File:** `deployment/Dockerfile.identity` (Same pattern for `witness` and `watcher`)

```dockerfile
# Shared Multi-stage Build for Node Services
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
# Install Code Dependencies (Manual add for production listing)
RUN npm install didwebvh-ts merkletreejs ethers @noble/hashes @noble/ed25519
COPY . .
RUN npm run build

# --- Service Runtime Image ---
FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Environment determines which Service Entrypoint is used (or separate Dockerfiles)
# For strict separation, we use separate CMDs or Dockerfiles.
# Here is the Identity Service CMD:
CMD ["node", "dist/services/identity/index.js"]
```

**File:** `deployment/Dockerfile.witness`

```dockerfile
# ... (Same builder stage) ...
FROM node:18-alpine
# ... (Same copy steps) ...
CMD ["node", "dist/services/witness/index.js"]
```

**File:** `deployment/Dockerfile.watcher`

```dockerfile
# ... (Same builder stage) ...
FROM node:18-alpine
# ... (Same copy steps) ...
CMD ["node", "dist/services/watcher/index.js"]
```
