import pkg from "hardhat";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";

const { ethers } = pkg;

// Fix for __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
    // Load existing .env to check for relayer
    dotenv.config();
    const networkName = pkg.network.name;
    console.log(`\n🚀 Deploying WitnessAnchorRegistry to ${networkName}...`);

    const [deployer] = await ethers.getSigners();
    console.log(`   Deployer: ${deployer.address}`);

    const WitnessAnchorRegistry = await ethers.getContractFactory("WitnessAnchorRegistry");
    const contract = await WitnessAnchorRegistry.deploy();

    await contract.waitForDeployment();
    const address = await contract.getAddress();

    console.log(`✅ WitnessAnchorRegistry deployed to: ${address}`);
    
    // Optional: Authorize a separate relayer if specified in .env
    const relayerKey = process.env.RELAYER_PRIVATE_KEY;
    if (relayerKey) {
        try {
            const relayerWallet = new ethers.Wallet(relayerKey);
            if (relayerWallet.address.toLowerCase() !== deployer.address.toLowerCase()) {
                console.log(`   Authorizing relayer: ${relayerWallet.address}...`);
                const tx = await contract.addWitness(relayerWallet.address);
                await tx.wait();
                console.log(`   ✅ Relayer authorized`);
            }
        } catch (e) {
            console.warn(`   ⚠️ Could not authorize relayer from RELAYER_PRIVATE_KEY`);
        }
    }

    console.log(`\n🔗 View on Etherscan: https://sepolia.etherscan.io/address/${address}`);
    
    // --- Automatic ENV Update ---
    console.log(`\n📝 Updating environment files...`);
    const projectRoot = path.resolve(__dirname, "../../");
    const envFiles = [
        path.join(projectRoot, ".env"),
        path.join(projectRoot, ".env.local"),
        path.join(projectRoot, "backend", ".env"),
        path.join(projectRoot, "contracts", ".env"),
        path.join(projectRoot, "deployment", ".env")
    ];

    envFiles.forEach(file => {
        if (fs.existsSync(file)) {
            try {
                let content = fs.readFileSync(file, 'utf8');
                let updated = false;

                // Update CONTRACT_ADDRESS=...
                if (content.match(/^CONTRACT_ADDRESS=.*/m)) {
                    content = content.replace(/^CONTRACT_ADDRESS=.*/m, `CONTRACT_ADDRESS=${address}`);
                    updated = true;
                }
                
                // Update VITE_CONTRACT_ADDRESS=...
                if (content.match(/^VITE_CONTRACT_ADDRESS=.*/m)) {
                    content = content.replace(/^VITE_CONTRACT_ADDRESS=.*/m, `VITE_CONTRACT_ADDRESS=${address}`);
                    updated = true;
                }

                if (updated) {
                    fs.writeFileSync(file, content);
                    console.log(`   ✅ Updated ${path.relative(projectRoot, file)}`);
                } else {
                    // If not found at all, append it
                    fs.appendFileSync(file, `\nCONTRACT_ADDRESS=${address}\n`);
                    console.log(`   ✅ Added to ${path.relative(projectRoot, file)}`);
                }
            } catch (err) {
                console.error(`   ❌ Failed to update ${file}:`, err);
            }
        }
    });

    console.log("\n✨ Deployment and configuration complete!");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
