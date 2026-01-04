const { ethers } = require('ethers');

async function main() {
    const provider = new ethers.JsonRpcProvider('http://localhost:8545');
    const address = '0x5FbDB2315678afecb367f032d93F642f64180aa3';
    const code = await provider.getCode(address);
    console.log(`Code at ${address}: ${code.length > 2 ? 'Present' : 'Empty'} (length: ${code.length})`);
    
    if (code.length > 2) {
        const contract = new ethers.Contract(address, [
            "function nextBatchId() external view returns (uint256)"
        ], provider);
        try {
            const nextId = await contract.nextBatchId();
            console.log(`Next Batch ID: ${nextId}`);
        } catch (e) {
            console.log(`Error calling nextBatchId: ${e.message}`);
        }
    }
}

main();
