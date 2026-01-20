import { CronJob } from 'cron';
import { Pool } from 'pg';
import { ethers } from 'ethers';
import { MerkleTree } from 'merkletreejs';
import { sha256 } from '@noble/hashes/sha256';
import 'dotenv/config';
import { createServiceLogger } from '../../utils/logger.js';
import { witnessFileManager, AnchoringProof } from '../../utils/witnessFileManager.js';

// Initialize structured logger
const log = createServiceLogger('witness');

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'dpp_admin',
    password: process.env.DB_PASS || 'secret123',
    database: process.env.DB_NAME || 'dpp_db',
    port: parseInt(process.env.DB_PORT || '5432')
});

// Add error handler to pool to prevent process crash
pool.on('error', (err) => {
    log.error('Unexpected error on idle database client', err);
});

// Contract ABI for the anchor function
const CONTRACT_ABI = [
    "function anchor(bytes32 merkleRoot) external returns (uint256 batchId)",
    "function getBatch(uint256 batchId) external view returns (bytes32 root, uint256 timestamp, uint256 blockNum)",
    "function batchCount() external view returns (uint256)",
    "event Anchored(uint256 indexed batchId, bytes32 indexed root, uint256 timestamp, uint256 blockNumber)"
];

// Helper: Hash function for Merkle tree nodes
const sha256Buffer = (data: Buffer | string): Buffer => {
    const hash = sha256(typeof data === 'string' ? Buffer.from(data) : data);
    return Buffer.from(hash);
};

// Helper: Convert a hex string (with or without 0x) to a Buffer
function hexToBuffer(hex: string): Buffer {
    const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
    return Buffer.from(cleanHex, 'hex');
}

// Global flag to prevent concurrent batch processing
let isProcessing = false;

// Main batch processing function
async function processBatch() {
    if (isProcessing) {
        log.debug('Batch processing already in progress, skipping');
        return;
    }

    log.debug('Starting batch processing check');
    isProcessing = true;

    try {
        // A. Fetch unanchored events (events with NULL witness_proofs)
        const { rows: events } = await pool.query(`
      SELECT e.id, e.did, e.event_type, e.leaf_hash, e.version_id 
      FROM events e
      WHERE e.witness_proofs IS NULL
      ORDER BY e.timestamp ASC
      LIMIT 100
    `);

        if (events.length === 0) {
            log.debug('No unanchored events found, skipping batch');
            return;
        }

        // B. Check threshold and timeout
        const threshold = parseInt(process.env.BATCH_THRESHOLD || '1');
        const maxWaitMs = parseInt(process.env.BATCH_MAX_WAIT_MS || '30000'); // Default 30 seconds

        // Find oldest unanchored event to check wait time
        const { rows: oldest } = await pool.query('SELECT MIN(timestamp) as oldest_ts FROM events WHERE witness_proofs IS NULL');
        
        // Handle PG BIGINT coming back as string
        const oldestTsStr = oldest[0]?.oldest_ts;
        const oldestTs = oldestTsStr ? Number(oldestTsStr) : Date.now();
        const waitTime = Date.now() - oldestTs;

        if (events.length < threshold && waitTime < maxWaitMs) {
            log.info('Threshold not met and timeout not reached, skipping batch', {
                currentCount: events.length,
                threshold,
                waitTimeSec: Math.floor(waitTime / 1000),
                maxWaitSec: Math.floor(maxWaitMs / 1000),
                remainingSec: Math.max(0, Math.floor((maxWaitMs - waitTime) / 1000))
            });
            return;
        }

        log.info('Batch triggered!', {
            eventCount: events.length,
            reason: events.length >= threshold ? 'threshold' : 'timeout',
            waitTimeSec: Math.floor(waitTime / 1000)
        });

        // B. Build Merkle Tree
        // Use the leaf_hash directly as the leaf (it's already a SHA256 hash)
        const leaves = events.map(e => {
            if (e.leaf_hash) {
                return hexToBuffer(e.leaf_hash);
            }
            // Fallback for old events without leaf_hash
            const hash = sha256(Buffer.from(e.version_id, 'utf8'));
            return Buffer.from(hash);
        });

        const tree = new MerkleTree(leaves, sha256Buffer, { sortPairs: true });
        const root = tree.getHexRoot();

        log.info('Merkle tree built', { merkleRoot: root, leafCount: leaves.length });

        // C. Anchor to Blockchain
        const rpcUrl = process.env.RPC_URL || "http://blockchain:8545";
        const provider = new ethers.JsonRpcProvider(rpcUrl);

        let privateKey = process.env.RELAYER_PRIVATE_KEY;
        if (!privateKey) {
            throw new Error('RELAYER_PRIVATE_KEY not set');
        }

        // Ensure 0x prefix for ethers
        if (!privateKey.startsWith('0x')) {
            privateKey = '0x' + privateKey;
        }

        const wallet = new ethers.Wallet(privateKey, provider);

        log.info('Relayer status', {
            address: wallet.address,
            eventsFound: events.length,
            rpc: rpcUrl.split('@')[rpcUrl.split('@').length - 1] // Hide credentials if any
        });

        // Check balance
        const balance = await provider.getBalance(wallet.address);
        log.info('Balance check', {
            balance: ethers.formatEther(balance) + ' ETH',
            network: (await provider.getNetwork()).name
        });

        if (balance === 0n && !rpcUrl.includes('localhost') && !rpcUrl.includes('127.0.0.1')) {
            log.error('CRITICAL: Relayer has 0 ETH on Sepolia. Transactions will fail.', { address: wallet.address });
            return;
        }

        const contractAddress = process.env.CONTRACT_ADDRESS;
        if (!contractAddress) {
            throw new Error('CONTRACT_ADDRESS not set');
        }

        const contract = new ethers.Contract(contractAddress, CONTRACT_ABI, wallet);

        log.info('Anchoring to blockchain', { contractAddress, merkleRoot: root });

        // Check if this root was already anchored in the last 1000 blocks
        // (Handles process restarts or double-broadcasts)
        const filter = contract.filters.Anchored(null, root);
        const existingEvents = await contract.queryFilter(filter, -1000);

        let receipt;
        let contractBatchId: number;

        if (existingEvents.length > 0) {
            const event = existingEvents[0] as any;
            contractBatchId = Number(event.args.batchId);
            const txHash = event.transactionHash;
            log.info('Merkle root already anchored, recovery mode', {
                batchId: contractBatchId,
                txHash
            });
            receipt = await provider.getTransactionReceipt(txHash);

            if (!receipt) {
                throw new Error(`Could not fetch receipt for existing transaction ${txHash}`);
            }
        } else {
            // Normal path: send new transaction
            try {
                const tx = await contract.anchor(root);
                log.info('Transaction sent', { txHash: tx.hash });
                receipt = await tx.wait();
            } catch (txErr: any) {
                // If it's already known, it means it's in the mempool.
                // We'll let the next run pick it up via queryFilter above.
                if (txErr.message?.includes('already known')) {
                    log.warn('Transaction already in mempool, skipping to wait for confirmation', { root });
                    isProcessing = false;
                    return;
                }
                throw txErr;
            }

            // D. Parse the Anchored event to get the REAL batch ID from the contract
            const iface = new ethers.Interface(CONTRACT_ABI);
            const anchoredLog = receipt.logs.find((log: any) => {
                try {
                    const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data });
                    return parsed?.name === 'Anchored';
                } catch {
                    return false;
                }
            });

            if (anchoredLog) {
                const parsedEvent = iface.parseLog({ topics: anchoredLog.topics as string[], data: anchoredLog.data });
                contractBatchId = Number(parsedEvent?.args?.batchId ?? 0);
                log.info('Parsed Anchored event', { batchId: contractBatchId });
            } else {
                log.warn('Could not parse Anchored event from receipt');
                // Fallback to query contract for latest batch count (less reliable)
                contractBatchId = Number(await contract.batchCount()) - 1;
            }
        }

        // Wait, if contractBatchId is undefined here, something is wrong
        if (contractBatchId === undefined || contractBatchId === null) {
            throw new Error('Failed to determine batchId');
        }

        // If we are anchoring batch 0 but the DB already has batches, the blockchain was reset.
        // We must clear all old batch references from events to avoid invalid proofs.
        if (contractBatchId === 0) {
            const existingBatches = await pool.query('SELECT COUNT(*) FROM batches');
            if (parseInt(existingBatches.rows[0].count) > 0) {
                log.warn('Blockchain reset detected', {
                    reason: 'Batch 0 anchored but DB has existing batches',
                    action: 'Clearing old batch references'
                });
                await pool.query("UPDATE events SET witness_proofs = NULL");
                await pool.query('DELETE FROM batches');
            }
        }

        // E. Store Batch in Database using the CONTRACT's batch ID
        // Use ON CONFLICT to handle potential race conditions
        await pool.query(
            `INSERT INTO batches (batch_id, merkle_root, tx_hash, block_number, status, timestamp) 
             VALUES ($1, $2, $3, $4, 'confirmed', NOW())
             ON CONFLICT (batch_id) DO UPDATE SET 
               merkle_root = EXCLUDED.merkle_root,
               tx_hash = EXCLUDED.tx_hash,
               block_number = EXCLUDED.block_number,
               status = EXCLUDED.status`,
            [contractBatchId, root, receipt.hash, receipt.blockNumber]
        );

        const batchId = contractBatchId;
        log.info('Batch anchored successfully', {
            batchId,
            merkleRoot: root,
            txHash: receipt.hash,
            blockNumber: receipt.blockNumber
        });

        // F. Update events with batch reference AND individual Merkle proofs
        const scidGroups = new Map<string, AnchoringProof[]>();

        for (let i = 0; i < events.length; i++) {
            const event = events[i];

            // Get the Merkle proof for this specific leaf
            const proof = tree.getProof(leaves[i]);
            // Reverse the proof hashes to be root-to-leaf (user preference: "first from above")
            const proofHashes = proof.map(p => '0x' + p.data.toString('hex')).reverse();
            const leafHash = '0x' + leaves[i].toString('hex');

            // Store complete witness proof data
            const witnessProofData: AnchoringProof = {
                versionId: event.version_id,
                batchId: batchId,
                merkleRoot: root,
                leafHash: leafHash,
                merkleProof: proofHashes,
                leafIndex: i,
                txHash: receipt.hash,
                blockNumber: receipt.blockNumber,
                timestamp: new Date().toISOString()
            };

            await pool.query(
                `UPDATE events SET witness_proofs = $1::jsonb WHERE id = $2`,
                [JSON.stringify(witnessProofData), event.id]
            );

            // Group for file writing
            const scid = event.did.split(':').pop() || '';
            if (scid) {
                if (!scidGroups.has(scid)) scidGroups.set(scid, []);
                scidGroups.get(scid)!.push(witnessProofData);
            }

            log.debug('Stored proof for event', { eventId: event.id, leafIndex: i, totalLeaves: events.length });
        }

        // G. Sync proofs to did-witness.json files
        log.info('Syncing proofs to did-witness.json files...', { scidCount: scidGroups.size });
        for (const [scid, proofs] of scidGroups.entries()) {
            try {
                await witnessFileManager.addProofs(scid, proofs);
            } catch (err) {
                log.error('Failed to write witness file during batch', { scid, error: err });
                // Continue to next SCID, don't fail the whole batch
            }
        }

        log.info('Batch processing completed', {
            batchId,
            eventCount: events.length,
            merkleRoot: root
        });

    } catch (err) {
        log.error('Batch processing failed', { phase: 'processBatch', error: err });
    } finally {
        isProcessing = false;
    }
}

// Immediate run on startup
log.info('Witness Engine starting', {
    rpcUrl: process.env.RPC_URL || 'http://blockchain:8545',
    contractAddress: process.env.CONTRACT_ADDRESS || 'NOT SET',
    schedule: 'every 10 seconds (testing mode)'
});

// Run immediately once, then on schedule
setTimeout(async () => {
    try {
        log.info('Running initial batch check');
        await processBatch();
    } catch (err) {
        log.error('Initial batch check failed', err);
    }
}, 5000);

// Schedule: Run every 10 seconds for testing (change to '*/10 * * * *' for production = every 10 min)
const batchJob = new CronJob('*/10 * * * * *', async () => {
    await processBatch();
});

batchJob.start();
log.info('Witness Engine scheduled', { interval: '10 seconds', firstRunIn: '5 seconds' });
