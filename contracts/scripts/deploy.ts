import pkg from "hardhat";
const { ethers } = pkg;

async function main() {
    const networkName = pkg.network.name;
    console.log(`Deploying WitnessAnchorRegistry to ${networkName}...`);

    const WitnessAnchorRegistry = await ethers.getContractFactory("WitnessAnchorRegistry");
    const contract = await WitnessAnchorRegistry.deploy();

    await contract.waitForDeployment();
    const address = await contract.getAddress();

    console.log(`✅ WitnessAnchorRegistry deployed to: ${address}`);
    console.log(`   View on Etherscan: https://sepolia.etherscan.io/address/${address}`);
    console.log("");
    console.log("Add this to your .env file:");
    console.log(`CONTRACT_ADDRESS=${address}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
