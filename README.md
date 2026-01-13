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

## ⚙️ 3. Configuration (Sepolia Setup)

We use a single central configuration file for the entire team so we can work with the same wallet and contract.

1.  Go to the `deployment/` folder.
2.  Open or create the `.env` file.
3.  Ensure the following values are set (these are shared within the team):

```env
# Blockchain Connection
RPC_URL=https://sepolia.infura.io/v3/YOUR_API_KEY

# Team Wallets (Share these securely, NOT on GitHub!)
DEPLOYER_PRIVATE_KEY=b48f... # The 'owner' of the contract
RELAYER_PRIVATE_KEY=b48f...  # The key that pays for transaction fees

# The current contract on Sepolia
CONTRACT_ADDRESS=0x06563e729443CCBbc5Ff7bD2412d78de55B66a65
VITE_CONTRACT_ADDRESS=0x06563e729443CCBbc5Ff7bD2412d78de55B66a65
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

## 🛠️ Troubleshooting

### "Not an authorized witness" error
Getting this error in the Witness terminal?
1.  Are you using the correct `RELAYER_PRIVATE_KEY` from the shared `.env`?
2.  If you want to use your own wallet, the contract owner must add you via the `add-witness` script, or you must deploy a new contract yourself:
    ```powershell
    cd contracts
    npm run deploy:sepolia
    ```

### Database won't start
*   Ensure **Podman Desktop** is active.
*   Check port 5432: if another Postgres instance is already running on your PC, Podman cannot start.

---

## 🛑 Stopping
To cleanly shut down all services (including the database):
```powershell
.\stop-dev.ps1
```
