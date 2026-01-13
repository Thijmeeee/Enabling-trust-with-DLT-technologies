import pkg from "hardhat";
import * as dotenv from "dotenv";
const { ethers } = pkg;

// This script adds a witness to an existing contract
// Usage: npx hardhat run scripts/add-witness.ts --network <network>

async function main() {
    dotenv.config();
    
    const contractAddress = process.env.CONTRACT_ADDRESS;
    const relayerKey = process.env.RELAYER_PRIVATE_KEY;

    if (!contractAddress) {
        throw new Error("CONTRACT_ADDRESS not found in .env");
    }
    if (!relayerKey) {
        throw new Error("RELAYER_PRIVATE_KEY not found in .env");
    }

    const relayerWallet = new ethers.Wallet(relayerKey);
    console.log(`Checking witness status for: ${relayerWallet.address}`);
    console.log(`Contract: ${contractAddress}`);

    const [owner] = await ethers.getSigners();
    console.log(`Using owner account: ${owner.address}`);

    const WitnessAnchorRegistry = await ethers.getContractAt("WitnessAnchorRegistry", contractAddress);
    
    const isWitness = await WitnessAnchorRegistry.isWitness(relayerWallet.address);
    if (isWitness) {
        console.log("✅ Address is already an authorized witness.");
        return;
    }

    console.log("Adding witness...");
    const tx = await WitnessAnchorRegistry.addWitness(relayerWallet.address);
    console.log(`Transaction sent: ${tx.hash}`);
    
    await tx.wait();
    console.log("✅ Witness successfully added!");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
