# DPP Trust System - VM Deployment Guide

## Prerequisites

Op de Ubuntu 22.04 VM:

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Podman
sudo apt install -y podman

# Install Podman Compose
pip3 install podman-compose

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
git clone <repository-url> dpp-trust-system
cd dpp-trust-system
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
# View logs van alle services
podman-compose -f deployment/compose.yaml logs -f

# Specifieke service logs
podman logs -f deployment_identity_1
podman logs -f deployment_witness_1
podman logs -f deployment_blockchain_1

# Check of containers draaien
podman ps
```

## Firewall Configuration

Als je firewall hebt ingeschakeld:

```bash
sudo ufw allow 8080/tcp  # Frontend (Gateway)
sudo ufw allow 3000/tcp  # Backend API
sudo ufw allow 8545/tcp  # Blockchain (optioneel)
```

## Troubleshooting

### Services starten niet
```bash
# Check container status
podman ps -a

# Bekijk waarom een container is gestopt
podman logs [container-id]

# Herbouw containers
./deploy-vm.sh
```

### Database of Logs resetten
Als je met een schone lei wilt beginnen:
```bash
./stop-vm.sh --remove-db
./deploy-vm.sh --deploy-contract
```

### Poorten bezet
Als een poort al in gebruik is op de host:
```bash
sudo lsof -i :8080
sudo lsof -i :3000
```
