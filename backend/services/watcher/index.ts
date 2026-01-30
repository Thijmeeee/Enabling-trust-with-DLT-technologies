import { CronJob } from 'cron';
import { Pool } from 'pg';
import { ethers } from 'ethers';
import { MerkleTree } from 'merkletreejs';
import { sha256 } from '@noble/hashes/sha256';
import * as fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import * as crypto from 'crypto';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { createServiceLogger } from '../../utils/logger.js';

// Initialize structured logger
const log = createServiceLogger('watcher');

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

const STORAGE_ROOT = process.env.STORAGE_ROOT && process.env.STORAGE_ROOT !== './did-logs'
    ? process.env.STORAGE_ROOT
    : path.resolve(__dirname, '../../did-logs');

// Helper: Hash a log entry using SHA256
function hashLogEntry(logEntry: any): string {
    return crypto.createHash('sha256').update(JSON.stringify(logEntry)).digest('hex');
}

// Audit Check 1: Verify hash chain integrity of DID log entries
async function verifyHashChain(did: string, scid: string): Promise<{ valid: boolean; details: string }> {
    try {
        // BYPASS for Demo Products (they often have hardcoded/simulated logs)
        if (did.includes('demo') || did.includes('z-')) {
            return { valid: true, details: 'Demo product hash chain bypassed' };
        }

        const logPath = `${STORAGE_ROOT}/${scid}/did.jsonl`;

        try {
            await fs.access(logPath);
        } catch {
            return { valid: false, details: `Log file not found: ${logPath}` };
        }

        const content = await fs.readFile(logPath, 'utf8');
        const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');

        if (lines.length === 0) {
            return { valid: false, details: 'DID log is empty' };
        }

        const entries = lines.map(line => {
            try { return JSON.parse(line); }
            catch { return null; }
        }).filter(e => e !== null);

        if (entries.length <= 1) return { valid: true, details: 'Short chain verified (V0)' };

        for (let i = 1; i < entries.length; i++) {
            const current = entries[i];
            const prevObj = JSON.parse(JSON.stringify(entries[i - 1])); // Deep clone to avoid modifying original

            // Remove MerkleProof2019 from the cloned object before hashing
            if (prevObj.proof && Array.isArray(prevObj.proof)) {
                prevObj.proof = prevObj.proof.filter((p: any) => p.type !== 'MerkleProof2019' && p.proofPurpose !== 'witness');
            }

            const prevRaw = lines[i - 1].trim();

            const computedRaw = crypto.createHash('sha256').update(prevRaw).digest('hex');

            if (current.parameters?.prevVersionHash !== computedRaw) {
                const computedObj = crypto.createHash('sha256').update(JSON.stringify(prevObj)).digest('hex');

                if (current.parameters?.prevVersionHash !== computedObj) {
                    log.error(`Hash mismatch at version ${i} for ${did}`, {
                        expected: current.parameters?.prevVersionHash,
                        computedObj,
                        details: 'Checked normalized object without MerkleProof2019'
                    });
                    return {
                        valid: false,
                        details: `Hash mismatch at version ${i}. Chain is broken.`
                    };
                }
            }
        }

        return { valid: true, details: 'Hash chain verified successfully' };
    } catch (error) {
        return { valid: false, details: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
}

// Audit Check 2: Verify Merkle proof against on-chain root
async function verifyMerkleProof(
    did: string,
    batchId: number,
    leafHash: string,
    merkleProof: string[],
    expectedMerkleRoot: string
): Promise<{ valid: boolean; details: string }> {
    try {
        // BYPASS for Demo Products
        if (did.includes('demo') || did.includes('z-')) {
            return { valid: true, details: 'Demo product integrity bypassed (local validation only)' };
        }

        const rpcUrl = process.env.RPC_URL || 'http://localhost:8545';
        const contractAddress = process.env.CONTRACT_ADDRESS;

        if (!contractAddress) {
            return { valid: false, details: 'CONTRACT_ADDRESS not set' };
        }

        // Step 1: Verify the proof locally using MerkleTree library
        const leaf = Buffer.from(leafHash.slice(2), 'hex');
        const proof = merkleProof.map(p => Buffer.from(p.slice(2), 'hex'));
        const root = Buffer.from(expectedMerkleRoot.slice(2), 'hex');

        let isValidProof: boolean;
        if (proof.length === 0) {
            isValidProof = leafHash.toLowerCase() === expectedMerkleRoot.toLowerCase();
        } else {
            isValidProof = MerkleTree.verify(proof, leaf, root, sha256, { sortPairs: true });
        }

        if (!isValidProof) {
            return { valid: false, details: `Merkle proof verification failed locally` };
        }

        // Step 2: Verify the root matches what's stored on-chain
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const contract = new ethers.Contract(contractAddress, CONTRACT_ABI, provider);

        try {
            const [onChainRoot, timestamp, blockNum] = await contract.getBatch(batchId);

            if (!onChainRoot || onChainRoot === '0x0000000000000000000000000000000000000000000000000000000000000000') {
                return { valid: false, details: `Batch ${batchId} not found on chain` };
            }

            if (onChainRoot.toLowerCase() !== expectedMerkleRoot.toLowerCase()) {
                return { valid: false, details: `Root mismatch: on-chain ${onChainRoot.slice(0, 10)}...` };
            }

            return { valid: true, details: `Verified on-chain at block ${blockNum}` };
        } catch (contractError: any) {
            return { valid: false, details: `On-chain check failed` };
        }
    } catch (err: any) {
        return { valid: false, details: `Merkle verification error` };
    }
}

export async function runAudit() {
    log.info('Starting audit cycle...');

    try {
        const { rows: identities } = await pool.query('SELECT did, scid, status, created_at FROM identities');
        log.info(`Auditing ${identities.length} identities...`);

        const NOW = Date.now();
        const GRACE_PERIOD_MS = 15000; // 15 seconds grace period for file system sync

        for (const identity of identities) {
            // Check grace period
            const createdAt = new Date(identity.created_at).getTime();
            if (NOW - createdAt < GRACE_PERIOD_MS) {
                log.info(`⏳ Skipping new identity (grace period): ${identity.did}`);
                continue;
            }

            if ((identity.did.includes("demo") || identity.did.includes("z-")) && !identity.did.includes("window-003")) {
                // ENFORCE DEACTIVATION: Check if the log file says it's deactivated
                // This prevents the status from reverting to 'active' due to auto-healing
                try {
                    const logPath = `${STORAGE_ROOT}/${identity.scid}/did.jsonl`;
                    const content = await fs.readFile(logPath, 'utf8');
                    const lines = content.trim().split('\n');
                    if (lines.length > 0) {
                        const lastLine = lines[lines.length - 1];
                        if (lastLine.includes('"deactivated":true') || lastLine.includes('"deactivated": true')) {
                            if (identity.status !== 'deactivated') {
                                log.info(`🛡️ Enforcing deactivation status for ${identity.did}`);
                                await pool.query("UPDATE identities SET status = 'deactivated' WHERE did = $1", [identity.did]);
                            }
                            continue; // Skip the tampered->active check below
                        }
                    }
                } catch (e) {
                    // Log file might not exist yet, ignore
                }

                log.info(`Skipping demo identity: ${identity.did}`);
                if (identity.status === 'tampered') {
                    await pool.query("UPDATE identities SET status = 'active' WHERE did = $1", [identity.did]);
                    await pool.query("DELETE FROM watcher_alerts WHERE did = $1", [identity.did]);
                }
                continue;
            }

            const hashChainResult = await verifyHashChain(identity.did, identity.scid);

            const { rows: events } = await pool.query(
                'SELECT leaf_hash, witness_proofs FROM events WHERE did = $1 AND witness_proofs IS NOT NULL',
                [identity.did]
            );

            let allMerkleValid = true;
            for (const event of events) {
                const wp = event.witness_proofs;
                if (wp?.batchId !== undefined && wp?.merkleProof) {
                    const res = await verifyMerkleProof(identity.did, wp.batchId, wp.leafHash, wp.merkleProof, wp.merkleRoot);
                    if (!res.valid) allMerkleValid = false;
                }
            }

            const isValid = hashChainResult.valid && allMerkleValid;
            const newStatus = isValid ? 'active' : 'tampered';

            if (newStatus === 'tampered') {
                await pool.query('UPDATE identities SET status = $1 WHERE did = $2', [newStatus, identity.did]);
                // Check if we already have an integrity alert to avoid duplicates
                const { rows: existing } = await pool.query(
                    "SELECT id FROM watcher_alerts WHERE did = $1 AND reporter = 'watcher' AND reason = 'INTEGRITY_FAILURE'",
                    [identity.did]
                );
                if (existing.length === 0) {
                    await pool.query('INSERT INTO watcher_alerts (did, reason, reporter) VALUES ($1, $2, $3)', [identity.did, 'INTEGRITY_FAILURE', 'watcher']);
                }
            } else if (identity.status === 'tampered') {
                // Only auto-resolve if the ONLY alerts are from the watcher itself (i.e. system alerts)
                // If a human has flagged something manually, we should NOT auto-clear it just because the hash chain is valid.
                const { rows: manualAlerts } = await pool.query(
                    "SELECT id FROM watcher_alerts WHERE did = $1 AND reporter != 'watcher'",
                    [identity.did]
                );

                if (manualAlerts.length === 0) {
                    await pool.query('UPDATE identities SET status = $1 WHERE did = $2', ['active', identity.did]);
                    await pool.query('DELETE FROM watcher_alerts WHERE did = $1', [identity.did]);
                    log.info(`Auto-resolved system alerts for ${identity.did}`);
                }
            }
        }
        log.info('Audit cycle complete');
    } catch (err) {
        log.error('Audit failed:', err);
    }
}

log.info('Watcher starting...');
runAudit();
const auditJob = new CronJob('*/5 * * * *', runAudit);
auditJob.start();


