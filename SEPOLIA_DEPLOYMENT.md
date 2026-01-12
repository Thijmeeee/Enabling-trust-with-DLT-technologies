# Sepolia Deployment & Real Development Guide

Follow these steps to transition from the local demo/prototype to a real development environment on the **Ethereum Sepolia Testnet**.

## 1. Prerequisites
- **Alchemy/Infura Account**: Get a Sepolia RPC URL.
- **Wallet with Sepolia ETH**: You'll need some test ETH for the deployer and relayer.
- **Etherscan API Key**: For contract verification.

## 2. Smart Contract Deployment
1. Navigate to the `contracts/` directory.
2. Create/update your `.env` file (see `.env.example` in that folder).
3. Run the deployment script:
   ```bash
   cd contracts
   npm install
   npx hardhat run scripts/deploy.ts --network sepolia
   ```
4. **Copy the `CONTRACT_ADDRESS`** from the output.

## 3. Backend Configuration
1. Navigate to the `backend/` directory.
2. Create/update your `.env` file (see `.env.example`).
3. Fill in:
   - `RPC_URL`: Your Sepolia RPC URL.
   - `RELAYER_PRIVATE_KEY`: A private key with Sepolia ETH (to pay for anchor txs).
   - `CONTRACT_ADDRESS`: The address from step 2.

## 4. Frontend Configuration
The frontend detects the environment via Vite env vars.
Create a `.env` in the root folder:
```
VITE_RPC_URL=your_sepolia_rpc_url
VITE_CONTRACT_ADDRESS=0xYourContractAddress
VITE_USE_LOCAL_CHAIN=false
```

## 5. Starting the Real Environment
Launch the services without the local Hardhat node:
```powershell
./start-dev.ps1 -SkipBlockchain
```

## 6. Verifying "Real" State
- **Witness Dashboard**: Anchored batches will now show real Sepolia transaction hashes.
- **Watcher Dashboard**: Audit logs will reflect state from the Sepolia chain.
- **Universal Resolver**: Can be used to verify product DIDs against the live anchoring contract.
