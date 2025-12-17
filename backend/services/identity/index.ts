import express from 'express';
import { Pool } from 'pg';
import * as fs from 'fs/promises';
import * as crypto from 'crypto';
import 'dotenv/config';

const app = express();
app.use(express.json());

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'dpp_admin',
    password: process.env.DB_PASS || 'secret123',
    database: process.env.DB_NAME || 'dpp_db',
    port: parseInt(process.env.DB_PORT || '5432')
});

const DOMAIN = process.env.DOMAIN || 'webvh.web3connect.nl';
const STORAGE_ROOT = process.env.STORAGE_ROOT || './did-logs';

// Helper: Generate a simple SCID (Self-Certifying Identifier)
function generateScid(): string {
    return 'z' + crypto.randomBytes(16).toString('base64url');
}

// Helper: Generate Ed25519 keypair (simplified for demo)
function generateKeyPair() {
    const keypair = crypto.generateKeyPairSync('ed25519');
    const publicKeyBuffer = keypair.publicKey.export({ type: 'spki', format: 'der' });
    const publicKeyMultibase = 'z' + Buffer.from(publicKeyBuffer).toString('base64url');
    return {
        publicKey: keypair.publicKey,
        privateKey: keypair.privateKey,
        publicKeyMultibase
    };
}

// Helper: Create DID Log Entry
function createLogEntry(did: string, scid: string, publicKeyMultibase: string, metadata: any) {
    const timestamp = new Date().toISOString();
    const versionId = '1-' + crypto.randomBytes(6).toString('hex');

    const logEntry = {
        versionId,
        timestamp,
        did,
        didDocument: {
            '@context': ['https://www.w3.org/ns/did/v1'],
            id: did,
            verificationMethod: [{
                id: `${did}#key-1`,
                type: 'Ed25519VerificationKey2020',
                controller: did,
                publicKeyMultibase
            }],
            authentication: [`${did}#key-1`],
            service: metadata?.service || []
        },
        proof: {
            type: 'DataIntegrityProof',
            created: timestamp,
            verificationMethod: `${did}#key-1`,
            proofPurpose: 'assertionMethod'
        }
    };

    return logEntry;
}

// Endpoint: Create Product (DID)
app.post('/api/products/create', async (req, res) => {
    const { type, model, metadata } = req.body;

    try {
        // 1. Generate Keys & DID
        const scid = generateScid();
        const { publicKeyMultibase } = generateKeyPair();
        const did = `did:webvh:${scid}:${DOMAIN}`;

        // 2. Create Log Entry
        const logEntry = createLogEntry(did, scid, publicKeyMultibase, {
            ...metadata,
            productType: type,
            model
        });

        // 3. Persistence - Write to file system
        const didDir = `${STORAGE_ROOT}/${scid}`;
        await fs.mkdir(didDir, { recursive: true });
        await fs.writeFile(`${didDir}/did.jsonl`, JSON.stringify(logEntry) + '\n');

        // 4. DB - Store in identities table
        await pool.query(
            `INSERT INTO identities (did, scid, public_key, status) VALUES ($1, $2, $3, $4)`,
            [did, scid, publicKeyMultibase, 'active']
        );

        // 5. DB - Store event for witness batching
        const leafHash = crypto.createHash('sha256').update(JSON.stringify(logEntry)).digest('hex');
        await pool.query(
            `INSERT INTO events (did, event_type, payload, signature, leaf_hash, version_id, timestamp) 
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
                did,
                'create',
                JSON.stringify({ type, model, ...metadata }),
                'pending', // Will be signed by witness
                leafHash,
                logEntry.versionId,
                Date.now()
            ]
        );

        console.log(`✅ Created DID: ${did}`);
        return res.json({
            did,
            scid,
            status: 'created',
            versionId: logEntry.versionId
        });
    } catch (err: any) {
        console.error('Error creating product:', err);
        res.status(500).json({ error: err.message });
    }
});

// Endpoint: Get DID Document
app.get('/api/identity/:scid', async (req, res) => {
    const { scid } = req.params;

    try {
        const result = await pool.query(
            'SELECT * FROM identities WHERE scid = $1',
            [scid]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'DID not found' });
        }

        return res.json(result.rows[0]);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Endpoint: List all DIDs
app.get('/api/identities', async (req, res) => {
    try {
        const result = await pool.query('SELECT did, scid, status, created_at FROM identities ORDER BY created_at DESC');
        return res.json(result.rows);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'identity' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Identity Service running on port ${PORT}`);
});
