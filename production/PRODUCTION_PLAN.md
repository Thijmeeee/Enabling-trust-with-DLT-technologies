# Production Rollout Plan: Trust with DLT Technologies

## Executive Summary

This document provides a **complete, production-ready architecture and deployment plan** for transitioning the "Enabling Trust with DLT Technologies" prototype into a live environment on the Ethereum Sepolia testnet.

**Key Objectives:**
- **Zero-Cost Infrastructure**: Deploy on School VM (Ubuntu) using lightweight, open-source components.
- **Verifiable Identity (`did:webvh`)**: Implement a compliant, self-hosted Identity Service with hash-chained logs.
- **Trust Anchoring**: Batch and anchor event proofs to Ethereum Sepolia.
- **Privacy & Security**: Run strictly containing services using Docker to prevent environment pollution.

> **Note on Implementation Details**: All source code, configuration files (Caddyfile, Dockerfile), and smart contracts have been moved to **[PRODUCTION_CODE.md](./PRODUCTION_CODE.md)** to keep this strategic plan clean and readable.

---

## 1. System Landscape & Architecture

### 1.1 System Components Overview

| Component | Role | Rationale |
| :--- | :--- | :--- |
| **Frontend** | React + Vite | Client-side application for scanning and verifying passports. |
| **Web Server** | **Caddy** | Secure Reverse Proxy & Automatic HTTPS. Serves static DID logs and routes API traffic. |
| **Identity Service** | Node.js (Active) | **Active Server Process**. Manages DID creation, key rotation, and log chaining logic. |
| **Trust Engine** | Node.js (Module) | Handles event batching, Merkle tree construction, and Ethereum anchoring. |
| **Database** | SQLite | Local, persistent storage for events and identity state. Docker volume mounted. |
| **Infrastructure** | **Docker Containers** | strict isolation of services to maintain VM hygiene. |

### 1.2 Interaction Diagram

```mermaid
graph TD
    %% --- User Layer ---
    subgraph Users ["Stakeholder Actors"]
        Manufacturer([Manufacturer])
        Verifier([Customer / Supervisor])
        Witness([Witness Validator])
        Watcher([Watcher Monitor])
        ExtApp([External App])
    end

    %% --- School VM (Docker Host) ---
    subgraph VM ["School VM (<VM_IP>)"]
        direction TB
        
        subgraph Proxy ["Ingress Layer"]
            Caddy[("Caddy Web Server<br/>(Rev. Proxy & TLS)")]
        end
        
        subgraph Containers ["Application Containers"]
            IdentityService[("Identity Service<br/>(Key Mgmt & Signing)")]
            TrustEngine[("Trust Engine<br/>(Anchoring & Proofs)")]
            Frontend[("Frontend Host")]
        end
        
        subgraph Storage ["Persistent Storage"]
            SQLite[("SQLite DB")]
            Disk[("Static DID Logs<br/>(.well-known/did)")]
        end
    end

    %% --- External ---
    subgraph External ["External Trust Layer"]
        Alchemy[("Alchemy RPC")]
        Sepolia[("Ethereum Sepolia")]
    end

    %% --- Relations ---
    Manufacturer -->|1. Create/Sign Event| Caddy
    Verifier -->|2. Resolve DID / Verify| Caddy
    Witness -->|3. Attest Individual Events| Caddy
    Watcher -->|4. Monitor DID Logbooks| Caddy
    ExtApp -->|5. Use Identity API| Caddy

    Caddy -->|/api/*| IdentityService
    Caddy -->|/.well-known/did/*| Disk
    Caddy -->|/*| Frontend

    IdentityService -->|Manage Keys| SQLite
    IdentityService -->|Write Logs| Disk
    IdentityService -->|Store Attestations| SQLite
    
    IdentityService -.->|Trigger Anchor| TrustEngine
    TrustEngine -->|Read Events| SQLite
    TrustEngine -->|Anchor Root| Alchemy
    Alchemy -->|Tx Config| Sepolia
    
    Witness -.->|Validate Signature| Disk
    Watcher -.->|Audit Hash Chain| Disk
    Watcher -.->|Verify Anchors| Sepolia
```

### 1.3 System Technology Stack

| Component | Technology | Rationale |
| :--- | :--- | :--- |
| **Container Engine** | **Docker + Compose** | Ensures reproducible builds and prevents "it works on my machine" issues. Keeps the host VM clean. |
| **Proxy / Web** | **Caddy** | Chosen over Nginx for its automatic HTTPS management and simpler configuration syntax. |
| **Backend Runtime** | **Node.js** | Unified runtime for both Identity logic and Trust logic. |
| **Database** | **SQLite** | Serverless, zero-config, file-based storage perfect for this scale and VM topology. |
| **Blockchain** | **Ethereum Sepolia** | Industry standard for secure, immutable anchoring. |

### 1.4 Stakeholder Roles in Trust Model

#### Witness Validators
**Purpose**: Independent third parties that attest to individual DID events.

**How they work:**
1. Manufacturer creates an event (e.g., "Window produced")
2. Witness receives notification or polls for new events
3. Witness validates:
   - Signature is cryptographically valid
   - Event data matches physical inspection
   - Hash chain is intact
4. Witness signs attestation and stores it
5. Attestation becomes part of the trust proof

**Technical flow:**
```
Witness → GET /.well-known/did/{scid}/did.jsonl
       → Verify Ed25519 signature on event
       → POST /api/witness/attest
       → Attestation stored in SQLite
```

#### Watcher Monitors
**Purpose**: Continuous monitoring agents that audit entire DID logbooks for integrity.

**How they work:**
1. Watcher periodically fetches complete `did.jsonl` logs
2. Validates entire hash chain from genesis to latest
3. Checks blockchain anchors match claimed Merkle roots
4. Raises alerts if:
   - Hash chain is broken
   - Signatures are invalid
   - Blockchain anchor mismatches
   - Unauthorized modifications detected

**Technical flow:**
```
Watcher → GET /.well-known/did/{scid}/did.jsonl (full log)
        → Validate hash(event[n]) == event[n+1].backlink
        → GET blockchain anchor at block X
        → Verify Merkle proof
        → POST /api/alerts if discrepancy found
```

**Key Difference:**
- **Witness** = Event-level attestation ("I verified this specific event")
- **Watcher** = System-level audit ("The entire logbook is consistent")

### 1.5 Identity Layer Capabilities & Extensibility

The Identity Service is designed as a **Generic Enabler**. While used here for the DPP, it exposes a standard API that can be used by other applications (e.g., Supply Chain Tracking, Credential Issuance).

#### Capabilities
- **DID Management**: Create (`did:webvh`), Deactivate, Update.
- **Key Rotation**: Securely rotate cryptographic keys without breaking identity history.
- **Signing Oracle**: Sign arbitrary payloads (VCs, Events) using the managed keys.
- **Log Chaining**: Automatically calculate back-links and hash chains for compliance.

#### Extensibility API
External applications can integrate via REST:
- `POST /api/identity/create`: Generate new DID.
- `POST /api/identity/sign`: Request a signature for a payload.
- `GET /.well-known/did/{scid}`: Standard resolution (handled by Caddy).

---

## 2. Component Functionality Map

| Component | Primary Responsibilities | Inputs | Outputs |
| :--- | :--- | :--- | :--- |
| **Caddy** | - TLS Termination<br>- Static File Serving (Logbook)<br>- Request Routing | HTTPS Requests | Static Files, Proxied API Calls |
| **Identity Service** | - Key Generation (Ed25519)<br>- Log Appending (Hash Chain)<br>- Signature Generation | JSON Payloads | Signed Objects, Updated DID Logs (`did.jsonl`) |
| **Trust Engine** | - Event Aggregation<br>- Merkle Tree Construction<br>- Blockchain Interaction | Signed Events | Anchor Transactions, Merkle Proofs |
| **Frontend** | - QR Scanning<br>- **Client-Side Verification**<br>- Data Visualization | User Interaction | Verification Status (Valid/Invalid) |

---

## 3. Technical Concepts Explained

This section provides detailed explanations of the core technologies and architectural patterns used in the system. Understanding these concepts is crucial for successful deployment and maintenance.

### 3.1 Reverse Proxy (Caddy's Primary Role)

**What it is**: A server that sits between clients (internet) and your backend services, forwarding requests to the appropriate service.

**Problem without Reverse Proxy:**
```
Internet → Direct connections to:
  - Frontend server (port 3000)
  - Identity Service (port 4000)
  - Static files (port 5000)

Issues:
  - Each service needs public IP or port exposure
  - Complex firewall rules
  - No centralized security
  - Multiple SSL certificates needed
```

**Solution with Caddy Reverse Proxy:**
```
Internet → Caddy (single entry: port 443)
           ├─ webvh.nl/           → Frontend container
           ├─ webvh.nl/api/       → Identity Service
           └─ webvh.nl/.well-known/ → Static DID logs

Benefits:
  ✓ Single public endpoint
  ✓ Hides internal architecture
  ✓ Centralized SSL/TLS management
  ✓ Easy to add services without exposing new ports
```

**Concrete Example in Production:**
```
User Request: https://webvh.web3connect.nl/api/events
              ↓
           Caddy receives on port 443
              ↓
           Matches /api/* rule
              ↓
           Forwards to identity-service:3000
              ↓
           Identity Service processes /events
              ↓
           Response flows back through Caddy
              ↓
           User receives HTTPS response
```

**Caddyfile Configuration:**
```
webvh.web3connect.nl {
    # Reverse proxy for API
    reverse_proxy /api/* identity-service:3000
    
    # Serve static DID logs
    handle /.well-known/did/* {
        root * /var/www/did-logs
        file_server
    }
    
    # Default: serve frontend
    root * /var/www/frontend
    file_server
}
```

### 3.2 TLS Certificate Automation

**The Manual Problem (Traditional Approach):**
1. Generate Certificate Signing Request (CSR) manually
2. Submit to Certificate Authority (CA)
3. Verify domain ownership via email/DNS
4. Download and install certificate files
5. Configure web server with cert paths
6. Set reminder for renewal in 90 days
7. Repeat entire process before expiry

**Caddy's Automatic Solution:**
```
You write:
  webvh.web3connect.nl { }

Caddy automatically:
  1. Detects HTTPS is needed
  2. Contacts Let's Encrypt API
  3. Completes ACME challenge (HTTP-01 or TLS-ALPN-01)
  4. Receives certificate
  5. Installs certificate
  6. Serves HTTPS immediately
  7. Auto-renews at 60 days (30 days before expiry)
```

**What happens behind the scenes:**
```
Startup:
  Caddy → "I need a cert for webvh.web3connect.nl"
  Caddy → Contacts Let's Encrypt
  LE    → "Prove you own this domain"
  Caddy → Serves special challenge file at /.well-known/acme-challenge/
  LE    → Verifies by fetching that file
  LE    → "Verified! Here's your certificate"
  Caddy → Installs cert + private key
  Caddy → Redirects all HTTP → HTTPS automatically

Every 60 days:
  Caddy → Checks cert expiry
  Caddy → Automatically renews if < 30 days remaining
  Caddy → Zero downtime (hot-swaps certificate)
```

**Result**: Green padlock 🔒 in browser without any manual work!

### 3.3 Scheduled Tasks (Cron-Style Batch Processing)

**What is Cron?**
A Unix time-based job scheduler. Think of it as an alarm clock for servers.

**Traditional Cron Syntax:**
```bash
# Format: minute hour day month weekday command
*/10 * * * * /usr/bin/node /app/anchor.js

Breakdown:
  */10 = Every 10 minutes
  *    = Every hour
  *    = Every day
  *    = Every month
  *    = Every weekday
```

**In Production Plan Context:**
The Trust Engine runs "cron-achtig" (=cron-style) meaning it executes periodically, not continuously.

**Implementation Options:**

**Option 1: System Cron (in container)**
```dockerfile
# Dockerfile
FROM node:20-alpine
RUN apk add --no-cache dcron
COPY crontab /etc/crontabs/root
CMD crond -f -l 2
```

**Option 2: Node.js Scheduler (Recommended)**
```javascript
const cron = require('node-cron');

// Every 10 minutes
cron.schedule('*/10 * * * *', async () => {
  console.log('[Trust Engine] Starting batch anchor...');
  const events = await db.getPendingEvents();
  if (events.length > 0) {
    const merkleRoot = buildMerkleTree(events);
    await anchorToBlockchain(merkleRoot);
    console.log(`[Trust Engine] Anchored ${events.length} events`);
  }
});

console.log('Trust Engine scheduler started');
```

**Comparison with Active Service:**

| Aspect | Identity Service (Active) | Trust Engine (Cron-style) |
|--------|---------------------------|---------------------------|
| **Runtime** | 24/7 continuous | Sleeps between intervals |
| **Trigger** | Incoming HTTP requests | Time-based automatic |
| **CPU Usage** | Idle most of time, spikes on request | Brief spike every 10 min |
| **Purpose** | Respond to users immediately | Aggregate and batch process |

**Why use cron-style for Trust Engine?**
- Batching events is more gas-efficient (1 tx for 100 events vs 100 txs)
- No need for real-time anchoring (10 min delay acceptable)
- Reduces blockchain costs significantly

### 3.4 Docker Volumes (Persistent Storage)

**The Container Ephemeral Problem:**
```
Without volumes:
  docker-compose up   → Containers start, SQLite created
  docker-compose down → Containers deleted, SQLite GONE ❌
  docker-compose up   → Fresh containers, empty database
```

**Docker Volume Solution:**
```
With volumes:
  docker-compose up   → Containers start, mount volume
  docker-compose down → Containers deleted, volume REMAINS ✓
  docker-compose up   → New containers, same data
```

**Visual Architecture:**
```
┌──────────────────────────────────┐
│  Identity Service Container      │
│  (can be deleted/recreated)      │
│                                   │
│  /app/data/events.db ←───────┐  │
│                               │  │
└───────────────────────────────┘  │
                                   │
                          Mount point
                                   │
┌──────────────────────────────────┼──┐
│  Docker Volume: "db-data"        │  │
│  (persists on host VM)           ▼  │
│                                     │
│  /var/lib/docker/volumes/           │
│    db-data/_data/                   │
│      └─ events.db ← ACTUAL DATA    │
└─────────────────────────────────────┘
     ↑ Survives container deletion!
```

**docker-compose.yml Configuration:**
```yaml
version: '3.8'

services:
  identity-service:
    image: identity:latest
    volumes:
      # Named volume (Docker-managed)
      - db-data:/app/data
      # Bind mount (host directory)
      - ./did-logs:/app/logs

  trust-engine:
    image: trust:latest
    volumes:
      # Same volume = shared database
      - db-data:/app/data

volumes:
  # Declare named volume
  db-data:
    driver: local
```

**Two Types of Volumes:**

**1. Named Volumes (Recommended for databases):**
```yaml
volumes:
  - db-data:/app/data

# Docker manages location
# Stored in: /var/lib/docker/volumes/db-data/
# Commands:
#   docker volume ls          # List volumes
#   docker volume inspect db-data  # See details
#   docker volume rm db-data  # Delete (careful!)
```

**2. Bind Mounts (Good for configs/logs):**
```yaml
volumes:
  - ./production/did-logs:/var/www/did-logs

# You control location (current directory)
# Easy to inspect: just check ./production/did-logs/
# Can edit files directly on host
```

**Practical Example:**
```bash
# Start system
docker-compose up -d

# Create some data
curl -X POST https://webvh.nl/api/events -d '{"type":"test"}'
# → Data stored in db-data volume

# Simulate crash/update
docker-compose down

# Restart
docker-compose up -d

# Data still there!
curl https://webvh.nl/api/events
# → Returns previously created event ✓
```

### 3.5 Caddy Web Server

**What is Caddy?**
A modern, open-source web server that prioritizes ease of use and automatic HTTPS.

**Comparison with Nginx:**

| Feature | Nginx | Caddy |
|---------|-------|-------|
| **HTTPS Setup** | Manual cert management | Fully automatic |
| **Config Syntax** | Complex, error-prone | Simple, human-readable |
| **Reload Config** | `nginx -s reload` | Automatic hot reload |
| **Default Security** | Must configure | Secure by default (TLS 1.3, etc.) |
| **Learning Curve** | Steep | Gentle |
| **Use Case** | Large-scale production | Fast prototyping, SME deployments |

**Real Configuration Comparison:**

**Nginx (Traditional):**
```nginx
# Redirect HTTP to HTTPSserver {
    listen 80;
    server_name webvh.web3connect.nl;
    return 301 https://$server_name$request_uri;
}

# HTTPS Server
server {
    listen 443 ssl http2;
    server_name webvh.web3connect.nl;
    
    # SSL Certificates (manual management)
    ssl_certificate /etc/letsencrypt/live/webvh.web3connect.nl/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/webvh.web3connect.nl/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    
    # Reverse Proxy for API
    location /api/ {
        proxy_pass http://identity-service:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Serve DID logs
    location /.well-known/did/ {
        alias /var/www/did-logs/;
        try_files $uri $uri/ =404;
    }
    
    # Frontend
    location / {
        root /var/www/frontend;
        try_files $uri $uri/ /index.html;
    }
}
```

**Caddy (Modern):**
```
webvh.web3connect.nl {
    reverse_proxy /api/* identity-service:3000
    
    handle /.well-known/did/* {
        root * /var/www/did-logs
        file_server
    }
    
    root * /var/www/frontend
    try_files {path} /index.html
    file_server
}
```

**What Caddy Does Automatically:**
1. ✅ HTTP → HTTPS redirect
2. ✅ SSL certificate acquisition (Let's Encrypt)
3. ✅ Certificate renewal (every 60 days, auto)
4. ✅ Secure TLS configuration (1.2, 1.3, strong ciphers)
5. ✅ HTTP/2 enabled
6. ✅ Proper headers (`X-Forwarded-*`, etc.)
7. ✅ Config validation on reload
8. ✅ Graceful restarts (zero downtime)

**Why Chosen for Production Plan?**

| Requirement | How Caddy Solves It |
|-------------|---------------------|
| **Zero-cost SSL** | Automatic Let's Encrypt integration |
| **Simple deployment** | Single binary, no dependencies |
| **Low maintenance** | Auto-renewal, no manual intervention |
| **did:webvh compliance** | HTTPS mandatory, Caddy guarantees it |
| **Rapid iteration** | Config changes don't require restart |
| **No prior knowledge** | Readable config, no DevOps expertise needed |

**Caddy in Production Architecture:**
```
┌─────────────────────────────────────────────┐
│          Internet (Port 443)                │
└────────────────┬────────────────────────────┘
                 │
         ┌───────▼────────┐
         │  Caddy Container │
         │  - Auto HTTPS    │
         │  - Routing Logic │
         └───────┬──────────┘
                 │
      ┌──────────┼──────────┬─────────────┐
      │          │           │             │
 ┌────▼───┐ ┌───▼────┐ ┌───▼────┐  ┌────▼─────┐
 │Frontend│ │Identity│ │ DID    │  │/health   │
 │ (SPA)  │ │Service │ │ Logs   │  │(Status)  │
 └────────┘ └────────┘ └────────┘  └──────────┘
```

---

## 4. Data & Process Flows

### 3.1 Sequence: Event Creation & Anchoring

```mermaid
sequenceDiagram
    participant M as Manufacturer
    participant I as Identity Service
    participant T as Trust Engine
    participant D as Database
    participant B as Blockchain

    M->>I: POST /events (Payload)
    I->>I: Sign Payload (Ed25519)
    I->>D: Store "Pending" Event
    I-->>M: 202 Accepted

    loop Every 10 Minutes (Batch)
        T->>D: Fetch Pending Events
        T->>T: Build Merkle Tree
        T->>B: Anchor Root Hash (Tx)
        B-->>T: Receipt (Block #123)
        T->>D: Update Status="Anchored"
        T->>D: Store Merkle Proofs
    end
```

### 3.2 State Diagram: DPP Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Draft
    Draft --> Created: Manufacturer Signs
    Created --> Active: First Scan/Transport
    Active --> Updated: Event Added
    Updated --> Updated: Event Added
    Active --> EndOfLife: Recycled/Disposed
    EndOfLife --> [*]

    state Active {
        [*] --> InTransit
        InTransit --> InStock
        InStock --> Sold
    }
```

---

## 5. End-to-End Witness & Watcher Flows

This section provides concrete, step-by-step explanations of how the witness/watcher system operates using Merkle tree batching for scalable anchoring.

### 5.1 How Users Request and Receive DIDs

**Question**: "Hoe kan ik als gebruiker zo'n did.json aanvragen?"

**Answer**: Users don't directly request a `did.json`—instead, the system follows the **`did:webvh` specification** which uses `did.jsonl` (JSON Lines format) for the DID log.

**Step-by-Step Flow:**

```
1. Manufacturer Action: Create New Window
   POST https://webvh.web3connect.nl/api/products/create
   Body: {
     "type": "window",
     "model": "W-1200x1000-E30",
     "metadata": { ... }
   }

2. Identity Service Response:
   {
     "did": "did:webvh:webvh.web3connect.nl:scid:abc123xyz",
     "versionId": "1",
     "status": "pending_witness"
   }

3. Automatic File Generation:
   /.well-known/did/abc123xyz/did.jsonl         ← DID Log (event history)
   /.well-known/did/abc123xyz/did-witness.json  ← Witness proofs

4. User Verification (later):
   GET https://webvh.web3connect.nl/.well-known/did/abc123xyz/did.jsonl
   → Returns full verifiable log
```

**File Structure After Creation:**
```
/var/www/did-logs/
└── abc123xyz/
    ├── did.jsonl          ← Event log with hash chain
    └── did-witness.json   ← Witness attestations & Merkle proofs
```

**Implementation:** See [PRODUCTION_CODE.md § 3.1](./PRODUCTION_CODE.md#31-product-creation-endpoint) for the complete `POST /api/products/create` endpoint implementation.

### 5.2 How did.jsonl is Updated

**Question**: "Hoe wordt de did.jsonl aangevuld?"

**Answer**: The `did.jsonl` is append-only and updated through a **witness-first workflow** to ensure integrity.

**Complete Update Flow:**

```
Step 1: Controller Creates Update
  Manufacturer → POST /api/events
  {
    "did": "did:webvh:...abc123xyz",
    "type": "transport",
    "data": { "location": "Rotterdam" }
  }

Step 2: Identity Service Prepares Entry
  - Generates versionId: "2"
  - Computes logEntryHash (sha256 of new entry)
  - Creates backlink to previous entry (hash chain)
  - Signs with controller key
  - Status: "pending_witness" (NOT published yet!)

Step 3: Request Witness Attestations
  Identity Service → Witness APIs (3 witnesses)
  POST https://witness1.example.com/api/attest
  {
    "did": "did:webvh:...abc123xyz",
    "versionId": "2",
    "logEntryHash": "ca978112...",
    "previousHash": "3e23e816...",
    "controllerSignature": "a3f12bc..."
  }

Step 4: Witnesses Verify & Sign
  Each witness:
    1. Fetches current did.jsonl
    2. Verifies hash chain integrity
    3. Validates controller signature
    4. Creates Data Integrity Proof:
       {
         "type": "DataIntegrityProof",
         "created": "2025-12-14T17:30:00Z",
         "verificationMethod": "did:web:witness1.example.com#key-1",
         "signature": "fb8e20fc2e4c3f..."
       }
    5. Returns proof to controller

Step 5: Controller Publishes Witness Proofs
  Identity Service writes to did-witness.json:
  [
    {
      "versionId": "2",
      "leafHash": "ca978112...",
      "merkleIndex": null,        ← Not batched yet
      "merkleProof": null,        ← Will be added later
      "witnessProofs": [
        { /* witness1 proof */ },
        { /* witness2 proof */ },
        { /* witness3 proof */ }
      ]
    }
  ]

Step 6: Publish Log Entry to did.jsonl
  ONLY after did-witness.json is updated:
  
  echo '{"versionId":"2","timestamp":"...","type":"transport",...}' >> did.jsonl

Step 7: Batch Anchoring (every 10 minutes)
  Trust Engine:
    1. Collects all pending updates (across ALL DIDs)
    2. Builds Merkle tree:
       Leaves = [hash(did1-v2), hash(did2-v5), hash(abc123xyz-v2), ...]
    3. Computes Merkle root
    4. Anchors root to Ethereum
    5. Updates did-witness.json with Merkle proofs

Step 8: did-witness.json Updated with Merkle Proof
  [
    {
      "versionId": "2",
      "leafHash": "ca978112...",
      "merkleIndex": 152,         ← Position in global tree
      "merkleProof": [             ← Path to root
        "2e7d2c03a9507ae...",
        "18ac3e7343f016...",
        "252f10c83610eb..."
      ],
      "witnessProofs": [ ... ]
    }
  ]
```

**Key Principle:** The `did-witness.json` file MUST be updated BEFORE `did.jsonl` to ensure atomic witnessing. This invariant is enforced in code to prevent publishing unwitnessed events.

**Implementation:** See [PRODUCTION_CODE.md § 3.2](./PRODUCTION_CODE.md#32-event-addition-with-witness-first-workflow) for:
- Complete `addEvent()` function with witness-first workflow
- Invariant enforcement code
- Witness attestation request logic

### 5.3 How Watchers Detect Fraudulent Events

**Question**: "Hoe controleert een watcher welke event niet klopt in de merkle tree?"

**Answer**: Watchers perform **independent cryptographic verification** by reconstructing the Merkle root and comparing it to the blockchain anchor.

**Watcher Verification Algorithm:**

```
Input: DID to audit (e.g., did:webvh:...abc123xyz)

Step 1: Fetch Files
  didLog = GET /.well-known/did/abc123xyz/did.jsonl
  witnessFile = GET /.well-known/did/abc123xyz/did-witness.json

Step 2: For Each Log Entry (versionId 1 → N):
  entry = didLog[i]
  witnessData = witnessFile.find(w => w.versionId == entry.versionId)
  
  ✓ Check 1: Hash Chain Integrity
    computed = hash(entry)
    if (didLog[i+1].previousHash !== computed) {
      ALERT: "Hash chain broken at version ${entry.versionId}"
    }
  
  ✓ Check 2: Controller Signature Valid
    if (!verify(entry.proof.signature, controllerPublicKey, entry)) {
      ALERT: "Invalid controller signature at version ${entry.versionId}"
    }
  
  ✓ Check 3: Witness Threshold Met
    if (witnessData.witnessProofs.length < 3) {
      ALERT: "Insufficient witnesses for version ${entry.versionId}"
    }
  
  ✓ Check 4: Witness Signatures Valid
    for each proof in witnessData.witnessProofs:
      witnessKey = resolve(proof.verificationMethod)
      if (!verify(proof.signature, witnessKey, witnessData.leafHash)) {
        ALERT: "Invalid witness signature from ${proof.verificationMethod}"
      }
  
  ✓ Check 5: Merkle Proof Valid (if anchored)
    if (witnessData.merkleProof !== null) {
      // Reconstruct root using Merkle path
      currentHash = witnessData.leafHash
      for each sibling in witnessData.merkleProof:
        currentHash = hash(currentHash + sibling) // Merkle hashing
      
      // Fetch blockchain anchor
      anchorRoot = getBlockchainAnchor(blockNumber)
      
      if (currentHash !== anchorRoot) {
        ALERT: "Merkle proof verification failed for version ${entry.versionId}"
        ALERT: "Expected root: ${anchorRoot}, computed: ${currentHash}"
      }
    }

Step 3: Cross-Check Published vs Witnessed
  publishedVersions = didLog.map(e => e.versionId)
  witnessedVersions = witnessFile.map(w => w.versionId)
  
  orphanedProofs = witnessedVersions.filter(v => !publishedVersions.includes(v))
  if (orphanedProofs.length > 0) {
    ALERT: "Controller published witness proofs but not log entries: ${orphanedProofs}"
  }

Result: VALID or ALERT[]
```

**Concrete Example of Fraud Detection:**

**Scenario**: Malicious controller tries to remove event versionId "5" after anchoring.

```
Original State (Honest):
  did.jsonl:
    v1: {..., hash: "aaa"}
    v2: {..., hash: "bbb", prev: "aaa"}
    v3: {..., hash: "ccc", prev: "bbb"}
    v4: {..., hash: "ddd", prev: "ccc"}
    v5: {..., hash: "eee", prev: "ddd"} ← Controller wants to delete this
    v6: {..., hash: "fff", prev: "eee"}
  
  Merkle Tree (already anchored):
    Leaves: ["aaa", "bbb", "ccc", "ddd", "eee", "fff"]
    Root: "xyz123" (on blockchain)

Fraudulent Attempt:
  Controller deletes v5 from did.jsonl:
    v1, v2, v3, v4, v6 (missing v5!)

Watcher Detection:
  1. Reads did.jsonl → Missing v5
  2. Reads did-witness.json → v5 still has merkleProof!
  3. Tries to verify v6:
     - v6.previousHash = "eee"
     - But v5 is missing from log
     - Hash chain broken! ❌
  
  4. Reconstructs Merkle root:
     - Leaves without v5: ["aaa", "bbb", "ccc", "ddd", "fff"]
     - Computed root: "abc999"
     - Blockchain root: "xyz123"
     - Mismatch! ❌
  
  ALERT: "DID abc123xyz is COMPROMISED"
  Evidence: "Missing versionId 5, hash chain broken, Merkle root mismatch"
```

**Implementation:** See [PRODUCTION_CODE.md § 3.3](./PRODUCTION_CODE.md#33-watcher-audit-implementation) for:
- Complete `auditDID()` function with all 5 verification checks
- `verifyMerkleProof()` Merkle root reconstruction algorithm
- Alert generation and classification logic

### 5.4 UI/UX Integration

**Question**: "Hoe wordt de UI/UX geupdatet met deze nieuwe aanpassingen?"

**Answer**: The frontend displays **real-time verification status** by querying both DID logs and blockchain anchors.

**User Flow in Frontend:**

```
1. User Scans QR Code on Window
   QR Contains: did:webvh:webvh.web3connect.nl:scid:abc123xyz

2. Frontend Fetches DID Data
   const did = extractFromQR();
   const [didLog, witnessFile] = await Promise.all([
     fetch(`/.well-known/did/${scid}/did.jsonl`),
     fetch(`/.well-known/did/${scid}/did-witness.json`)
   ]);

3. Client-Side Verification (Progressive Display)
   
   ✓ Step 1: Show Product Info (fast)
     Display: "Window W-1200x1000-E30"
     Display: "Manufactured: 2025-01-15"

   ✓ Step 2: Verify Hash Chain (fast, ~100ms)
     for each entry: check hash(entry[i]) === entry[i+1].previousHash
     Display: "✓ Event history intact"

   ✓ Step 3: Verify Witness Signatures (medium, ~500ms)
     for each witness proof: verify Ed25519 signature
     Display: "✓ Attested by 3 independent witnesses"

   ✓ Step 4: Verify Blockchain Anchor (slow, ~2s)
     if (witnessFile[latest].merkleProof) {
       const root = reconstructMerkleRoot(leafHash, merkleProof);
       const onChainRoot = await contract.getMerkleRoot(blockNumber);
       if (root === onChainRoot) {
         Display: "✓ Anchored on Ethereum Sepolia (Block #123456)"
       }
     } else {
       Display: "⏳ Pending blockchain anchor (next batch)"
     }

4. Trust Score Calculation
   score = 0
   if (hashChainValid) score += 30;
   if (witnessProofsValid >= 3) score += 40;
   if (blockchainAnchorValid) score += 30;
   
   Display: "Trust Score: ${score}/100"
   Color: score > 90 ? green : score > 60 ? yellow : red

5. Event Timeline Display
   for each event in didLog:
     const witness = witnessFile.find(w => w.versionId === event.versionId);
     render({
       time: event.timestamp,
       type: event.type,
       witnessed: witness.witnessProofs.length >= 3 ? "✓" : "⏳",
       anchored: witness.merkleProof ? "✓" : "⏳"
     });
```

**UI Components:** See [PRODUCTION_CODE.md § 4.2](./PRODUCTION_CODE.md#42-react-trust-validation-component) for the complete `TrustValidationTab` React component with progressive verification display.

**New Dashboard Features:**

1. **Witness Dashboard** (already exists)
   - Shows all pending attestation requests
   - Allows witnesses to approve/reject events
   - Displays signing status per event

2. **Watcher Dashboard** (already exists)
   - Shows audit results for all monitored DIDs
   - Alerts for integrity violations
   - Merkle proof verification status

3. **Consumer View** (enhanced)
   - Shows visual trust indicators
   - Displays witness names/logos
   - Shows blockchain transaction link

### 5.5 Complete New Window Creation Flow

**Question**: "Als de manufacturer een nieuwe window wordt aangemaakt, hoe wordt dit in het nieuwe systeem toegevoegd?"

**Answer**: Complete end-to-end flow from UI click to blockchain anchor.

**Full Lifecycle:**

```
═══════════════════════════════════════════════════════
 TIME: T+0 seconds - MANUFACTURER CREATES WINDOW
═══════════════════════════════════════════════════════

1. Manufacturer Dashboard (UI)
   User clicks: "Create New Window"
   Form: {
     model: "W-1200x1000-E30",
     glass: "Triple glazing",
     frame: "Aluminum"
   }
   → Submit

2. Frontend POST Request
   POST /api/products/create
   Headers: { Authorization: "Bearer <jwt>" }
   Body: { /* form data */ }

3. Identity Service (Container)
   a) Generate SCID
      scid = generateRandomSCID() // e.g., "8a7f3bc9"
   
   b) Create DID
      did = `did:webvh:webvh.web3connect.nl:scid:${scid}`
   
   c) Initial Log Entry
      entry = {
        versionId: "1",
        timestamp: "2025-12-14T18:00:00Z",
        operation: "create",
        data: { model, glass, frame },
        previousHash: null // Genesis
      }
   
   d) Sign Entry
      signature = Ed25519.sign(controllerPrivateKey, hash(entry))
      entry.proof = {
        type: "DataIntegrityProof",
        verificationMethod: "did:webvh:...#controller-key",
        signature
      }
   
   e) Write to Database
      await db.insertDPP({
        did,
        scid,
        model,
        lifecycle_status: "created"
      })

═══════════════════════════════════════════════════════
 TIME: T+100ms - REQUEST WITNESS ATTESTATIONS
═══════════════════════════════════════════════════════

4. Identity Service → Witness APIs
   leafHash = hash(entry)
   
   for each witness in [witness1, witness2, witness3]:
     POST https://witness{i}.example.com/api/attest
     {
       "did": "did:webvh:...8a7f3bc9",
       "versionId": "1",
       "logEntryHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
       "controllerSignature": "a3f12bc..."
     }

5. Witnesses Validate & Sign
   Each witness (independently):
     a) Verify controller signature ✓
     b) Check transaction is valid ✓
     c) Create attestation:
        {
          "type": "DataIntegrityProof",
          "created": "2025-12-14T18:00:01Z",
          "verificationMethod": "did:web:witness{i}.example.com#key-1",
          "signature": "fb8e20fc..."
        }
     d) Return to Identity Service

═══════════════════════════════════════════════════════
 TIME: T+2 seconds - PUBLISH DID FILES
═══════════════════════════════════════════════════════

6. Identity Service Publishes
   a) Create did-witness.json FIRST
      /var/www/did-logs/8a7f3bc9/did-witness.json
      [
        {
          "versionId": "1",
          "leafHash": "e3b0c442...",
          "merkleIndex": null,    ← Pending batch
          "merkleProof": null,    ← Will be added later
          "witnessProofs": [
            { /* witness1 signature */ },
            { /* witness2 signature */ },
            { /* witness3 signature */ }
          ]
        }
      ]
   
   b) Create did.jsonl SECOND
      /var/www/did-logs/8a7f3bc9/did.jsonl
      {"versionId":"1","timestamp":"2025-12-14T18:00:00Z",...}\n

   c) Update Database
      await db.updateDPP(scid, {
        status: "witnessed",
        anchor_status: "pending"
      })

7. Response to Frontend
   200 OK
   {
     "did": "did:webvh:...8a7f3bc9",
     "scid": "8a7f3bc9",
     "versionId": "1",
     "status": "witnessed",
     "qr_code": "data:image/png;base64,..." // QR with DID
   }

8. Frontend Displays
   ✓ "Window created successfully"
   ✓ "DID: did:webvh:...8a7f3bc9"
   ✓ "Witnessed by 3 validators"
   ⏳ "Blockchain anchor pending (next batch)"
   → Show QR code for printing

═══════════════════════════════════════════════════════
 TIME: T+10 minutes - BATCH ANCHORING
═══════════════════════════════════════════════════════

9. Trust Engine (Cron Trigger)
   a) Collect Pending Events
      events = await db.query(`
        SELECT scid, versionId, leafHash
        FROM pending_anchors
        WHERE anchor_status = 'pending'
      `)
      // Result: [
      //   { scid: "8a7f3bc9", versionId: "1", leafHash: "e3b0c442..." },
      //   { scid: "7f9e2da1", versionId: "5", leafHash: "3a8f7bc..." },
      //   ... (100 more events from different DIDs)
      // ]
   
   b) Build Merkle Tree
      leaves = events.map(e => e.leafHash)
      merkleTree = new MerkleTree(leaves)
      merkleRoot = merkleTree.getRoot()
      // Root: "9f2a8e3c1b5d4f7a6e8c2d9b3f1a5e7c4d2b8f6a3e9c1d5a7f2e4b6c8d3a9f1e"
   
   c) Anchor to Blockchain
      tx = await contract.anchorBatch(merkleRoot)
      receipt = await tx.wait()
      blockNumber = receipt.blockNumber // e.g., 456789
   
   d) Update Database
      for each (event, index) in events:
        merkleProof = merkleTree.getProof(index)
        await db.update(`
          UPDATE pending_anchors
          SET anchor_status = 'anchored',
              block_number = ${blockNumber},
              merkle_index = ${index},
              merkle_proof = '${JSON.stringify(merkleProof)}'
          WHERE scid = '${event.scid}' AND versionId = '${event.versionId}'
        `)
   
   e) Update did-witness.json Files
      for each event:
        witnessFile = read(`/did-logs/${event.scid}/did-witness.json`)
        witnessFile[0].merkleIndex = event.merkleIndex
        witnessFile[0].merkleProof = event.merkleProof
        write(`/did-logs/${event.scid}/did-witness.json`, witnessFile)

═══════════════════════════════════════════════════════
 TIME: T+11 minutes - FULLY ANCHORED
═══════════════════════════════════════════════════════

10. Consumer Verification (when scanned)
    User scans QR code → Frontend fetches:
    
    did.jsonl: 1 entry (create event)
    did-witness.json: {
      versionId: "1",
      leafHash: "e3b0c442...",
      merkleIndex: 0,
      merkleProof: ["3a8f7bc...", "7f2e9da..."],
      witnessProofs: [3 signatures]
    }
    
    Client-side verification:
      ✓ Hash chain valid
      ✓ Controller signature valid
      ✓ 3/3 witness signatures valid
      ✓ Merkle proof reconstructs correct root
      ✓ Root matches blockchain (Block #456789)
    
    Display: "✓ FULLY VERIFIED - Trust Score: 100/100"
```

**Code References** (see [PRODUCTION_CODE.md](./PRODUCTION_CODE.md)):
- § Identity Service API Endpoints: `/api/products/create` implementation
- § Witness Integration: Attestation request logic
- § Trust Engine Batching: Merkle tree construction & anchoring
- § Smart Contract: `anchorBatch(bytes32 merkleRoot)` function
- § Frontend Verification: Client-side Merkle proof verification

---

## 6. Pre-Requisites & Manual Setup (IMPORTANT)

**⚠️ You must complete these manual steps before deployment. These involve creating external accounts that cannot be automated.**

### 6.1 Create Alchemy Account & Get RPC URL
**Purpose**: Alchemy provides the connection to Ethereum Sepolia testnet without running your own node.
1. Go to [alchemy.com](https://www.alchemy.com/)
2. Sign up for a free account
3. Create a new App:
   - **Chain**: Ethereum
   - **Network**: Sepolia
   - **Name**: `DPP-Production`
4. Copy the **HTTPS URL** (looks like `https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY`)
5. Save this as `ALCHEMY_SEPOLIA_URL` for your `.env` file.

### 4.2 Create Ethereum Wallet (Deployer)
**Purpose**: You need a wallet with Sepolia ETH to deploy the smart contract.
1. Install [MetaMask](https://metamask.io/)
2. Create a new wallet and switch to **Sepolia Testnet**
3. Export your **Private Key** (Settings -> Security -> Export Private Key)
   - ⚠️ **NEVER share this or commit it to git!**
4. Save this as `DEPLOYER_PRIVATE_KEY` for your `.env` file.

### 4.3 Get Sepolia Test ETH
**Purpose**: Pay for gas fees (free on testnet).
1. Use a Faucet:
   - [Alchemy Sepolia Faucet](https://sepoliafaucet.com/)
   - [Google Cloud Web3 Faucet](https://cloud.google.com/application/web3/faucet/ethereum/sepolia)
2. Get at least **0.05 SepoliaETH**.

### 4.4 Create Relayer Wallet (Operational)
**Purpose**: A separate wallet for the backend to send daily anchor transactions.
1. Create a second account in MetaMask named `DPP-Relayer`
2. Export its Private Key.
3. Save as `RELAYER_PRIVATE_KEY` for your `.env` file.
4. Send **0.02 SepoliaETH** from your Deployer wallet to this Relayer wallet.

### 4.5 Configure DNS (Crucial for HTTPS)
**Purpose**: Point your domain to the VM so Caddy can provision an SSL certificate.
1. Log in to your Domain Registrar (e.g., TransIP, GoDaddy).
2. Go to DNS Management.
3. Add a new **A Record**:
   - **Name**: `webvh` (creates `webvh.web3connect.nl`)
   - **Value**: Your VM IP Address (e.g., `51.77.71.29`)
   - **TTL**: 5 min / Automatic.
4. Wait 5-10 minutes for propagation.

### 4.6 Server Preparation (On VM)
**Purpose**: Ensure the School VM is ready to run containers.
1. SSH into your VM.
2. Install Docker & Compose:
   ```bash
   sudo apt-get update
   sudo apt-get install -y docker.io docker-compose
   ```
3. Verify installation:
   ```bash
   docker --version
   docker-compose --version
   ```

---

## 5. Deployment Guide: Docker Strategy

**Motivation**: We use Docker to isolate our dependencies (Node.js version, Caddy version) from the host VM. This prevents "pollution" of the School VM and makes the system easy to start/stop/clean.

### 5.1 Instructions
(Detailed implementation logic is in **[PRODUCTION_CODE.md](./PRODUCTION_CODE.md)**)

1.  **Clone & Configure**:
    ```bash
    git clone <repo>
    cd deployment
    cp .env.example .env
    # Edit .env with the keys gathered in Section 4
    ```

2.  **Build & Run**:
    ```bash
    docker-compose up --build -d
    ```

3.  **Verify**:
    - Frontend: `https://webvh.web3connect.nl`
    - API Health: `https://webvh.web3connect.nl/health`
    - DID Resolution: `https://webvh.web3connect.nl/.well-known/did/<did>/did.jsonl`

---

## 6. Pre-Implementation Checklist

- [ ] **Repo Hygiene**: Run BFG/Filter-Branch to remove exposed IPs from git history.
- [ ] **Infrastructure**: Install Docker & Docker Compose on School VM.
- [ ] **Accounts**: Alchemy App Created + RPC URL.
- [ ] **Wallets**: Deployer & Relayer wallets created and funded (Sepolia ETH).
- [ ] **Environment**: `.env` file created locally (do not commit!).
