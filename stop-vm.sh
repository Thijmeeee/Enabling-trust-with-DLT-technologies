#!/bin/bash
# ============================================================
# DPP Trust System - Stop All Services
# ============================================================

echo ""
echo "============================================================"
echo "  DPP Trust System - Stopping Services"
echo "============================================================"
echo ""

# Colors
GREEN='\033[0;32m'
NC='\033[0m'

# Stop Node.js processes
echo "[1/2] Stopping Node.js services..."
pkill -f "hardhat node" 2>/dev/null && echo -e "${GREEN}[✓]${NC} Hardhat stopped" || echo "    No Hardhat process found"
pkill -f "tsx watch" 2>/dev/null && echo -e "${GREEN}[✓]${NC} Backend stopped" || echo "    No backend process found"
pkill -f "serve -s dist" 2>/dev/null && echo -e "${GREEN}[✓]${NC} Frontend stopped" || echo "    No frontend process found"

# Stop PostgreSQL container
echo ""
echo "[2/2] Stopping PostgreSQL..."
if podman ps --format "{{.Names}}" | grep -q "^dpp-postgres$"; then
    podman stop dpp-postgres
    echo -e "${GREEN}[✓]${NC} PostgreSQL stopped"
else
    echo "    PostgreSQL not running"
fi

echo ""
echo "============================================================"
echo -e "${GREEN}  All services stopped${NC}"
echo "============================================================"
echo ""
echo "  To restart: ./deploy-vm.sh"
echo ""

# Optional: Remove database container
if [ "$1" == "--remove-db" ]; then
    echo "Removing PostgreSQL container..."
    podman rm -f dpp-postgres 2>/dev/null
    echo -e "${GREEN}[✓]${NC} Database container removed"
fi
