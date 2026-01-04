/**
 * Generate demo did.jsonl files for seed identities
 * This script creates proper DID log files that the Watcher can verify.
 * Run this after seeding the database.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

const STORAGE_ROOT = './did-logs';

// Demo identities from seed.sql
const DEMO_IDENTITIES = [
    { scid: 'z-demo-window-001', did: 'did:webvh:localhost:3000:z-demo-window-001', type: 'window', model: 'Triple Glass Premium Window', manufacturer: 'EcoGlass BV' },
    { scid: 'z-demo-window-002', did: 'did:webvh:localhost:3000:z-demo-window-002', type: 'window', model: 'Double Glass Standard Window', manufacturer: 'EcoGlass BV' },
    { scid: 'z-demo-window-003', did: 'did:webvh:localhost:3000:z-demo-window-003', type: 'window', model: 'Smart Window with Sensors', manufacturer: 'SmartGlass Tech' },
    { scid: 'z-demo-glass-001', did: 'did:webvh:localhost:3000:z-demo-glass-001', type: 'glass', model: 'Triple Layer Tempered Glass', manufacturer: 'Glass Solutions BV' },
    { scid: 'z-demo-frame-001', did: 'did:webvh:localhost:3000:z-demo-frame-001', type: 'frame', model: 'Aluminum Thermal Break Frame', manufacturer: 'Frame Masters NV' },
];

async function generateDemoLogs() {
    console.log('🔧 Generating demo did.jsonl files...');

    for (const identity of DEMO_IDENTITIES) {
        const dirPath = path.join(STORAGE_ROOT, identity.scid);
        const logPath = path.join(dirPath, 'did.jsonl');

        // Create directory
        await fs.mkdir(dirPath, { recursive: true });

        // Generate a demo public key (just for structure - not cryptographically valid)
        const demoPublicKey = 'z6Mk' + crypto.randomBytes(32).toString('base64url').substring(0, 43);

        const timestamp = new Date().toISOString();

        // Create the DID document
        const didDocument = {
            '@context': ['https://www.w3.org/ns/did/v1'],
            id: identity.did,
            controller: identity.did,
            verificationMethod: [{
                id: `${identity.did}#key-1`,
                type: 'Multikey',
                controller: identity.did,
                publicKeyMultibase: demoPublicKey
            }],
            authentication: [`${identity.did}#key-1`],
            assertionMethod: [`${identity.did}#key-1`],
            service: [{
                id: `${identity.did}#dpp`,
                type: 'DigitalProductPassport',
                serviceEndpoint: {
                    type: identity.type,
                    model: identity.model,
                    manufacturer: identity.manufacturer
                }
            }]
        };

        // Create genesis log entry (version 1) with fields Watcher expects
        const genesisEntry = {
            did: identity.did,  // Top-level DID for Watcher verification
            versionId: '1',
            versionTime: timestamp,
            didDocument: didDocument,  // Watcher expects 'didDocument' field
            state: didDocument,  // Also include 'state' for did:webvh spec compatibility
            parameters: {
                method: 'did:webvh:1.0',
                scid: identity.scid
            },
            proof: [{
                type: 'DataIntegrityProof',
                cryptosuite: 'eddsa-jcs-2022',
                verificationMethod: `${identity.did}#key-1`,
                proofPurpose: 'authentication',
                created: timestamp,
                proofValue: 'z' + crypto.randomBytes(64).toString('base64url')
            }]
        };

        // Calculate log entry hash for backlinks
        const entryHash = crypto.createHash('sha256').update(JSON.stringify(genesisEntry)).digest('hex');
        (genesisEntry as any).logEntryHash = entryHash;


        // Write genesis entry
        await fs.writeFile(logPath, JSON.stringify(genesisEntry) + '\n');

        console.log(`   ✅ Created ${logPath}`);
    }

    console.log('✅ Demo did.jsonl files generated successfully!');

    // Also generate demo keys for the Key Management Service
    await generateDemoKeys();
}

/**
 * Generate demo keys for the Key Management Service
 * Creates a 'default-key' that can be used for all demo operations
 */
async function generateDemoKeys() {
    const KEY_STORAGE_DIR = './key-store';
    console.log('🔑 Generating demo keys...');

    await fs.mkdir(KEY_STORAGE_DIR, { recursive: true });

    // Generate a demo key pair using Ed25519
    // Note: This is a DEMO key - in production, keys should be generated securely
    const privateKeyBytes = crypto.randomBytes(32);

    // Use the EXACT same encryption key derivation as the Key Management Service
    // The secret is 'development-secret-key-replace-in-production-32b' (48 chars)
    // Since 48 > 32, it uses key.slice(0, 32) NOT sha256(key)
    const ENCRYPTION_SECRET = 'development-secret-key-replace-in-production-32b';
    const secretBuffer = Buffer.from(ENCRYPTION_SECRET);
    // Key Management logic: if key.length < 32 use sha256, else slice to 32
    const encryptionKey = secretBuffer.length < 32
        ? crypto.createHash('sha256').update(secretBuffer).digest()
        : secretBuffer.slice(0, 32);

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', encryptionKey, iv);
    const encrypted = Buffer.concat([
        cipher.update(privateKeyBytes),
        cipher.final()
    ]);

    // Create multicodec prefix for Ed25519 public key
    const multicodecPrefix = new Uint8Array([0xed, 0x01]);
    const demoPublicKey = crypto.createHash('sha256').update(privateKeyBytes).digest();
    const prefixedKey = Buffer.concat([Buffer.from(multicodecPrefix), demoPublicKey]);
    const publicKeyMultibase = 'z' + prefixedKey.toString('base64url');

    const demoKey = {
        keyId: 'default-key',
        publicKeyMultibase: publicKeyMultibase,
        encryptedPrivateKey: encrypted.toString('base64'),
        algorithm: 'Ed25519',
        createdAt: new Date().toISOString(),
        iv: iv.toString('base64')
    };

    const keyPath = path.join(KEY_STORAGE_DIR, 'default-key.json');
    await fs.writeFile(keyPath, JSON.stringify(demoKey, null, 2));
    console.log(`   ✅ Created ${keyPath}`);

    // Also create keys for each demo identity scid
    for (const identity of DEMO_IDENTITIES) {
        const scidKeyPath = path.join(KEY_STORAGE_DIR, `${identity.scid}.json`);
        const scidKey = { ...demoKey, keyId: identity.scid };
        await fs.writeFile(scidKeyPath, JSON.stringify(scidKey, null, 2));
        console.log(`   ✅ Created ${scidKeyPath}`);
    }

    console.log('✅ Demo keys generated successfully!');
}

generateDemoLogs().catch(console.error);
