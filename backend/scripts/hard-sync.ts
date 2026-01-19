import { Pool } from 'pg';
import * as fs from 'fs/promises';
import * as path from 'path';
import 'dotenv/config';

const STORAGE_ROOT = './did-logs';

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'dpp_admin',
    password: process.env.DB_PASS || 'secret123',
    database: process.env.DB_NAME || 'dpp_db',
    port: parseInt(process.env.DB_PORT || '5432')
});

async function hardSyncRealProofs() {
    console.log('🔗 Hard-syncing REAL database proofs to did-logs...');

    try {
        const { rows: identities } = await pool.query('SELECT did, scid FROM identities');

        for (const identity of identities) {
            const { did, scid } = identity;
            const logPath = path.join(STORAGE_ROOT, scid, 'did.jsonl');
            const witnessPath = path.join(STORAGE_ROOT, scid, 'did-witness.json');

            // 1. Fetch proofs from DB
            const { rows: events } = await pool.query(
                'SELECT version_id, witness_proofs FROM events WHERE did = $1 AND witness_proofs IS NOT NULL ORDER BY created_at ASC',
                [did]
            );

            if (events.length === 0) continue;

            const proofs = events.map(e => e.witness_proofs);
            
            // 2. Update did-witness.json
            await fs.mkdir(path.dirname(witnessPath), { recursive: true });
            await fs.writeFile(witnessPath, JSON.stringify(proofs, null, 2));
            console.log(`   ✅ Synced did-witness.json for ${scid}`);

            // 3. Update did.jsonl (to align the proof inside the log)
            try {
                await fs.access(logPath);
                const content = await fs.readFile(logPath, 'utf-8');
                const lines = content.trim().split('\n').filter(l => l.length > 0);
                const logEntries = lines.map(l => JSON.parse(l));

                let modified = false;
                for (const entry of logEntries) {
                    const dbProof = events.find(e => e.version_id === entry.versionId)?.witness_proofs;
                    if (dbProof) {
                        // Find and replace the MerkleProof2019 in the entry.proof array
                        if (!entry.proof) entry.proof = [];
                        
                        const witnessProofIdx = entry.proof.findIndex((p: any) => p.proofPurpose === 'witness');
                        const newWitnessProof = {
                            type: 'MerkleProof2019',
                            proofPurpose: 'witness',
                            merkleRoot: dbProof.merkleRoot,
                            path: dbProof.merkleProof,
                            anchor: {
                                type: 'EthereumSepolia',
                                contract: process.env.CONTRACT_ADDRESS || '0x06563e...Placeholder',
                                block: dbProof.blockNumber
                            }
                        };

                        if (witnessProofIdx !== -1) {
                            entry.proof[witnessProofIdx] = newWitnessProof;
                        } else {
                            entry.proof.push(newWitnessProof);
                        }
                        modified = true;
                    }
                }

                if (modified) {
                    const newContent = logEntries.map(e => JSON.stringify(e)).join('\n') + '\n';
                    await fs.writeFile(logPath, newContent);
                    console.log(`   ✅ Synced did.jsonl for ${scid}`);
                }
            } catch (err) {
                // No log file found, skip
            }
        }

        console.log('✨ Proof synchronization complete!');

    } catch (err: any) {
        console.error('Sync failed:', err.message);
    } finally {
        await pool.end();
    }
}

hardSyncRealProofs();
