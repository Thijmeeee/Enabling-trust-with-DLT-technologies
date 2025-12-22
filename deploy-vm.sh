#!/bin/bash
# ============================================================
# DPP Trust System - Ubuntu VM Deployment Script
# ============================================================
# Prerequisites:
# - Ubuntu 22.04 LTS
# - Podman installed (sudo apt install podman)
# - Node.js 18+ installed (via NodeSource)
# - Git installed
# ============================================================

set -e

echo ""
echo "============================================================"
echo "  DPP Trust System - Ubuntu Deployment"
echo "============================================================"
echo ""

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Helper function to print status
print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

# ============================================================
# 1. Check Prerequisites
# ============================================================
echo "[1/6] Checking prerequisites..."

# Check Podman
if ! command -v podman &> /dev/null; then
    print_error "Podman not found. Installing..."
    sudo apt-get update
    sudo apt-get install -y podman
fi
print_status "Podman available"

# Check Node.js
if ! command -v node &> /dev/null; then
    print_error "Node.js not found. Installing Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi
NODE_VERSION=$(node -v)
print_status "Node.js $NODE_VERSION available"

# Check npm
if ! command -v npm &> /dev/null; then
    print_error "npm not found"
    exit 1
fi
print_status "npm available"

# ============================================================
# 2. Install Dependencies
# ============================================================
echo ""
echo "[2/6] Installing project dependencies..."

cd "$PROJECT_ROOT"
npm install
print_status "Root dependencies installed"

cd "$PROJECT_ROOT/backend"
npm install
print_status "Backend dependencies installed"

cd "$PROJECT_ROOT/contracts"
npm install
print_status "Contracts dependencies installed"

cd "$PROJECT_ROOT"

# ============================================================
# 3. PostgreSQL Database (Podman)
# ============================================================
echo ""
echo "[3/6] Setting up PostgreSQL database..."

# Check if container exists
if podman ps -a --format "{{.Names}}" | grep -q "^dpp-postgres$"; then
    if podman ps --format "{{.Names}}" | grep -q "^dpp-postgres$"; then
        print_status "PostgreSQL already running"
    else
        podman start dpp-postgres
        print_status "PostgreSQL started"
    fi
else
    podman run -d --name dpp-postgres \
        -e POSTGRES_USER=dpp_admin \
        -e POSTGRES_PASSWORD=secret123 \
        -e POSTGRES_DB=dpp_db \
        -p 5432:5432 \
        postgres:15-alpine
    
    echo "    Waiting for PostgreSQL to initialize..."
    sleep 5
    
    # Load schema
    if [ -f "$PROJECT_ROOT/backend/db/schema.sql" ]; then
        cat "$PROJECT_ROOT/backend/db/schema.sql" | podman exec -i dpp-postgres psql -U dpp_admin -d dpp_db
        print_status "Database schema loaded"
    fi
    
    # Load seed data
    if [ -f "$PROJECT_ROOT/backend/db/seed.sql" ]; then
        cat "$PROJECT_ROOT/backend/db/seed.sql" | podman exec -i dpp-postgres psql -U dpp_admin -d dpp_db
        print_status "Demo data loaded"
    fi
fi

# ============================================================
# 4. Hardhat Blockchain Node
# ============================================================
echo ""
echo "[4/6] Starting Hardhat blockchain node..."

# Check if already running
if lsof -Pi :8545 -sTCP:LISTEN -t >/dev/null 2>&1; then
    print_status "Hardhat already running on port 8545"
else
    cd "$PROJECT_ROOT/contracts"
    nohup npx hardhat node --hostname 0.0.0.0 > /tmp/hardhat.log 2>&1 &
    sleep 5
    
    if lsof -Pi :8545 -sTCP:LISTEN -t >/dev/null 2>&1; then
        print_status "Hardhat started on port 8545"
    else
        print_warning "Hardhat may still be starting, check /tmp/hardhat.log"
    fi
    cd "$PROJECT_ROOT"
fi

# ============================================================
# 5. Deploy Smart Contract (optional)
# ============================================================
if [ "$1" == "--deploy-contract" ]; then
    echo ""
    echo "[5/6] Deploying smart contract..."
    cd "$PROJECT_ROOT/contracts"
    npx hardhat run scripts/deploy.ts --network localhost
    cd "$PROJECT_ROOT"
    print_status "Smart contract deployed"
else
    echo ""
    echo "[5/6] Skipping contract deployment (use --deploy-contract to deploy)"
fi

# ============================================================
# 6. Start Services
# ============================================================
echo ""
echo "[6/6] Starting application services..."

# Backend
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    print_status "Backend already running on port 3000"
else
    cd "$PROJECT_ROOT/backend"
    nohup npm run dev:identity > /tmp/backend.log 2>&1 &
    sleep 3
    print_status "Backend started on port 3000"
    cd "$PROJECT_ROOT"
fi

# Frontend (production build)
if lsof -Pi :8080 -sTCP:LISTEN -t >/dev/null 2>&1; then
    print_status "Frontend already running on port 8080"
else
    cd "$PROJECT_ROOT"
    
    # Build frontend for production
    echo "    Building frontend for production..."
    npm run build
    
    # Serve with a simple HTTP server
    nohup npx serve -s dist -l 8080 > /tmp/frontend.log 2>&1 &
    sleep 2
    print_status "Frontend started on port 8080"
fi

# ============================================================
# Summary
# ============================================================
echo ""
echo "============================================================"
echo -e "${GREEN}  Deployment Complete!${NC}"
echo "============================================================"
echo ""
echo "  Services:"
echo "    Frontend:     http://<VM-IP>:8080"
echo "    Backend API:  http://<VM-IP>:3000"
echo "    Blockchain:   http://<VM-IP>:8545"
echo "    Database:     localhost:5432"
echo ""
echo "  Logs:"
echo "    Hardhat:  /tmp/hardhat.log"
echo "    Backend:  /tmp/backend.log"
echo "    Frontend: /tmp/frontend.log"
echo ""
echo "  Commands:"
echo "    Stop all:  ./stop-vm.sh"
echo "    View logs: tail -f /tmp/backend.log"
echo ""
