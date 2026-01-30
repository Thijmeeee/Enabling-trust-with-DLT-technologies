# DPP Trust System - Setup & User Guide

Welcome to the **DPP (Digital Product Passport) Trust System**. This project provides a robust solution for anchoring product data to the blockchain, ensuring that product integrity and provenance are irrefutable.

This guide will help you set up and run the project from scratch on your local machine, connected to the **Ethereum Sepolia Testnet**.

---

## 🏗️ Architecture at a Glance

The system consists of four main components:
1.  **Frontend (React)**: A dashboard for different stakeholders (Manufacturer, Witness, Watcher).
2.  **Backend Services**: Manages identities (DIDs) and handles blockchain anchoring.
3.  **PostgreSQL**: A database for local event storage (runs in Podman).
4.  **Smart Contract**: A registry on Sepolia that guarantees data authenticity.

---

## 📋 1. Prerequisites

Ensure the following software is installed before you begin:

1.  **Node.js (v18+)**: For frontend, backend, and contract tools. [Download here](https://nodejs.org/).
2.  **Podman**: For the database container. [Download Podman Desktop](https://podman-desktop.io/).
3.  **Git**: To retrieve the code.
4.  **PowerShell**: Use a PowerShell terminal (e.g., in VS Code) for the scripts.

---

## 🚀 2. Step-by-Step Installation

### Step A: Clone the Repository
Open your terminal and run:
```powershell
git clone <repository-url>
cd Enabling-trust-with-DLT-technologies
```

### Step B: Install Dependencies
This project has three locations where packages need to be installed:
```powershell
# 1. Frontend & General
npm install

# 2. Backend Services
cd backend
npm install
cd ..

# 3. Smart Contracts
cd contracts
npm install
cd ..
```

---

## ⚙️ 3. Configuration (Critical Setup)

To interact with the Ethereum Sepolia network, you must configure your own credentials in the `deployment/.env` file. These are sensitive and should never be shared or committed to version control.

### Required Environment Variables
1.  **DEPLOYER_PRIVATE_KEY**: The private key of the account that will deploy and own the smart contracts. This account needs Sepolia ETH (available via faucets).
2.  **RELAYER_PRIVATE_KEY**: The private key of the account used to pay for transaction fees during anchoring. In this setup, it is often same as the deployer.
3.  **ETHERSCAN_API_KEY**: Required for verifying smart contracts on Etherscan. You can get a free key by creating an account at [etherscan.io](https://etherscan.io/).
4.  **RPC_URL & VITE_RPC_URL**: A connection URL to the Sepolia network (e.g., from Infura or Alchemy).

### How to set up:
1.  Navigate to the `deployment/` folder.
2.  Open the `.env` file.
3.  Replace the placeholders with your actual keys:
    ```env
    DEPLOYER_PRIVATE_KEY=your_private_key_here
    RELAYER_PRIVATE_KEY=your_private_key_here
    ETHERSCAN_API_KEY=your_api_key_here
    RPC_URL=https://sepolia.infura.io/v3/YOUR_PROJECT_ID
    VITE_RPC_URL=https://sepolia.infura.io/v3/YOUR_PROJECT_ID
    ```

---

## 🏁 4. Running the Project

Once you have configured the `.env` and Podman is running, you can start everything with a single command:

```powershell
.\start-dev.ps1 -SkipBlockchain
```

**What does this script do?**
*   Starts your **PostgreSQL database** (Podman).
*   Starts the **Backend API** (port 3000).
*   Starts the **Witness & Watcher services** (for blockchain anchoring).
*   Opens the **Frontend** at [http://localhost:5173](http://localhost:5173).

---

## 🏗️ Production & Strategic Documents

For a professional rollout beyond a local development environment, please refer to the `production/` folder:
- **[PRODUCTION_PLAN.md](production/PRODUCTION_PLAN.md)**: A comprehensive architecture and deployment strategy for moving to a live environment.
- **[PRODUCTION_CODE.md](production/PRODUCTION_CODE.md)**: Infrastructure-as-code snippets, including Caddy configurations and optimized Dockerfiles for microservices.

---

## 🐛 Known Issues (Backlog)

The following bugs are currently identified and should be addressed in future iterations:
*   **Watcher Alerts**: Creating new "Window" type products can sometimes trigger incorrect integrity alerts in the Watcher service.
*   **Duplicate Events**: The DID Operations History (provenance log) may occasionally show duplicate event entries due to synchronization race conditions between the local database and blockchain events.

---

## 🛤️ Path to Production (Roadmap)

To transition this system from a prototype to a production-ready solution, the following strategic steps are recommended:

1.  **Main-net Migration**: Transition from Sepolia Testnet to Ethereum Main-net or a cost-effective Layer 2 solution (e.g., Arbitrum, Polygon) for real-world security.
2.  **ESPR Compliance**: Align the Digital Product Passport (DPP) data structure with the **Ecodesign for Sustainable Products Regulation (ESPR)** standards.
3.  **Automated Data Integration**: Implement automated data pipelines to ingest product information directly from existing ERP, MES, or PLM systems, removing manual entry errors.
4.  **Full SSI Integration**: Move towards a true **Self-Sovereign Identity (SSI)** model. Integrate wallets like **MetaMask** so that users (Manufacturers, Witnesses) manage their own private keys directly, rather than storing them in environment files.
5.  **Mobile Ecosystem**: Develop a mobile application with QR code scanning capabilities, enabling consumers and regulators to verify product authenticity instantly in the field.
6.  **Decentralized Governance**: Shift the responsibility of the **Witness** and **Watcher** nodes to independent, authorized third-party organizations (e.g., NGOs, government bodies). This ensures that the system's integrity is not solely managed by the manufacturer.

---

## 🛑 Stopping
To cleanly shut down all services (including the database):
```powershell
.\stop-dev.ps1
```
