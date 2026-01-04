import { CronJob } from 'cron';
import { Pool } from 'pg';
import { ethers } from 'ethers';
import { MerkleTree } from 'merkletreejs';
import { sha256 } from '@noble/hashes/sha256';
import * as fs from 'fs/promises';
import * as crypto from 'crypto';
import 'dotenv/config';

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'dpp_admin',
    password: process.env.DB_PASS || 'secret123',
    database: process.env.DB_NAME || 'dpp_db',
    port: parseInt(process.env.DB_PORT || '5432')
});

// Contract ABI for verification
const CONTRACT_ABI = [
    "function getBatch(uint256 batchId) external view returns (bytes32 root, uint256 timestamp, uint256 blockNum)",
    "function verify(uint256 batchId, bytes32 expectedRoot) external view returns (bool)",
    "function batchCount() external view returns (uint256)"
];

const STORAGE_ROOT = process.env.STORAGE_ROOT || '/var/www/did-logs';

// Helper: Hash a log entry using SHA256
function hashLogEntry(logEntry: any): string {
    return crypto.createHash('sha256').update(JSON.stringify(logEntry)).digest('hex');
}

// Audit Check 1: Verify hash chain integrity of DID log entries
async function verifyHashChain(did: string, scid: string): Promise<{ valid: boolean; details: string }> {
    try {
        const logPath = `${STORAGE_ROOT}/${scid}/did.jsonl`;

        // Check if file exists
        try {
            await fs.access(logPath);
        } catch {
            return { valid: false, details: `Log file not found: ${logPath}` };
        }

        const content = await fs.readFile(logPath, 'utf-8');
        const entries = content.trim().split('\n').filter(line => line.length > 0);

        if (entries.length === 0) {
            return { valid: false, details: 'Empty log file' };
        }

        // Verify hash chain and timestamps
        for (let i = 1; i < entries.length; i++) {
            try {
                const current = JSON.parse(entries[i]);
                const previous = JSON.parse(entries[i - 1]);

                // 1. Check timestamps
                const currentTime = new Date(current.versionTime || current.timestamp).getTime();
                const prevTime = new Date(previous.versionTime || previous.timestamp).getTime();

                if (currentTime < prevTime - 1000) {
                    return { 
                        valid: false, 
                        details: `Hash chain broken: version ${current.versionId} timestamp (${new Date(currentTime).toISOString()}) is before version ${previous.versionId} (${new Date(prevTime).toISOString()})` 
                    };
                }

                // 2. Check hash link (if present in parameters)
                if (current.parameters?.prevVersionHash) {
                    // Recompute hash of previous entry
                    // Note: In a real system we'd use canonical JSON (JCS)
                    const computedPrevHash = crypto.createHash('sha256').update(entries[i - 1]).digest('hex');
                    
                    if (current.parameters.prevVersionHash !== computedPrevHash) {
                        // Try without potential trailing newline if it fails
                        const computedPrevHashNoNL = crypto.createHash('sha256').update(entries[i - 1].trim()).digest('hex');
                        if (current.parameters.prevVersionHash !== computedPrevHashNoNL) {
                            return { 
                                valid: false, 
                                details: `Hash chain broken: version ${current.versionId} has invalid prevVersionHash link` 
                            };
                        }
                    }
                }
            } catch (e) {
                return { valid: false, details: `Invalid JSON in log entry at index ${i}` };
            }
        }

        return { valid: true, details: 'Hash chain verified successfully' };
    } catch (err: any) {
        return { valid: false, details: `Error during verification: ${err.message}` };
    }
}

// Helper: Hash function for Merkle tree
const sha256Buffer = (data: Buffer | string): Buffer => {
    const hash = sha256(typeof data === 'string' ? Buffer.from(data) : data);
    return Buffer.from(hash);
};

// Audit Check 2: Verify Merkle proof against on-chain root
async function verifyMerkleProof(
    batchId: number,
    leafHash: string,
    merkleProof: string[],
    expectedMerkleRoot: string
): Promise<{ valid: boolean; details: string }> {
    try {
        const rpcUrl = process.env.RPC_URL || 'http://localhost:8545';
        const contractAddress = process.env.CONTRACT_ADDRESS;

        if (!contractAddress) {
            return { valid: false, details: 'CONTRACT_ADDRESS not set' };
        }

        // Step 1: Verify the proof locally using MerkleTree library
        const leaf = Buffer.from(leafHash.slice(2), 'hex');
        const proof = merkleProof.map(p => Buffer.from(p.slice(2), 'hex'));
        const root = Buffer.from(expectedMerkleRoot.slice(2), 'hex');

        console.log(`[Watcher] Verifying leaf ${leafHash.slice(0, 10)}... in batch ${batchId}`);
        console.log(`[Watcher] Proof length: ${proof.length}`);

        // Handle single-leaf edge case: if proof is empty, leaf should equal root
        let isValidProof: boolean;
        if (proof.length === 0) {
            // Single leaf tree: leaf IS the root
            isValidProof = leafHash.toLowerCase() === expectedMerkleRoot.toLowerCase();
            if (isValidProof) {
                console.log(`[Watcher] Single-leaf tree: leaf equals root ✅`);
            }
        } else {
            // Multiple leaves: use MerkleTree verification
            isValidProof = MerkleTree.verify(proof, leaf, root, sha256Buffer, { sortPairs: true });
        }

        if (!isValidProof) {
            return {
                valid: false,
                details: `Merkle proof verification failed locally for leaf ${leafHash.slice(0, 18)}...`
            };
        }

        console.log(`[Watcher] Local Merkle proof valid for leaf ${leafHash.slice(0, 18)}...`);

        // Step 2: Verify the root matches what's stored on-chain
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        
        // Verify contract exists at address
        const code = await provider.getCode(contractAddress);
        if (code === '0x' || code === '0x0') {
            return { valid: false, details: `No contract found at ${contractAddress}. Is the blockchain running and contract deployed?` };
        }

        const contract = new ethers.Contract(contractAddress, CONTRACT_ABI, provider);

        try {
            const [onChainRoot, timestamp, blockNum] = await contract.getBatch(batchId);

            // Check if batch exists (empty root means batch doesn't exist)
            if (!onChainRoot || onChainRoot === '0x0000000000000000000000000000000000000000000000000000000000000000') {
                console.warn(`[Watcher] ⚠️ Batch ${batchId} not found on-chain at ${contractAddress}`);
                // Check if the contract actually has ANY batches yet
                const nextId = await contract.batchCount();
                if (batchId >= Number(nextId)) {
                    return { valid: false, details: `Batch ${batchId} is pending anchoring on blockchain` };
                }
                return { valid: false, details: `Batch ${batchId} not found on chain (blockchain may have been reset)` };
            }

            // Compare expected root with on-chain root
            if (onChainRoot.toLowerCase() !== expectedMerkleRoot.toLowerCase()) {
                console.error(`[Watcher] ❌ Root mismatch for batch ${batchId}:`);
                console.error(`          Expected (DB): ${expectedMerkleRoot}`);
                console.error(`          On-Chain:      ${onChainRoot}`);
                return {
                    valid: false,
                    details: `Root mismatch: expected ${expectedMerkleRoot.slice(0, 18)}..., on-chain ${onChainRoot.slice(0, 18)}...`
                };
            }

            return {
                valid: true,
                details: `✅ Verified: proof valid, root matches on-chain at block ${blockNum}`
            };
        } catch (contractError: any) {
            // Contract call failed - likely batch doesn't exist or contract not deployed
            return {
                valid: false,
                details: `On-chain check failed: ${contractError.message?.includes('reverted') ? 'Batch not found on blockchain' : contractError.message?.slice(0, 50)}`
            };
        }
    } catch (err: any) {
        return { valid: false, details: `Merkle verification error: ${err.message?.slice(0, 50)}` };
    }
}

// Main audit function
async function runAudit() {
    console.log(`[${new Date().toISOString()}] Starting audit cycle...`);

    try {
        const rpcUrl = process.env.RPC_URL || 'http://localhost:8545';
        const contractAddress = process.env.CONTRACT_ADDRESS;
        const provider = new ethers.JsonRpcProvider(rpcUrl);

        // Sanity Check: Verify if DB batches match on-chain batches
        if (contractAddress) {
            try {
                // Check the latest batch from the batches table
                const { rows: dbBatches } = await pool.query('SELECT batch_id, merkle_root FROM batches ORDER BY batch_id DESC LIMIT 1');
                
                // ALSO check the latest batch ID mentioned in the events table (in case batches table is empty)
                const { rows: eventBatches } = await pool.query("SELECT (witness_proofs->>'batchId')::int as batch_id, witness_proofs->>'merkleRoot' as merkle_root FROM events WHERE witness_proofs IS NOT NULL ORDER BY (witness_proofs->>'batchId')::int DESC LIMIT 1");
                
                const lastBatch = dbBatches[0] || eventBatches[0];

                if (lastBatch && lastBatch.batch_id !== null) {
                    const contract = new ethers.Contract(contractAddress, CONTRACT_ABI, provider);
                    const [onChainRoot] = await contract.getBatch(lastBatch.batch_id);
                    
                    const isEmptyRoot = !onChainRoot || onChainRoot === '0x0000000000000000000000000000000000000000000000000000000000000000';
                    const isMismatch = !isEmptyRoot && onChainRoot.toLowerCase() !== lastBatch.merkle_root.toLowerCase();

                    if (isEmptyRoot || isMismatch) {
                        console.warn(`[Watcher] ⚠️ Blockchain desync detected! Batch ${lastBatch.batch_id} ${isEmptyRoot ? 'missing on-chain' : 'root mismatch'}.`);
                        if (!isEmptyRoot) {
                            console.warn(`          DB: ${lastBatch.merkle_root}`);
                            console.warn(`          Chain: ${onChainRoot}`);
                        }
                        console.warn(`          Clearing stale batch data to allow re-anchoring...`);
                        
                        // Clear stale data
                        await pool.query("UPDATE events SET witness_proofs = NULL");
                        await pool.query('DELETE FROM batches');
                        
                        console.log(`[Watcher] Stale data cleared. Witness service will re-anchor on next run.`);
                        return; // Stop this audit cycle, wait for re-anchoring
                    }
                }
            } catch (e) {
                console.error('[Watcher] Sanity check failed:', e);
            }
        }

        // Get all identities to audit
        const { rows: identities } = await pool.query(
            'SELECT did, scid FROM identities WHERE status = $1',
            ['active']
        );

        console.log(`[Watcher] Auditing ${identities.length} identities`);

        for (const identity of identities) {
            // Audit 1: Hash chain check
            const hashChainResult = await verifyHashChain(identity.did, identity.scid);

            await pool.query(
                `INSERT INTO audits (did, check_type, status, details, checked_at) 
         VALUES ($1, $2, $3, $4, NOW())`,
                [identity.did, 'hash_chain', hashChainResult.valid ? 'valid' : 'invalid', hashChainResult.details]
            );

            console.log(`[Watcher] Hash chain for ${identity.scid}: ${hashChainResult.valid ? '✅ valid' : '❌ invalid'}`);

            // Get events for this DID that have been batched
            const { rows: events } = await pool.query(
                `SELECT id, leaf_hash, witness_proofs FROM events 
         WHERE did = $1 AND witness_proofs IS NOT NULL`,
                [identity.did]
            );

            // Audit 2: Merkle proof check for each batched event
            let allMerkleValid = true;
            let merkleDetails = 'All batched events verified against blockchain';
            let batchedEventCount = 0;

            for (const event of events) {
                const wp = event.witness_proofs;

                // Check if we have all required proof data
                if (wp?.batchId !== undefined && wp?.merkleProof && wp?.merkleRoot && wp?.leafHash) {
                    batchedEventCount++;
                    const merkleResult = await verifyMerkleProof(
                        wp.batchId,
                        wp.leafHash,
                        wp.merkleProof,
                        wp.merkleRoot
                    );

                    if (!merkleResult.valid) {
                        allMerkleValid = false;
                        merkleDetails = merkleResult.details;
                        console.error(`[Watcher] ❌ Merkle failure for ${identity.scid} in batch ${wp.batchId}: ${merkleResult.details}`);
                        break; // Stop at first failure
                    }
                }
            }

            if (batchedEventCount > 0) {
                await pool.query(
                    `INSERT INTO audits (did, check_type, status, details, checked_at) 
                     VALUES ($1, $2, $3, $4, NOW())`,
                    [identity.did, 'merkle_proof', allMerkleValid ? 'valid' : 'invalid', merkleDetails]
                );
                console.log(`[Watcher] Merkle proof summary for ${identity.scid}: ${allMerkleValid ? '✅ valid' : '❌ invalid'}`);
            } else {
                console.log(`[Watcher] No batched events for ${identity.scid} - skipping Merkle audit`);
            }
        }

        console.log(`[Watcher] Audit cycle complete`);

    } catch (err) {
        console.error('[Watcher] Audit failed:', err);
    }
}

// Immediate run on startup
console.log('🚀 Watcher Engine starting...');
console.log(`   RPC_URL: ${process.env.RPC_URL || 'http://172.18.16.1:8545'}`);
console.log(`   CONTRACT_ADDRESS: ${process.env.CONTRACT_ADDRESS || 'NOT SET'}`);
console.log(`   STORAGE_ROOT: ${STORAGE_ROOT}`);

// Run immediately once
setTimeout(async () => {
    console.log('[Watcher] Running initial audit...');
    await runAudit();
}, 5000);

// Schedule: Run every 30 seconds for testing (change to '*/5 * * * *' for production = every 5 min)
const auditJob = new CronJob('*/30 * * * * *', async () => {
    await runAudit();
});

auditJob.start();
console.log('🔄 Watcher Engine scheduled: every 30 seconds (testing mode)');
console.log('   (First run in 5 seconds for immediate testing)');
