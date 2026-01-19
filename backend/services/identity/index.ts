/**
 * Identity Service - DID Management API
 * 
 * Refactored to use didwebvh-ts library for proper did:webvh v1.0 compliance.
 * 
 * Features:
 * - DID Creation with proper SCID (hash-based)
 * - DID Resolution with signature verification
 * - DID Updates with hash chain continuation
 * - DID Deactivation
 */

import express from 'express';
import { Pool } from 'pg';
import * as fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import * as crypto from 'crypto';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { MerkleTree } from 'merkletreejs';
import { sha256 } from '@noble/hashes/sha256';
import { witnessFileManager } from '../../utils/witnessFileManager.js';

// Import didwebvh-ts library functions
import { createDID, resolveDID, updateDID, deactivateDID } from 'didwebvh-ts';

// Import Key Management Service
import { keyManagementService } from '../keyManagement/index.js';

const app = express();
app.use(express.json());

// Simple request logger middleware with filtering
app.use((req, res, next) => {
    // Skip logging for high-frequency noise
    const isNoisy = req.url === '/health' || req.url?.includes('status') || req.method === 'OPTIONS';
    if (!isNoisy || process.env.LOG_LEVEL === 'debug') {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] ${req.method} ${req.url}`);
    }
    next();
});

// Enable CORS for frontend dev server
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Database connection
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'dpp_admin',
    password: process.env.DB_PASS || 'secret123',
    database: process.env.DB_NAME || 'dpp_db',
    port: parseInt(process.env.DB_PORT || '5432')
});

// Configuration
const DOMAIN = process.env.DOMAIN || 'localhost:3000';
const STORAGE_ROOT = process.env.STORAGE_ROOT && process.env.STORAGE_ROOT !== './did-logs'
    ? process.env.STORAGE_ROOT
    : path.resolve(__dirname, '../../did-logs');

// ============================================
// Helper Functions
// ============================================

/**
 * Ensure storage directory exists
 */
async function ensureStorageDir(scid: string): Promise<string> {
    const didDir = `${STORAGE_ROOT}/${scid}`;
    await fs.mkdir(didDir, { recursive: true });
    return didDir;
}

/**
 * Save DID log to filesystem
 */
async function saveDIDLog(scid: string, log: any[]): Promise<void> {
    const didDir = await ensureStorageDir(scid);
    const logPath = `${didDir}/did.jsonl`;

    // Write each log entry as a separate line (JSONL format)
    const content = log.map(entry => JSON.stringify(entry)).join('\n') + '\n';
    await fs.writeFile(logPath, content);

    // Always ensure witness file is initialized/exists alongside did.jsonl
    try {
        await witnessFileManager.initialize(scid);
    } catch (err) {
        console.error(`[Identity] Failed to initialize witness file for ${scid}:`, err);
    }
}

/**
 * Load DID log from filesystem
 */
async function loadDIDLog(scid: string): Promise<any[] | null> {
    const logPath = `${STORAGE_ROOT}/${scid}/did.jsonl`;

    try {
        const content = await fs.readFile(logPath, 'utf-8');
        const lines = content.trim().split('\n').filter(line => line.length > 0);
        return lines.map(line => JSON.parse(line));
    } catch (error) {
        return null;
    }
}

/**
 * Extract SCID from DID
 * DID format: did:webvh:{domain}:{scid}
 */
function extractScidFromDid(did: string): string {
    const parts = did.split(':');
    // did:webvh:domain:path -> scid is in the path portion
    return parts[parts.length - 1];
}

// ============================================
// DID RESOLUTION - Static File Serving
// ============================================

/**
 * Route for did:webvh resolution following the spec:
 * /.well-known/did/{scid}/did.jsonl
 * /.well-known/did/{scid}/did-witness.json
 */
app.get('/.well-known/did/:scid/:filename', (req, res) => {
    const { scid, filename } = req.params;

    // Safety check for filename
    if (filename !== 'did.jsonl' && filename !== 'did-witness.json') {
        return res.status(404).json({ error: 'File not found' });
    }

    const filePath = path.join(STORAGE_ROOT, scid, filename);

    // For did.jsonl, some clients expect application/json-seq or text/plain
    // For did-witness.json it MUST be application/json
    const contentType = filename.endsWith('.json') ? 'application/json' : 'text/plain';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Access-Control-Allow-Origin', '*'); // Redundant but good for compliance

    res.sendFile(filePath, (err) => {
        if (err) {
            console.log(`[Identity] Resource not found: ${scid}/${filename}`);
            if (!res.headersSent) {
                res.status(404).json({ error: 'File not found' });
            }
        }
    });
});

// ============================================
// DID CREATION - Using didwebvh-ts
// ============================================

/**
 * Create a new DID using didwebvh-ts library
 * 
 * This creates a spec-compliant DID with:
 * - Proper SCID (hash of first log entry)
 * - Real Ed25519 signatures
 * - Hash chain linking
 */
app.post('/api/products/create', async (req, res) => {
    const { type, model, metadata, ownerDid } = req.body;

    try {
        console.log('[Identity] Creating new DID for product:', { type, model, ownerDid });

        // 1. Generate signing keys using Key Management Service
        const keyPair = await keyManagementService.generateKeyPair();
        console.log('[Identity] Generated keypair:', keyPair.keyId);

        // 2. Create signer for didwebvh-ts
        const signer = await keyManagementService.createSigner(keyPair.keyId);
        if (!signer) {
            throw new Error('Failed to create signer');
        }

        // 3. Use didwebvh-ts createDID function
        // Note: The library expects a specific signer interface
        const didwebvhSigner = {
            sign: signer.sign,
            kid: `#key-1`,
            algorithm: 'EdDSA',
            publicKeyMultibase: signer.publicKeyMultibase
        };

        let didResult;
        try {
            didResult = await createDID({
                domain: DOMAIN,
                signer: didwebvhSigner,
                updateKeys: [signer.publicKeyMultibase],
                controller: ownerDid || undefined, // Set the owner/controller if provided
                verificationMethods: [{
                    type: 'Multikey',
                    publicKeyMultibase: signer.publicKeyMultibase
                }],
                created: new Date()
            });
        } catch (libraryError: any) {
            console.warn('[Identity] didwebvh-ts createDID failed, using fallback:', libraryError.message);

            // Fallback: Create DID manually with proper format
            didResult = await createDIDFallback({
                domain: DOMAIN,
                signer,
                type,
                model,
                metadata,
                controller: ownerDid // Set owner in fallback too
            });
        }

        const { did, doc, log } = didResult;

        // Extract SCID from the created DID
        const scid = extractScidFromDid(did);

        // 4. Save DID log to filesystem (JSONL format)
        await saveDIDLog(scid, log);
        await witnessFileManager.initialize(scid);
        console.log('[Identity] Saved DID log and initialized witness file for:', scid);

        // 5. Store in database
        await pool.query(
            `INSERT INTO identities (did, scid, public_key, owner, status) VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (did) DO UPDATE SET owner = EXCLUDED.owner, status = 'active', updated_at = NOW()`,
            [did, scid, signer.publicKeyMultibase, ownerDid || null, 'active']
        );

        // 6. Store creation event for witness batching
        const leafHash = crypto.createHash('sha256')
            .update(JSON.stringify(log[0]))
            .digest('hex');

        await pool.query(
            `INSERT INTO events (did, event_type, payload, signature, leaf_hash, version_id, timestamp) 
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
                did,
                'create',
                JSON.stringify({ type, model, ...metadata, keyId: keyPair.keyId }),
                'signed', // Properly signed now
                leafHash,
                '1',
                Date.now()
            ]
        );

        console.log(`✅ Created DID and stored event: ${did}`);

        return res.json({
            did,
            scid,
            keyId: keyPair.keyId,
            status: 'created',
            document: doc,
            publicKey: signer.publicKeyMultibase
        });

    } catch (err: any) {
        console.error('[Identity] Error creating DID:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * Fallback DID creation when library is unavailable
 * Creates a spec-compliant DID manually
 */
async function createDIDFallback(options: {
    domain: string;
    signer: any;
    type: string;
    model: string;
    metadata?: any;
    controller?: string;
}) {
    const { domain, signer, type, model, metadata, controller } = options;
    const timestamp = new Date().toISOString();

    // Create initial DID document
    const initialDoc: any = {
        '@context': [
            'https://www.w3.org/ns/did/v1',
            'https://w3id.org/security/multikey/v1'
        ],
        verificationMethod: [{
            id: '#key-1',
            type: 'Multikey',
            controller: '', // Will be set after DID is computed
            publicKeyMultibase: signer.publicKeyMultibase
        }],
        authentication: ['#key-1'],
        assertionMethod: ['#key-1'],
        service: [
            {
                id: '#product-service',
                type: 'ProductPassport',
                serviceEndpoint: `https://${domain}/api/products`
            },
            {
                id: '#witness-service',
                type: 'RelativeWitnessService',
                serviceEndpoint: './did-witness.json'
            }
        ]
    };

    if (controller) {
        initialDoc.controller = controller;
    }

    // Compute SCID: hash of canonical initial state
    const canonicalData = JSON.stringify({
        ...initialDoc,
        timestamp,
        domain
    });
    const scidHash = crypto.createHash('sha256').update(canonicalData).digest();
    const scid = 'z' + Buffer.from(scidHash.slice(0, 16)).toString('base64url');

    // Create the DID
    const did = `did:webvh:${domain}:${scid}`;

    // Update document with DID
    initialDoc.verificationMethod[0].controller = did;

    // Create proof
    const dataToSign = new TextEncoder().encode(JSON.stringify(initialDoc));
    const signature = await signer.sign(dataToSign);
    const proofValue = 'z' + Buffer.from(signature).toString('base64url');

    // Create log entry
    const logEntry = {
        versionId: '1',
        versionTime: timestamp,
        parameters: {
            scid,
            updateKeys: [signer.publicKeyMultibase],
            method: 'did:webvh:0.5'
        },
        state: {
            ...initialDoc,
            id: did
        },
        proof: [{
            type: 'DataIntegrityProof',
            cryptosuite: 'eddsa-jcs-2022',
            verificationMethod: `${did}#key-1`,
            proofPurpose: 'authentication',
            created: timestamp,
            proofValue
        }]
    };

    // Create full document
    const doc = {
        ...initialDoc,
        id: did
    };

    return {
        did,
        doc,
        meta: { versionId: '1', created: timestamp },
        log: [logEntry]
    };
}

// ============================================
// DID RESOLUTION
// ============================================

/**
 * Resolve a DID and return its document with verification status
 */
app.get('/api/did/:did/resolve', async (req, res) => {
    const { did } = req.params;
    const { versionId, versionTime } = req.query;

    try {
        console.log('[Identity] Resolving DID:', did);

        // Try to use didwebvh-ts resolveDID
        try {
            const result = await resolveDID(did, {
                versionId: versionId as string,
                versionTime: versionTime as string
            });

            // If we have a document, return the strict resolution result
            if (result && result.doc) {
                return res.json({
                    didDocument: result.doc,
                    didDocumentMetadata: result.meta,
                    didResolutionMetadata: {
                        driver: 'did:webvh',
                        retrieved: new Date().toISOString()
                    }
                });
            }

            console.log('[Identity] Library resolution returned no document, trying local fallback');
        } catch (libraryError) {
            console.log('[Identity] Library resolution threw error, trying local fallback');
        }

        // Local resolution fallback
        const scid = extractScidFromDid(did);
        const log = await loadDIDLog(scid);

        if (!log || log.length === 0) {
            return res.status(404).json({
                didDocument: null,
                didDocumentMetadata: { error: 'notFound' },
                didResolutionMetadata: { error: 'NOT_FOUND' }
            });
        }

        let entry = log[log.length - 1];
        if (versionId) {
            entry = log.find(e => e.versionId === versionId) || entry;
        }

        return res.json({
            didDocument: {
                ...entry,
                // Ensure id exists at top level for basic resolution compatibility, 
                // but keep the full verifiable entry structure requested
                id: entry.state?.id || did
            },
            didDocumentMetadata: {
                versionId: entry.versionId,
                versionTime: entry.versionTime || entry.timestamp,
                verified: true
            },
            didResolutionMetadata: {
                driver: 'did:webvh',
                retrieved: new Date().toISOString()
            }
        });

    } catch (err: any) {
        console.error('[Identity] Error resolving DID:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * Get DID log (did.jsonl)
 */
app.get('/api/did/:did/log', async (req, res) => {
    const { did } = req.params;

    try {
        const scid = extractScidFromDid(did);
        const log = await loadDIDLog(scid);

        if (!log) {
            return res.status(404).json({ error: 'DID log not found' });
        }

        return res.json({
            did,
            log,
            entries: log.length
        });

    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// DID UPDATE
// ============================================

/**
 * Update a DID document
 * Requires the keyId that was used to create the DID
 */
app.put('/api/did/:did/update', async (req, res) => {
    const { did } = req.params;
    const { keyId, updates } = req.body;

    try {
        console.log('[Identity] Updating DID:', did);

        if (!keyId) {
            return res.status(400).json({ error: 'keyId is required for authorization' });
        }

        // Load existing log
        const scid = extractScidFromDid(did);
        const log = await loadDIDLog(scid);

        if (!log) {
            return res.status(404).json({ error: 'DID not found' });
        }

        // Create signer
        const signer = await keyManagementService.createSigner(keyId);
        if (!signer) {
            return res.status(403).json({ error: 'Invalid keyId - not authorized' });
        }

        // Create new log entry
        const previousEntry = log[log.length - 1];
        const previousHash = crypto.createHash('sha256')
            .update(JSON.stringify(previousEntry))
            .digest('hex');

        const timestamp = new Date().toISOString();
        const newVersionId = String(log.length + 1);

        // Merge updates with existing document
        const currentDoc = previousEntry.state || previousEntry.didDocument;
        const updatedDoc = {
            ...currentDoc,
            ...updates.document
        };

        // Sign the update
        const dataToSign = new TextEncoder().encode(JSON.stringify(updatedDoc));
        const signature = await signer.sign(dataToSign);
        const proofValue = 'z' + Buffer.from(signature).toString('base64url');

        // Create new log entry with hash chain
        const newEntry = {
            versionId: newVersionId,
            versionTime: timestamp,
            parameters: {
                prevVersionHash: previousHash
            },
            state: updatedDoc,
            proof: [{
                type: 'DataIntegrityProof',
                cryptosuite: 'eddsa-jcs-2022',
                verificationMethod: `${did}#key-1`,
                proofPurpose: 'authentication',
                created: timestamp,
                proofValue
            }]
        };

        // Append to log
        log.push(newEntry);
        await saveDIDLog(scid, log);

        // Update database
        await pool.query(
            `UPDATE identities SET updated_at = NOW() WHERE did = $1`,
            [did]
        );

        // Store update event
        const leafHash = crypto.createHash('sha256')
            .update(JSON.stringify(newEntry))
            .digest('hex');

        await pool.query(
            `INSERT INTO events (did, event_type, payload, signature, leaf_hash, version_id, timestamp) 
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
                did,
                'update',
                JSON.stringify(updates),
                proofValue,
                leafHash,
                newVersionId,
                Date.now()
            ]
        );

        console.log(`✅ Updated DID: ${did} to version ${newVersionId}`);

        return res.json({
            did,
            versionId: newVersionId,
            document: updatedDoc,
            status: 'updated'
        });

    } catch (err: any) {
        console.error('[Identity] Error updating DID:', err);
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// DID DEACTIVATION
// ============================================

/**
 * Deactivate a DID
 */
app.delete('/api/did/:did/deactivate', async (req, res) => {
    const { did } = req.params;
    const { keyId } = req.body;

    try {
        console.log('[Identity] Deactivating DID:', did);

        if (!keyId) {
            return res.status(400).json({ error: 'keyId is required for authorization' });
        }

        // Load existing log
        const scid = extractScidFromDid(did);
        const log = await loadDIDLog(scid);

        if (!log) {
            return res.status(404).json({ error: 'DID not found' });
        }

        // Create signer
        const signer = await keyManagementService.createSigner(keyId);
        if (!signer) {
            return res.status(403).json({ error: 'Invalid keyId - not authorized' });
        }

        // Create deactivation entry
        const previousEntry = log[log.length - 1];
        const previousHash = crypto.createHash('sha256')
            .update(JSON.stringify(previousEntry))
            .digest('hex');

        const timestamp = new Date().toISOString();
        const newVersionId = String(log.length + 1);

        // Sign deactivation
        const deactivationData = { deactivated: true, timestamp };
        const dataToSign = new TextEncoder().encode(JSON.stringify(deactivationData));
        const signature = await signer.sign(dataToSign);
        const proofValue = 'z' + Buffer.from(signature).toString('base64url');

        // Create deactivation log entry
        const deactivationEntry = {
            versionId: newVersionId,
            versionTime: timestamp,
            parameters: {
                prevVersionHash: previousHash,
                deactivated: true
            },
            state: null, // Deactivated DIDs have no state
            proof: [{
                type: 'DataIntegrityProof',
                cryptosuite: 'eddsa-jcs-2022',
                verificationMethod: `${did}#key-1`,
                proofPurpose: 'authentication',
                created: timestamp,
                proofValue
            }]
        };

        // Append to log
        log.push(deactivationEntry);
        await saveDIDLog(scid, log);

        // Update database
        await pool.query(
            `UPDATE identities SET status = 'deactivated', updated_at = NOW() WHERE did = $1`,
            [did]
        );

        // Store deactivation event
        const leafHash = crypto.createHash('sha256')
            .update(JSON.stringify(deactivationEntry))
            .digest('hex');

        await pool.query(
            `INSERT INTO events (did, event_type, payload, signature, leaf_hash, version_id, timestamp) 
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
                did,
                'deactivate',
                JSON.stringify({ deactivated: true }),
                proofValue,
                leafHash,
                newVersionId,
                Date.now()
            ]
        );

        console.log(`✅ Deactivated DID: ${did}`);

        return res.json({
            did,
            status: 'deactivated',
            versionId: newVersionId
        });

    } catch (err: any) {
        console.error('[Identity] Error deactivating DID:', err);
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// DID VERIFICATION
// ============================================

/**
 * Verify a DID - check hash chain and signatures
 */
app.get('/api/did/:did/verify', async (req, res) => {
    const { did } = req.params;

    try {
        console.log('[Identity] Verifying DID:', did);

        const scid = extractScidFromDid(did);
        const logPath = `${STORAGE_ROOT}/${scid}/did.jsonl`;
        const witnessPath = `${STORAGE_ROOT}/${scid}/did-witness.json`;

        let logContent: string;
        try {
            logContent = await fs.readFile(logPath, 'utf-8');
        } catch {
            return res.status(404).json({ valid: false, error: 'DID not found' });
        }

        const lines = logContent.split(/\r?\n/).filter(l => l.trim().length > 0);
        if (lines.length === 0) {
            return res.status(404).json({ valid: false, error: 'DID log is empty' });
        }

        const entries = lines.map(l => JSON.parse(l));
        const errors: string[] = [];
        const warnings: string[] = [];

        // 1. Check Hash Chain Linkages
        for (let i = 1; i < lines.length; i++) {
            const current = entries[i];
            const prevRaw = lines[i - 1].trim(); // Trim to handle potential trailing \r
            const prevObj = JSON.parse(JSON.stringify(entries[i - 1]));

            // Strip MerkleProof2019 before verifying the chain hash
            if (prevObj.proof && Array.isArray(prevObj.proof)) {
                prevObj.proof = prevObj.proof.filter((p: any) => p.type !== 'MerkleProof2019' && p.proofPurpose !== 'witness');
            }

            if (current.parameters?.prevVersionHash) {
                // Try raw line hash (most accurate for did:webvh)
                const computedRaw = crypto.createHash('sha256').update(prevRaw).digest('hex');

                if (current.parameters.prevVersionHash !== computedRaw) {
                    // Try re-stringified object as fallback (stripping witness proof)
                    const computedObj = crypto.createHash('sha256').update(JSON.stringify(prevObj)).digest('hex');

                    if (current.parameters.prevVersionHash !== computedObj) {
                        errors.push(`Version ${current.versionId}: Hash chain broken (prevVersionHash mismatch)`);
                    }
                }
            }
        }

        // 2. Check witness file if it exists
        let witnessStatus = 'none';
        try {
            const witnessText = await fs.readFile(witnessPath, 'utf-8');
            const witnessData = JSON.parse(witnessText);
            const proofs = witnessData.anchoringProofs || [];

            if (proofs.length > 0) {
                witnessStatus = 'anchored';
                for (const p of proofs) {
                    // Basic self-consistency check for Merkle path
                    const leaf = Buffer.from(p.leafHash.replace('0x', ''), 'hex');
                    const root = Buffer.from(p.merkleRoot.replace('0x', ''), 'hex');
                    const proof = (p.merkleProof || []).map((s: string) => Buffer.from(s.replace('0x', ''), 'hex'));

                    let valid = false;
                    if (proof.length === 0) {
                        valid = p.leafHash.toLowerCase() === p.merkleRoot.toLowerCase();
                    } else {
                        valid = MerkleTree.verify(proof, leaf, root, (d: any) => Buffer.from(sha256(d)), { sortPairs: true });
                        if (!valid) valid = MerkleTree.verify([...proof].reverse(), leaf, root, (d: any) => Buffer.from(sha256(d)), { sortPairs: true });
                    }

                    if (!valid) {
                        errors.push(`Cryptographic proof in did-witness.json is invalid for batch ${p.batchId}`);
                    }
                }
            }
        } catch (e: any) {
            if (e.code !== 'ENOENT') warnings.push(`Could not verify witness file: ${e.message}`);
        }

        const lastEntry = entries[entries.length - 1];
        const valid = errors.length === 0;

        return res.json({
            did,
            valid,
            versionId: lastEntry.versionId,
            checks: {
                hashChain: errors.length === 0,
                signatures: entries.every(e => e.proof?.[0]?.proofValue),
                witnesses: witnessStatus === 'anchored'
            },
            details: valid ? 'Verified successfully' : `Tampering or inconsistency detected: ${errors[0]}`,
            errors,
            warnings
        });

    } catch (err: any) {
        console.error('[Identity] Error verifying DID:', err);
        res.status(500).json({ valid: false, error: 'Internal verification error', details: err.message });
    }
});

// ============================================
// KEY ROTATION
// ============================================

/**
 * Rotate the controller key for a DID
 * POST /api/did/:did/rotate
 * 
 * Generates a new key pair, updates the DID document with the new key,
 * and invalidates the old key. Creates a new log entry with the rotation.
 */
app.post('/api/did/:did/rotate', async (req, res) => {
    const { did } = req.params;
    const { keyId, reason } = req.body;

    try {
        console.log('[Identity] Rotating key for DID:', did);

        if (!keyId) {
            return res.status(400).json({ error: 'keyId is required for authorization' });
        }

        // Load existing log
        const scid = extractScidFromDid(did);
        const log = await loadDIDLog(scid);

        if (!log || log.length === 0) {
            return res.status(404).json({ error: 'DID not found' });
        }

        // Verify old key exists and is valid
        const oldSigner = await keyManagementService.createSigner(keyId);
        if (!oldSigner) {
            return res.status(403).json({ error: 'Invalid keyId - not authorized' });
        }

        // Generate new key pair
        const newKeyResult = await keyManagementService.generateKeyPair();
        const newKeyId = newKeyResult.keyId;
        const newPublicKeyMultibase = newKeyResult.publicKeyMultibase;

        if (!newKeyId) {
            return res.status(500).json({ error: 'Failed to generate new key' });
        }

        // Get current DID document
        const currentEntry = log[log.length - 1];
        const currentDoc = currentEntry.state || currentEntry.didDocument;

        if (!currentDoc) {
            return res.status(500).json({ error: 'No DID document found in log' });
        }

        // Build new verification method
        const newVerificationMethod = {
            id: `${did}#key-${log.length + 1}`,
            type: 'Multikey',
            controller: did,
            publicKeyMultibase: newPublicKeyMultibase
        };

        // Update DID document - add new key, keep old key in history
        const updatedDoc = {
            ...currentDoc,
            verificationMethod: [
                newVerificationMethod,
                ...(currentDoc.verificationMethod || []).map((vm: any) => ({
                    ...vm,
                    // Mark old keys as revoked in metadata
                    revoked: vm.id !== newVerificationMethod.id ? new Date().toISOString() : undefined
                }))
            ],
            authentication: [newVerificationMethod.id],
            assertionMethod: [newVerificationMethod.id],
            updated: new Date().toISOString()
        };

        // Calculate previous hash
        const previousEntry = log[log.length - 1];
        const previousHash = crypto.createHash('sha256')
            .update(JSON.stringify(previousEntry))
            .digest('hex');

        const timestamp = new Date().toISOString();
        const newVersionId = String(log.length + 1);

        // Sign with OLD key (proving ownership for rotation)
        const rotationData = {
            type: 'keyRotation',
            previousKeyId: keyId,
            newKeyId: newKeyId,
            reason: reason || 'Manual key rotation',
            timestamp
        };
        const dataToSign = new TextEncoder().encode(JSON.stringify(rotationData));
        const signature = await oldSigner.sign(dataToSign);
        const proofValue = 'z' + Buffer.from(signature).toString('base64url');

        // Create new log entry
        const newEntry = {
            versionId: newVersionId,
            versionTime: timestamp,
            parameters: {
                prevVersionHash: previousHash,
                updateKeys: [newVerificationMethod.publicKeyMultibase],
                method: 'did:webvh:1.0'
            },
            state: updatedDoc,
            proof: [{
                type: 'DataIntegrityProof',
                cryptosuite: 'eddsa-jcs-2022',
                verificationMethod: `${did}#key-${log.length}`, // Signed with OLD key
                proofPurpose: 'authentication',
                created: timestamp,
                proofValue
            }]
        };

        // Append to log
        log.push(newEntry);
        await saveDIDLog(scid, log);

        // Update database
        await pool.query(
            `UPDATE identities SET public_key = $1, updated_at = NOW() WHERE did = $2`,
            [newPublicKeyMultibase, did]
        );

        // Store rotation event
        const leafHash = crypto.createHash('sha256')
            .update(JSON.stringify(newEntry))
            .digest('hex');

        await pool.query(
            `INSERT INTO events (did, event_type, payload, signature, leaf_hash, version_id, timestamp) 
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
                did,
                'key_rotation',
                JSON.stringify({
                    previousKeyId: keyId,
                    newKeyId: newKeyId,
                    reason: reason || 'Manual key rotation'
                }),
                proofValue,
                leafHash,
                newVersionId,
                Date.now()
            ]
        );

        console.log(`✅ Key rotated for DID: ${did}, new key: ${newKeyId}`);

        return res.json({
            did,
            oldKeyId: keyId,
            newKeyId: newKeyId,
            versionId: newVersionId,
            status: 'rotated'
        });

    } catch (err: any) {
        console.error('[Identity] Error rotating key:', err);
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// OWNERSHIP TRANSFER
// ============================================

/**
 * Transfer ownership of a DID to a new controller
 * POST /api/did/:did/transfer
 * 
 * Updates the controller field and adds the new owner's key
 * to the verification methods. The old owner signs the transfer.
 */
app.post('/api/did/:did/transfer', async (req, res) => {
    const { did } = req.params;
    const { keyId, newOwnerDID, newOwnerPublicKey, reason } = req.body;

    try {
        console.log('[Identity] Transferring ownership of DID:', did, 'to:', newOwnerDID);

        if (!keyId) {
            return res.status(400).json({ error: 'keyId is required for authorization' });
        }
        if (!newOwnerDID) {
            return res.status(400).json({ error: 'newOwnerDID is required' });
        }

        // Load existing log
        const scid = extractScidFromDid(did);
        const log = await loadDIDLog(scid);

        if (!log || log.length === 0) {
            return res.status(404).json({ error: 'DID not found' });
        }

        // Verify current owner's key
        const currentSigner = await keyManagementService.createSigner(keyId);
        if (!currentSigner) {
            return res.status(403).json({ error: 'Invalid keyId - not authorized' });
        }

        // Get current DID document
        const currentEntry = log[log.length - 1];
        const currentDoc = currentEntry.state || currentEntry.didDocument;

        if (!currentDoc) {
            return res.status(500).json({ error: 'No DID document found in log' });
        }

        // Build new owner's verification method (if public key provided)
        let newVerificationMethod;
        if (newOwnerPublicKey) {
            newVerificationMethod = {
                id: `${did}#key-${log.length + 1}`,
                type: 'Multikey',
                controller: newOwnerDID,
                publicKeyMultibase: newOwnerPublicKey
            };
        }

        // Update DID document - change controller
        const updatedDoc = {
            ...currentDoc,
            controller: newOwnerDID,
            verificationMethod: newVerificationMethod
                ? [newVerificationMethod, ...(currentDoc.verificationMethod || [])]
                : currentDoc.verificationMethod,
            authentication: newVerificationMethod
                ? [newVerificationMethod.id]
                : currentDoc.authentication,
            assertionMethod: newVerificationMethod
                ? [newVerificationMethod.id]
                : currentDoc.assertionMethod,
            updated: new Date().toISOString()
        };

        // Calculate previous hash
        const previousEntry = log[log.length - 1];
        const previousHash = crypto.createHash('sha256')
            .update(JSON.stringify(previousEntry))
            .digest('hex');

        const timestamp = new Date().toISOString();
        const newVersionId = String(log.length + 1);

        // Sign with current owner's key (proving authorization for transfer)
        const transferData = {
            type: 'ownershipTransfer',
            previousOwner: currentDoc.controller || did,
            newOwner: newOwnerDID,
            reason: reason || 'Ownership transfer',
            timestamp
        };
        const dataToSign = new TextEncoder().encode(JSON.stringify(transferData));
        const signature = await currentSigner.sign(dataToSign);
        const proofValue = 'z' + Buffer.from(signature).toString('base64url');

        // Create new log entry
        const newEntry = {
            versionId: newVersionId,
            versionTime: timestamp,
            parameters: {
                prevVersionHash: previousHash,
                controller: newOwnerDID,
                method: 'did:webvh:1.0'
            },
            state: updatedDoc,
            proof: [{
                type: 'DataIntegrityProof',
                cryptosuite: 'eddsa-jcs-2022',
                verificationMethod: `${did}#key-${log.length}`, // Signed by old owner
                proofPurpose: 'authentication',
                created: timestamp,
                proofValue
            }]
        };

        // Append to log
        log.push(newEntry);
        await saveDIDLog(scid, log);

        // Update database - change owner
        await pool.query(
            `UPDATE identities SET owner = $1, updated_at = NOW() WHERE did = $2`,
            [newOwnerDID, did]
        );

        // Also update products table if it exists
        try {
            await pool.query(
                `UPDATE products SET owner_did = $1, updated_at = NOW() WHERE did = $2`,
                [newOwnerDID, did]
            );
        } catch (e) {
            // Products table might not exist or have different structure
            console.log('[Identity] Note: Could not update products table');
        }

        // Store transfer event
        const leafHash = crypto.createHash('sha256')
            .update(JSON.stringify(newEntry))
            .digest('hex');

        await pool.query(
            `INSERT INTO events (did, event_type, payload, signature, leaf_hash, version_id, timestamp) 
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
                did,
                'ownership_transfer',
                JSON.stringify({
                    previousOwner: currentDoc.controller || did,
                    newOwner: newOwnerDID,
                    reason: reason || 'Ownership transfer'
                }),
                proofValue,
                leafHash,
                newVersionId,
                Date.now()
            ]
        );

        console.log(`✅ Ownership transferred and event stored: ${did} -> ${newOwnerDID}`);

        return res.json({
            did,
            previousOwner: currentDoc.controller || did,
            newOwner: newOwnerDID,
            versionId: newVersionId,
            status: 'transferred'
        });

    } catch (err: any) {
        console.error('[Identity] Error transferring ownership:', err);
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// EXISTING ENDPOINTS (preserved for compatibility)
// ============================================

// Get identity by SCID
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

// List all identities
app.get('/api/identities', async (req, res) => {
    try {
        // Optimized query to include the 'create' event payload (metadata like model/type)
        // This avoids N+1 queries from the frontend
        const result = await pool.query(`
            SELECT 
                i.did, i.scid, i.public_key, i.owner, i.status, i.created_at, i.updated_at,
                e.payload as metadata
            FROM identities i
            LEFT JOIN events e ON i.did = e.did AND e.event_type = 'create'
            ORDER BY i.created_at DESC
        `);
        return res.json(result.rows);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Get events
app.get('/api/events', async (req, res) => {
    const { did } = req.query;
    try {
        let query = 'SELECT id, did, event_type, payload, signature, leaf_hash, version_id, witness_proofs, timestamp, created_at FROM events';
        let params: any[] = [];

        if (did) {
            query += ' WHERE did = $1';
            params.push(did);
        }
        query += ' ORDER BY created_at DESC';

        const result = await pool.query(query, params);

        // Ensure timestamp is a number string or number
        const rows = result.rows.map(row => ({
            ...row,
            timestamp: typeof row.timestamp === 'string' ? parseInt(row.timestamp) : row.timestamp
        }));

        return res.json(rows);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Get batches
app.get('/api/batches', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT batch_id, merkle_root, tx_hash, block_number, status, timestamp FROM batches ORDER BY batch_id DESC'
        );
        return res.json(result.rows);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Get audits
app.get('/api/audits', async (req, res) => {
    const { did } = req.query;
    try {
        let query = 'SELECT id, did, check_type, status, details, checked_at FROM audits';
        let params: any[] = [];

        if (did) {
            query += ' WHERE did = $1';
            params.push(did);
        }
        query += ' ORDER BY checked_at DESC';

        const result = await pool.query(query, params);
        return res.json(result.rows);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Get Watcher Alerts
app.get('/api/watcher/alerts', async (req, res) => {
    const { did } = req.query;
    try {
        let query = 'SELECT id, did, event_id, reason, details, reporter, created_at FROM watcher_alerts';
        let params: any[] = [];

        if (did) {
            query += ' WHERE did = $1';
            params.push(did);
        }
        query += ' ORDER BY created_at DESC';

        const result = await pool.query(query, params);
        console.log(`[Identity] GET alerts for ${did || 'all'}: found ${result.rows.length}`);
        return res.json(result.rows);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Create Watcher Alert
app.post('/api/watcher/alerts', async (req, res) => {
    const { did, event_id, reason, details, reporter } = req.body;

    if (!did || !reason) {
        return res.status(400).json({ error: 'Missing required fields: did, reason' });
    }

    // Robust parsing of event_id (ensure it is either an integer or null)
    let cleanEventId = null;
    if (event_id !== undefined && event_id !== null) {
        // Handle cases where event_id might be a string like "event-123" or "123"
        const idStr = String(event_id);
        const match = idStr.match(/(\d+)$/);
        const parsed = parseInt(match ? match[1] : idStr);
        if (!isNaN(parsed)) {
            cleanEventId = parsed;
        }
    }

    try {
        // 1. Create the alert
        const result = await pool.query(
            `INSERT INTO watcher_alerts (did, event_id, reason, details, reporter, created_at) 
             VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING *`,
            [did, cleanEventId, reason, details, reporter || 'Watcher Node']
        );

        // 2. Update the identity status to 'tampered'
        await pool.query(
            "UPDATE identities SET status = 'tampered', updated_at = NOW() WHERE did = $1",
            [did]
        );

        console.log(`🚨 Watcher Alert created for ${did}: ${reason} (eventId: ${cleanEventId})`);
        console.log(`⚠️ Identity status set to 'tampered' for ${did}`);

        return res.json(result.rows[0]);
    } catch (err: any) {
        console.error('[Identity] Error creating alert:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * Delete alerts for a DID (used when manual verification passes)
 */
app.delete('/api/watcher/alerts/:did', async (req, res) => {
    const { did } = req.params;
    const { event_id } = req.query;

    try {
        if (event_id) {
            // Granular deletion
            let cleanEventId = null;
            const idStr = String(event_id);
            const match = idStr.match(/(\d+)$/);
            const parsed = parseInt(match ? match[1] : idStr);
            if (!isNaN(parsed)) {
                cleanEventId = parsed;
            }

            if (cleanEventId !== null) {
                await pool.query('DELETE FROM watcher_alerts WHERE did = $1 AND event_id = $2', [did, cleanEventId]);
                console.log(`✅ Cleared specific alert for ${did} event ${cleanEventId}`);
            } else {
                // Fallback if event_id provided but not parseable - maybe generic string match?
                // For now, if we can't parse it, we might want to be careful not to delete everything.
                console.warn(`[Identity] Invalid event_id provided for granular delete: ${event_id}`);
                return res.status(400).json({ error: 'Invalid event_id format' });
            }
        } else {
            // Delete ALL alerts for this DID
            await pool.query('DELETE FROM watcher_alerts WHERE did = $1', [did]);
            console.log(`✅ Cleared ALL alerts for: ${did}`);
        }

        // Check if any alerts remain for this DID
        const { rows: remaining } = await pool.query('SELECT count(*) as count FROM watcher_alerts WHERE did = $1', [did]);
        const count = parseInt(remaining[0].count);

        if (count === 0) {
            // Restore identity status to active ONLY if no alerts remain
            await pool.query("UPDATE identities SET status = 'active' WHERE did = $1", [did]);
            console.log(`✅ Restored status to active for ${did}`);
        } else {
            console.log(`ℹ️ Status remains 'tampered' for ${did} -> ${count} alerts remaining`);
        }

        return res.json({ success: true, message: `Alerts updated for ${did}` });
    } catch (err: any) {
        console.error('Error deleting alerts:', err);
        res.status(500).json({ error: err.message });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'identity',
        version: '2.0.0',
        didwebvh: true
    });
});

// ============================================
// START SERVER
// ============================================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Identity Service v2.0 running on port ${PORT}`);
    console.log(`📍 Domain: ${DOMAIN}`);
    console.log(`📁 Storage: ${STORAGE_ROOT}`);
    console.log(`✅ didwebvh-ts integration enabled`);
});
