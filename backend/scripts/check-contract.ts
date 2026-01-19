import { ethers } from 'ethers';
import 'dotenv/config';

const CONTRACT_ABI = [
    "function getBatch(uint256 batchId) external view returns (bytes32 root, uint256 timestamp, uint256 blockNum)",
    "function nextBatchId() external view returns (uint256)",
    "event Anchored(uint256 indexed batchId, bytes32 root, uint256 timestamp)"
];

async function main() {
    const rpcUrl = process.env.RPC_URL || 'http://localhost:8545';
    const contractAddress = process.env.CONTRACT_ADDRESS || '0x5FbDB2315678afecb367f032d93F642f64180aa3';
    
    console.log(`Checking contract at ${contractAddress} on ${rpcUrl}`);
    
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const contract = new ethers.Contract(contractAddress, CONTRACT_ABI, provider);
    
    try {
        const nextBatchId = await contract.nextBatchId();
        console.log(`Next Batch ID: ${nextBatchId}`);
        
        for (let i = 0; i < Number(nextBatchId); i++) {
            const [root, timestamp, blockNum] = await contract.getBatch(i);
            console.log(`Batch ${i}: Root=${root}, Block=${blockNum}`);
        }
        
        const filter = contract.filters.Anchored();
        const events = await contract.queryFilter(filter);
        console.log(`Total Anchored events: ${events.length}`);
        events.forEach((event: any) => {
            console.log(`Event: Batch ${event.args.batchId}, Root ${event.args.root}`);
        });

    } catch (err: any) {
        console.error(`Error: ${err.message}`);
    }
}

main();
