# DPP Trust System - VM Deployment Guide

## Prerequisites

Op de Ubuntu 22.04 VM:

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Podman
sudo apt install -y podman

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install Git (if needed)
sudo apt install -y git

# Verify installations
podman --version
node --version
npm --version
```

## Deployment Steps

### 1. Clone/Upload Project

```bash
# Option A: Clone from Git
git clone <repository-url> dpp-trust-system
cd dpp-trust-system

# Option B: Upload project files via SCP/SFTP
# Upload to ~/dpp-trust-system
```

### 2. Make Scripts Executable

```bash
chmod +x deploy-vm.sh stop-vm.sh
```

### 3. Deploy

```bash
# First time (with contract deployment):
./deploy-vm.sh --deploy-contract

# Subsequent runs:
./deploy-vm.sh
```

### 4. Access the Application

Replace `<VM-IP>` with your VM's IP address:

| Service | URL |
|---------|-----|
| Frontend | http://<VM-IP>:8080 |
| Backend API | http://<VM-IP>:3000 |
| Blockchain RPC | http://<VM-IP>:8545 |

### 5. Stop Services

```bash
./stop-vm.sh

# To also remove database:
./stop-vm.sh --remove-db
```

## Ports Used

| Port | Service |
|------|---------|
| 8080 | Frontend (Web UI) |
| 3000 | Backend API |
| 8545 | Hardhat Blockchain |
| 5432 | PostgreSQL Database |

## Logs

```bash
# View logs
tail -f /tmp/hardhat.log   # Blockchain
tail -f /tmp/backend.log   # Backend API
tail -f /tmp/frontend.log  # Frontend

# Check if services are running
lsof -i :8080  # Frontend
lsof -i :3000  # Backend
lsof -i :8545  # Blockchain
podman ps      # Database
```

## Firewall Configuration

Als je firewall hebt ingeschakeld:

```bash
sudo ufw allow 8080/tcp  # Frontend
sudo ufw allow 3000/tcp  # Backend API
sudo ufw allow 8545/tcp  # Blockchain (optioneel)
```

## Troubleshooting

### Services starten niet
```bash
# Check logs
cat /tmp/backend.log
cat /tmp/hardhat.log

# Check if ports are in use
lsof -i :3000
lsof -i :8080
```

### Database connection errors
```bash
# Check if PostgreSQL is running
podman ps

# View PostgreSQL logs
podman logs dpp-postgres

# Restart PostgreSQL
podman restart dpp-postgres
```

### Frontend not accessible
```bash
# Check if build succeeded
ls -la dist/

# Rebuild
npm run build

# Check serve process
ps aux | grep serve
```
