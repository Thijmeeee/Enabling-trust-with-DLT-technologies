import { CronJob } from 'cron';
import { Pool } from 'pg';
import { ethers } from 'ethers';
import { MerkleTree } from 'merkletreejs';
import { sha256 } from '@noble/hashes/sha256';
import 'dotenv/config';

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'dpp_admin',
    password: process.env.DB_PASS || 'secret123',
    database: process.env.DB_NAME || 'dpp_db',
    port: parseInt(process.env.DB_PORT || '5432')
});

// Contract ABI for the anchor function
const CONTRACT_ABI = [
    "function anchor(bytes32 merkleRoot) external returns (uint256 batchId)",
    "function getBatch(uint256 batchId) external view returns (bytes32 root, uint256 timestamp, uint256 blockNum)",
    "event Anchored(uint256 indexed batchId, bytes32 indexed root, uint256 timestamp, uint256 blockNumber)"
];

// Helper: Hash function for Merkle tree leaves
function hashLeaf(data: string): Buffer {
    const hash = sha256(Buffer.from(data, 'utf8'));
    return Buffer.from(hash);
}

// Main batch processing function
async function processBatch() {
    console.log(`[${new Date().toISOString()}] Starting batch processing...`);

    try {
        // A. Fetch unanchored events (events not in any batch)
        const { rows: events } = await pool.query(`
      SELECT e.id, e.did, e.event_type, e.leaf_hash, e.version_id 
      FROM events e
      LEFT JOIN batches b ON e.version_id = ANY(
        SELECT json_array_elements_text(b.merkle_root::json->'leaves')
      )
      WHERE b.batch_id IS NULL
      LIMIT 100
    `);

        if (events.length === 0) {
            console.log('[Witness] No unanchored events found. Skipping batch.');
            return;
        }

        console.log(`[Witness] Found ${events.length} unanchored events`);

        // B. Build Merkle Tree
        const leaves = events.map(e => hashLeaf(e.leaf_hash || e.version_id));
        const tree = new MerkleTree(leaves, sha256, { sortPairs: true });
        const root = tree.getHexRoot();

        console.log(`[Witness] Merkle root: ${root}`);

        // C. Anchor to Blockchain
        const rpcUrl = process.env.RPC_URL || "http://blockchain:8545";
        const provider = new ethers.JsonRpcProvider(rpcUrl);

        const privateKey = process.env.RELAYER_PRIVATE_KEY;
        if (!privateKey) {
            throw new Error('RELAYER_PRIVATE_KEY not set');
        }

        const wallet = new ethers.Wallet(privateKey, provider);

        const contractAddress = process.env.CONTRACT_ADDRESS;
        if (!contractAddress) {
            throw new Error('CONTRACT_ADDRESS not set');
        }

        const contract = new ethers.Contract(contractAddress, CONTRACT_ABI, wallet);

        console.log(`[Witness] Anchoring to contract ${contractAddress}...`);
        const tx = await contract.anchor(root);
        const receipt = await tx.wait();

        console.log(`[Witness] Transaction confirmed: ${receipt.hash}`);
        console.log(`[Witness] Block number: ${receipt.blockNumber}`);

        // D. Store Batch in Database
        const batchResult = await pool.query(
            `INSERT INTO batches (batch_id, merkle_root, tx_hash, block_number, status, timestamp) 
       VALUES ((SELECT COALESCE(MAX(batch_id), -1) + 1 FROM batches), $1, $2, $3, 'confirmed', NOW())
       RETURNING batch_id`,
            [root, receipt.hash, receipt.blockNumber]
        );

        const batchId = batchResult.rows[0].batch_id;
        console.log(`✅ Anchored batch ${batchId} with root ${root} in tx ${receipt.hash}`);

        // E. Update events with batch reference (via version_id tracking)
        for (const event of events) {
            await pool.query(
                `UPDATE events SET witness_proofs = jsonb_set(
          COALESCE(witness_proofs, '{}'::jsonb),
          '{batchId}',
          $1::jsonb
        ) WHERE id = $2`,
                [JSON.stringify(batchId), event.id]
            );
        }

        console.log(`[Witness] Updated ${events.length} events with batch ${batchId}`);

    } catch (err) {
        console.error('[Witness] Batch processing failed:', err);
    }
}

// Immediate run on startup (for testing)
console.log('🚀 Witness Engine starting...');
console.log(`   RPC_URL: ${process.env.RPC_URL || 'http://blockchain:8545'}`);
console.log(`   CONTRACT_ADDRESS: ${process.env.CONTRACT_ADDRESS || 'NOT SET'}`);

// Run immediately once, then on schedule
setTimeout(async () => {
    console.log('[Witness] Running initial batch check...');
    await processBatch();
}, 5000);

// Schedule: Run every 10 minutes
const batchJob = new CronJob('*/10 * * * *', async () => {
    await processBatch();
});

batchJob.start();
console.log('🔄 Witness Engine scheduled: every 10 minutes');
console.log('   (First run in 5 seconds for immediate testing)');
