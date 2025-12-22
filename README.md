# DPP Trust System

A complete Digital Product Passport (DPP) Trust System demonstrating decentralized identity management, blockchain anchoring, and multi-stakeholder access control for the circular economy.

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Frontend (React + Vite)                     │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌─────────────┐ │
│  │ Manufacturer │ │   Witness    │ │   Watcher    │ │   Consumer  │ │
│  │  Dashboard   │ │  Dashboard   │ │  Dashboard   │ │    View     │ │
│  └──────────────┘ └──────────────┘ └──────────────┘ └─────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Backend (Node.js + Express)                     │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐                 │
│  │   Identity   │ │   Witness    │ │   Watcher    │                 │
│  │   Service    │ │   Service    │ │   Service    │                 │
│  │  (port 3000) │ │  (scheduled) │ │  (scheduled) │                 │
│  └──────────────┘ └──────────────┘ └──────────────┘                 │
└─────────────────────────────────────────────────────────────────────┘
         │                   │                    │
         ▼                   ▼                    ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────────────────┐
│   PostgreSQL    │ │    Hardhat      │ │   WitnessAnchorRegistry     │
│   (port 5432)   │ │  (port 8545)    │ │   (Smart Contract)          │
└─────────────────┘ └─────────────────┘ └─────────────────────────────┘
```

## 🚀 Quick Start (Windows - Development)

### Prerequisites
- Node.js 18+
- Podman or Docker Desktop
- Git

### Start All Services

```powershell
# Clone the repository
git clone <repository-url>
cd Enabling-trust-with-DLT-technologies

# Install dependencies
npm install
cd backend && npm install && cd ..
cd contracts && npm install && cd ..

# Start everything with one command
.\start-dev.ps1
```

This starts:
| Service | Port | Description |
|---------|------|-------------|
| Frontend | 5173 | React development server |
| Backend API | 3000 | Identity service REST API |
| Blockchain | 8545 | Hardhat local node (Chain ID: 31337) |
| Database | 5432 | PostgreSQL via Podman |

### Stop All Services

```powershell
.\stop-dev.ps1
```

## 🖥️ VM Deployment (Ubuntu 22.04)

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for full instructions.

```bash
# Quick deploy
chmod +x deploy-vm.sh stop-vm.sh
./deploy-vm.sh --deploy-contract
```

## 📁 Project Structure

```
├── src/                        # Frontend source code
│   ├── components/
│   │   ├── dashboards/         # Role-based dashboards
│   │   │   ├── ManufacturerDashboard.tsx
│   │   │   ├── WitnessDashboard.tsx
│   │   │   ├── WatcherDashboard.tsx
│   │   │   ├── RecyclerDashboard.tsx
│   │   │   └── ConsumerView.tsx
│   │   └── ...
│   ├── lib/
│   │   ├── api/                # Backend API client
│   │   ├── data/               # Data stores (hybrid, enhanced, local)
│   │   └── operations/         # DID operations (rotate, transfer)
│   └── App.tsx
│
├── backend/                    # Backend services
│   ├── services/
│   │   ├── identity/           # Identity management API
│   │   ├── keyManagement/      # Secure key storage
│   │   ├── witness/            # Merkle tree anchoring service
│   │   └── watcher/            # Audit verification service
│   ├── utils/                  # Verification utilities
│   └── db/
│       ├── schema.sql          # Database schema
│       └── seed.sql            # Demo data
│
├── contracts/                  # Smart contracts (Solidity)
│   ├── contracts/
│   │   └── WitnessAnchorRegistry.sol
│   └── scripts/
│       └── deploy.ts
│
├── docs/                       # Documentation
│   ├── DEPLOYMENT.md           # VM deployment guide
│   ├── SETUP.md                # Setup instructions
│   └── SKILLS.md               # Skills documentation
│
├── scripts/                    # Utility scripts
│   └── add-dark-mode.js
│
├── start-dev.ps1               # Windows dev startup script
├── stop-dev.ps1                # Windows dev stop script
├── deploy-vm.sh                # Ubuntu VM deployment script
├── stop-vm.sh                  # Ubuntu VM stop script
├── .env.example                # Environment template
└── README.md                   # This file
```

## 🔐 Stakeholder Roles

| Role | Description | Capabilities |
|------|-------------|--------------|
| **Manufacturer** | Creates products and DPPs | Create DPP, Transfer ownership, Rotate keys |
| **Witness** | Validates DID operations | Approve/Reject key rotations, ownership transfers |
| **Watcher** | Audits system integrity | Verify Merkle proofs, Hash chain validation |
| **Recycler** | End-of-life handler | View product composition, Mark as recycled |
| **Consumer** | End user | Scan QR, View product info |
| **Supervisor** | System admin | View all operations, Compliance reporting |

## 🔗 Trust Layer Components

### 1. Identity Service (Backend)
- Creates DIDs (Decentralized Identifiers)
- Manages identity lifecycle
- REST API at `http://localhost:3000/api`

### 2. Witness Service
- Batches events into Merkle trees
- Anchors Merkle roots to blockchain
- Runs on cron schedule

### 3. Watcher Service
- Verifies hash chain integrity
- Validates Merkle proofs against chain
- Logs audit results

### 4. Smart Contract (WitnessAnchorRegistry)
- Stores Merkle roots on-chain
- Access control (only authorized witnesses)
- Immutable audit trail

## 🛠️ API Endpoints

### Identity Service (port 3000)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| POST | `/api/identities` | Create new identity |
| GET | `/api/identities` | List all identities |
| GET | `/api/identities/:did` | Get identity by DID |
| GET | `/api/identities/:did/events` | Get events for DID |
| GET | `/api/events` | List all events |
| GET | `/api/batches` | List all batches |
| GET | `/api/audits` | List all audits |

## 🧪 Demo Data

The system comes with demo products:
- 3 Windows (Triple Glass, Double Glass, Smart Window)
- 2 Glass panels
- 2 Frames

Demo data is loaded automatically on first database creation.

## 🔧 Configuration

### Environment Variables

Copy the example environment file and customize:

```bash
cp .env.example .env
```

Edit `.env` with your own values. See `.env.example` for all available options.

> ⚠️ **Never commit `.env` to version control** - it contains sensitive credentials.

## 📚 Technologies

| Category | Technology |
|----------|------------|
| Frontend | React, TypeScript, Vite, Tailwind CSS |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL |
| Blockchain | Hardhat, Ethers.js, Solidity |
| Container | Podman/Docker |
| Crypto | merkletreejs, @noble/hashes |

## 🐛 Troubleshooting

### Frontend not loading
```powershell
# Check if port 5173 is in use
Get-NetTCPConnection -LocalPort 5173

# Restart frontend
.\stop-dev.ps1
.\start-dev.ps1
```

### Database connection error
```powershell
# Check if PostgreSQL is running
podman ps

# Restart database
podman restart dpp-postgres
```

### Blockchain not responding
```powershell
# Check if Hardhat is running
Get-NetTCPConnection -LocalPort 8545

# View Hardhat logs (in Hardhat terminal window)
```

## 📄 License

MIT License - See LICENSE file for details.
