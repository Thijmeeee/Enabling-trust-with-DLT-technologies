#!/bin/bash

# Exit on error
set -e

echo "🚀 Starting Deployment Process..."

# 1. Check if Podman is installed
if ! command -v podman &> /dev/null; then
    echo "❌ Podman is not installed. Please install it first."
    exit 1
fi

# 2. Build Frontend
echo "📦 Building Frontend..."
npm install
npm run build

# 3. Prepare deployment folder for static content
echo "📂 Preparing deployment folder..."
mkdir -p deployment/dist-app
rm -rf deployment/dist-app/*
cp -r dist/* deployment/dist-app/

# 4. Create required directories for DID logs
mkdir -p deployment/did-logs
chmod -R 777 deployment/did-logs

# 5. Start Infrastructure (DB and optionally Blockchain)
echo "🐳 Stopping any existing services to prevent conflicts..."
podman-compose -f deployment/compose.yaml down || true
podman stop dpp-postgres || true

echo "🐳 Starting Infrastructure..."
# Use --skip-blockchain for Sepolia deployment
if [[ "${*,,}" == *"--skip-blockchain"* ]]; then
    podman-compose -f deployment/compose.yaml up -d postgres
else
    # Only try starting blockchain if it exists in compose.yaml
    if grep -q "blockchain:" deployment/compose.yaml; then
        podman-compose -f deployment/compose.yaml up -d postgres blockchain
    else
        podman-compose -f deployment/compose.yaml up -d postgres
    fi
fi
echo "Waiting for services to initialize..."
sleep 10

# 6. Handle Contract Deployment (if requested)
if [[ "$*" == *"--deploy-contract"* ]]; then
    echo "📜 Deploying Smart Contract to Local Blockchain..."
    cd contracts
    npm install
    # Deploy to localhost (which maps to the pod's blockchain service)
    npm run deploy:local
    cd ..
    echo "⚠️ Note: Make sure to update the CONTRACT_ADDRESS in deployment/.env if it changed!"
fi

# 7. Start all services
echo "🚀 Starting all microservices and Gateway..."
podman-compose -f deployment/compose.yaml up -d --build

echo "✅ Deployment Complete!"
echo "------------------------------------------------"
echo "Frontend: http://webvh.web3connect.nl"
echo "Backend API:      http://webvh.web3connect.nl/api"
echo "------------------------------------------------"
echo "Use './stop-vm.sh' to stop the services."
