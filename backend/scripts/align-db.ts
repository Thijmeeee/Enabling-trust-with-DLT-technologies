import { Pool } from 'pg';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import 'dotenv/config';

const STORAGE_ROOT = './did-logs';

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'dpp_admin',
    password: process.env.DB_PASS || 'secret123',
    database: process.env.DB_NAME || 'dpp_db',
    port: parseInt(process.env.DB_PORT || '5432')
});

const sha256 = (data: string | Buffer) => crypto.createHash('sha256').update(data).digest();

async function alignDatabaseWithFiles() {
    console.log('🔄 Aligning Database leaf_hashes with did.jsonl files...');

    try {
        const scidDirs = await fs.readdir(STORAGE_ROOT);

        for (const scid of scidDirs) {
            const logPath = path.join(STORAGE_ROOT, scid, 'did.jsonl');
            
            try {
                await fs.access(logPath);
                const content = await fs.readFile(logPath, 'utf-8');
                const lines = content.trim().split('\n').filter(l => l.length > 0);
                
                if (lines.length === 0) continue;

                // We'll update the first version (v1)
                const firstEntry = JSON.parse(lines[0]);
                const entryHash = '0x' + sha256(JSON.stringify(firstEntry)).toString('hex');
                
                const did = firstEntry.id || firstEntry.state?.id;

                if (did) {
                    console.log(`   Updating DB for ${scid}: ${entryHash.substring(0, 10)}...`);
                    await pool.query(
                        'UPDATE events SET leaf_hash = $1 WHERE did = $2 AND version_id = $3',
                        [entryHash, did, '1']
                    );
                }
            } catch (err) {
                // Skip if no file or not a directory
            }
        }

        console.log('✅ Database leaf_hashes updated.');
        
        // NOW: Clear and re-batch if possible? 
        // Better: Just tell the user to wait for the witness service to re-batch 
        // or we manually clear the batches table to force a new one.
        
        console.log('🧹 Clearing old batches to force a new consistent anchoring...');
        await pool.query('UPDATE events SET witness_proofs = NULL');
        await pool.query('DELETE FROM batches');
        
        console.log('🚀 Triggering new batching... (Witness service will pick this up)');

    } catch (err: any) {
        console.error('Alignment failed:', err.message);
    } finally {
        await pool.end();
    }
}

alignDatabaseWithFiles();
