# 🚀 DPP Trust System - Opstart Handleiding

## Overzicht

Dit document beschrijft hoe je de volledige DPP (Digital Product Passport) Trust System lokaal opstart voor development.

### Architectuur

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                              │
│                   (React + Vite)                             │
│                   http://localhost:5173                      │
└─────────────────────┬───────────────────────────────────────┘
                      │ /api proxy
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                   Backend Services                           │
│              Identity Service (Express.js)                   │
│                   http://localhost:3000                      │
└─────────────────────┬───────────────────────────────────────┘
                      │
          ┌───────────┴───────────┐
          ▼                       ▼
┌─────────────────┐    ┌─────────────────────────────────────┐
│   PostgreSQL    │    │         Blockchain                   │
│   (Podman)      │    │   Lokaal: Hardhat (localhost:8545)  │
│   Port 5432     │    │   Productie: Sepolia Testnet        │
└─────────────────┘    └─────────────────────────────────────┘
```

---

## 📋 Vereisten

Zorg dat je het volgende geïnstalleerd hebt:

- **Node.js** v18+ (`node --version`)
- **npm** v9+ (`npm --version`)
- **Podman** (`podman --version`) - voor database container
- **Git** (`git --version`)

---

## 🔧 Eerste Keer Setup

### 1. Repository clonen en dependencies installeren

```powershell
# Clone repo (als nog niet gedaan)
git clone <repository-url>
cd Enabling-trust-with-DLT-technologies

# Frontend dependencies
npm install

# Backend dependencies
cd backend
npm install
cd ..

# Smart contract dependencies
cd contracts
npm install
cd ..
```

### 2. Environment configuratie

Kopieer de example files:

```powershell
# Frontend (root folder)
copy .env.example .env.local

# Backend
copy backend\.env.example backend\.env

# Contracts (voor Sepolia deployment)
copy contracts\.env.example contracts\.env
```

**Vul de waarden in:**

`.env.local` (frontend):
```env
VITE_API_URL=
VITE_RPC_URL=https://rpc.sepolia.org
VITE_CONTRACT_ADDRESS=0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
```

`backend/.env`:
```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=dpp_admin
DB_PASS=secret123
DB_NAME=dpp_db
PORT=3000

# Logging Configuration
LOG_LEVEL=info          # debug | info | warn | error
LOG_FORMAT=pretty       # pretty (dev) | json (production)
SERVICE_NAME=dpp-trust-system
ENABLE_TRACING=true     # Enable request correlation IDs
```

---

## 🚀 Opstarten (Dagelijks Gebruik)

### Optie 1: Automatisch Script (Aanbevolen)

```powershell
.\start-dev.ps1
```

Dit start automatisch **4 services**:
1. ✅ PostgreSQL database (Podman container)
2. ✅ Hardhat blockchain node (lokale blockchain op port 8545)
3. ✅ Backend Identity Service (port 3000)
4. ✅ Frontend Development Server (port 5173)

**Script opties:**

| Flag | Beschrijving |
|------|--------------|
| `-SkipDatabase` | Sla PostgreSQL over |
| `-SkipBlockchain` | Sla Hardhat blockchain over |
| `-SkipBackend` | Sla Backend service over |
| `-SkipFrontend` | Sla Frontend over |
| `-DeployContract` | Deploy smart contract naar lokale blockchain |

**Voorbeelden:**
```powershell
# Start alles
.\start-dev.ps1

# Start alles + deploy contract
.\start-dev.ps1 -DeployContract

# Start alleen frontend en backend (geen blockchain)
.\start-dev.ps1 -SkipDatabase -SkipBlockchain

# Start alleen database
.\start-dev.ps1 -SkipBlockchain -SkipBackend -SkipFrontend
```

### Optie 2: Handmatig Opstarten

Open **4 aparte terminals** in VS Code:

#### Terminal 1: PostgreSQL Database
```powershell
# Eerste keer - maak container aan:
podman run -d --name dpp-postgres `
    -e POSTGRES_USER=dpp_admin `
    -e POSTGRES_PASSWORD=secret123 `
    -e POSTGRES_DB=dpp_db `
    -p 5432:5432 postgres:15-alpine

# Laad database schema (eenmalig):
Get-Content backend\db\schema.sql | podman exec -i dpp-postgres psql -U dpp_admin -d dpp_db

# Volgende keren - start bestaande container:
podman start dpp-postgres
```

#### Terminal 2: Hardhat Blockchain (Lokale blockchain)
```powershell
cd contracts
npx hardhat node --hostname 0.0.0.0
# Output: Started HTTP and WebSocket JSON-RPC server at http://0.0.0.0:8545/
# Chain ID: 31337
```

#### Terminal 3: Backend Service
```powershell
cd backend
npm run dev:identity
# Output: 🚀 Identity Service running on port 3000
```

#### Terminal 4: Frontend
```powershell
npm run dev
# Output: VITE ready at http://localhost:5173
```

---

## 🌐 Toegang tot de Applicatie

| Service | URL | Beschrijving |
|---------|-----|--------------|
| **Frontend** | http://localhost:5173 | React applicatie |
| **Backend API** | http://localhost:3000/health | Health check endpoint |
| **API Docs** | http://localhost:3000/api | REST API endpoints |
| **Blockchain Explorer** | https://sepolia.etherscan.io | Sepolia testnet |
| **Contract** | https://sepolia.etherscan.io/address/0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512 | Deployed smart contract |

---

## 🛑 Stoppen van Services

### Automatisch
```powershell
.\stop-dev.ps1
```

### Handmatig
```powershell
# Stop alle node processen
Get-Process node | Stop-Process -Force

# Stop PostgreSQL container (behoudt data)
podman stop dpp-postgres

# OF verwijder container volledig (verliest data)
podman rm -f dpp-postgres
```

---

## 🔍 Troubleshooting

### Backend start niet
```powershell
# Check of poort 3000 vrij is
netstat -ano | findstr :3000

# Check PostgreSQL status
podman ps -a --filter name=dpp-postgres
```

### Database connectie failed
```powershell
# Check of container draait
podman logs dpp-postgres

# Herstart container
podman restart dpp-postgres
```

### Frontend proxy werkt niet
```powershell
# Controleer of backend draait
Invoke-RestMethod http://localhost:3000/health

# Check vite.config.ts proxy settings
```

### Smart contract errors
```powershell
# Hercompileer contracts
cd contracts
npx hardhat compile

# Check network configuratie
npx hardhat console --network sepolia
```

---

## 📁 Project Structuur

```
Enabling-trust-with-DLT-technologies/
├── src/                    # Frontend React code
│   ├── components/         # UI componenten
│   ├── lib/
│   │   ├── api/           # Backend API clients
│   │   ├── data/          # Data stores (hybrid, local, enhanced)
│   │   └── utils/         # Utilities (merkle, verification)
├── backend/               # Backend services
│   ├── services/
│   │   ├── identity/      # DID management service
│   │   ├── witness/       # Attestation service
│   │   └── watcher/       # Audit service
│   └── db/
│       └── schema.sql     # PostgreSQL schema
├── contracts/             # Solidity smart contracts
│   ├── contracts/
│   │   └── WitnessAnchorRegistry.sol
│   └── scripts/
│       └── deploy.ts
├── deployment/            # Production deployment configs
├── .env.local            # Local environment (git ignored)
├── start-dev.ps1         # Auto-start script
└── stop-dev.ps1          # Auto-stop script
```

---

## 🔐 Beveiliging

⚠️ **Belangrijk:**
- Commit NOOIT `.env` bestanden met echte credentials
- Gebruik alleen test wallets voor Sepolia
- Private keys blijven altijd lokaal

De volgende bestanden staan in `.gitignore`:
- `.env`
- `.env.local`
- `backend/.env`
- `contracts/.env`

---

## 📞 Support

Bij problemen:
1. Check de troubleshooting sectie hierboven
2. Bekijk de console logs in de terminal
3. Check browser DevTools (F12) voor frontend errors
