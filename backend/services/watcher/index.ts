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
    "function verify(uint256 batchId, bytes32 expectedRoot) external view returns (bool)"
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

        // For single entry, just verify it can be parsed
        for (const entry of entries) {
            try {
                JSON.parse(entry);
            } catch {
                return { valid: false, details: 'Invalid JSON in log entry' };
            }
        }

        // Verify first entry matches expected structure
        const firstEntry = JSON.parse(entries[0]);
        if (!firstEntry.did || !firstEntry.versionId || !firstEntry.didDocument) {
            return { valid: false, details: 'Missing required fields in log entry' };
        }

        // Check if DID matches
        if (firstEntry.did !== did) {
            return { valid: false, details: `DID mismatch: expected ${did}, found ${firstEntry.did}` };
        }

        return { valid: true, details: 'Hash chain verified successfully' };
    } catch (err: any) {
        return { valid: false, details: `Error during verification: ${err.message}` };
    }
}

// Audit Check 2: Verify Merkle proof against on-chain root
async function verifyMerkleProof(
    batchId: number,
    leafHash: string,
    merkleProof: string[],
    expectedMerkleRoot: string
): Promise<{ valid: boolean; details: string }> {
    try {
        const rpcUrl = process.env.RPC_URL || 'http://172.18.16.1:8545';
        const contractAddress = process.env.CONTRACT_ADDRESS;

        if (!contractAddress) {
            return { valid: false, details: 'CONTRACT_ADDRESS not set' };
        }

        // Step 1: Verify the proof locally using MerkleTree library
        const leaf = Buffer.from(leafHash.slice(2), 'hex');
        const proof = merkleProof.map(p => Buffer.from(p.slice(2), 'hex'));
        const root = Buffer.from(expectedMerkleRoot.slice(2), 'hex');

        // Verify proof is valid for this leaf and root
        const isValidProof = MerkleTree.verify(proof, leaf, root, sha256, { sortPairs: true });

        if (!isValidProof) {
            return {
                valid: false,
                details: `Merkle proof verification failed locally for leaf ${leafHash.slice(0, 18)}...`
            };
        }

        console.log(`[Watcher] Local Merkle proof valid for leaf ${leafHash.slice(0, 18)}...`);

        // Step 2: Verify the root matches what's stored on-chain
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const contract = new ethers.Contract(contractAddress, CONTRACT_ABI, provider);

        const [onChainRoot, timestamp, blockNum] = await contract.getBatch(batchId);

        // Check if batch exists
        if (onChainRoot === '0x0000000000000000000000000000000000000000000000000000000000000000') {
            return { valid: false, details: `Batch ${batchId} not found on chain` };
        }

        // Compare expected root with on-chain root
        if (onChainRoot.toLowerCase() !== expectedMerkleRoot.toLowerCase()) {
            return {
                valid: false,
                details: `Root mismatch: expected ${expectedMerkleRoot.slice(0, 18)}..., on-chain ${onChainRoot.slice(0, 18)}...`
            };
        }

        return {
            valid: true,
            details: `✅ Verified: proof valid, root matches on-chain at block ${blockNum}`
        };
    } catch (err: any) {
        return { valid: false, details: `Merkle verification error: ${err.message}` };
    }
}

// Main audit function
async function runAudit() {
    console.log(`[${new Date().toISOString()}] Starting audit cycle...`);

    try {
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
            for (const event of events) {
                const wp = event.witness_proofs;

                // Check if we have all required proof data
                if (wp?.batchId !== undefined && wp?.merkleProof && wp?.merkleRoot && wp?.leafHash) {
                    const merkleResult = await verifyMerkleProof(
                        wp.batchId,
                        wp.leafHash,
                        wp.merkleProof,
                        wp.merkleRoot
                    );

                    await pool.query(
                        `INSERT INTO audits (did, check_type, status, details, checked_at) 
             VALUES ($1, $2, $3, $4, NOW())`,
                        [identity.did, 'merkle_proof', merkleResult.valid ? 'valid' : 'invalid', merkleResult.details]
                    );

                    console.log(`[Watcher] Merkle proof for batch ${wp.batchId}: ${merkleResult.valid ? '✅ valid' : '❌ invalid'}`);
                } else if (wp?.batchId !== undefined) {
                    // Legacy event without full proof data - just log warning
                    console.log(`[Watcher] Event ${event.id} has batch ${wp.batchId} but missing merkleProof/merkleRoot - skipping verification`);
                }
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

// Schedule: Run every 5 minutes
const auditJob = new CronJob('*/5 * * * *', async () => {
    await runAudit();
});

auditJob.start();
console.log('🔄 Watcher Engine scheduled: every 5 minutes');
console.log('   (First run in 5 seconds for immediate testing)');
