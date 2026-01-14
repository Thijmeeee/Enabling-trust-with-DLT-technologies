import { Pool } from 'pg';
import 'dotenv/config';
import { WitnessFileManager } from '../utils/witnessFileManager.js';
import { createServiceLogger } from '../utils/logger.js';
import { AnchoringProof } from '../../src/types/witness.js';

const log = createServiceLogger('sync-script');

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'dpp_admin',
    password: process.env.DB_PASS || 'secret123',
    database: process.env.DB_NAME || 'dpp_db',
    port: parseInt(process.env.DB_PORT || '5432')
});

async function syncAllWitnessFiles() {
    log.info('Starting full witness file synchronization...');
    
    try {
        // 1. Get all identities
        const { rows: identities } = await pool.query(
            'SELECT did, scid FROM identities WHERE status = $1',
            ['active']
        );

        log.info(`Found ${identities.length} active identities to process.`);

        let processedCount = 0;
        let proofCount = 0;

        for (const identity of identities) {
            const { did, scid } = identity;

            // 2. Fetch all events with proofs for this DID
            const { rows: events } = await pool.query(
                'SELECT witness_proofs FROM events WHERE did = $1 AND witness_proofs IS NOT NULL ORDER BY created_at ASC',
                [did]
            );

            if (events.length === 0) {
                // Still initialize the file even if no proofs (standard requirement)
                await WitnessFileManager.initialize(scid);
                log.debug(`Initialized empty witness file for ${scid}`);
                processedCount++;
                continue;
            }

            // 3. Extract and cast proofs
            const proofs: AnchoringProof[] = events.map(e => e.witness_proofs as AnchoringProof);

            // 4. Atomic write to filesystem
            await WitnessFileManager.addProofs(scid, proofs);
            
            log.info(`Synced ${proofs.length} proofs for identity ${scid}`);
            processedCount++;
            proofCount += proofs.length;
        }

        log.info('Synchronization complete!', {
            identitiesProcessed: processedCount,
            totalProofsSynced: proofCount
        });

    } catch (err) {
        log.error('Synchronization failed', { error: err });
    } finally {
        await pool.end();
    }
}

// Execute
syncAllWitnessFiles();
