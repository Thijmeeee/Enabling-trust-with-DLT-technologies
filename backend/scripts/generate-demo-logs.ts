/**
 * Generate demo did.jsonl files for seed identities
 * This script creates proper DID log files that the Watcher can verify.
 * Run this after seeding the database.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as crypto from 'crypto';
import { MerkleTree } from 'merkletreejs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STORAGE_ROOT = process.env.STORAGE_ROOT && process.env.STORAGE_ROOT !== './did-logs'
    ? process.env.STORAGE_ROOT
    : path.resolve(__dirname, '../did-logs');

const DEMO_IDENTITIES = [
    { scid: 'z-demo-window-001', did: 'did:webvh:localhost:3000:z-demo-window-001', type: 'window', model: 'Triple Glass Premium Window', manufacturer: 'EcoGlass BV' },
    { scid: 'z-demo-window-002', did: 'did:webvh:localhost:3000:z-demo-window-002', type: 'window', model: 'Double Glass Standard Window', manufacturer: 'EcoGlass BV' },
    { scid: 'z-demo-window-003', did: 'did:webvh:localhost:3000:z-demo-window-003', type: 'window', model: 'Smart Window with Sensors', manufacturer: 'SmartGlass Tech' },
    { scid: 'z-demo-glass-001', did: 'did:webvh:localhost:3000:z-demo-glass-001', type: 'glass', model: 'Triple Layer Tempered Glass', manufacturer: 'Glass Solutions BV' },
    { scid: 'z-demo-glass-002', did: 'did:webvh:localhost:3000:z-demo-glass-002', type: 'glass', model: 'Double Layer Tempered Glass', manufacturer: 'Glass Solutions BV' },
    { scid: 'z-demo-glass-003', did: 'did:webvh:localhost:3000:z-demo-glass-003', type: 'glass', model: 'Single Layer Tempered Glass', manufacturer: 'Glass Solutions BV' },
    { scid: 'z-demo-frame-001', did: 'did:webvh:localhost:3000:z-demo-frame-001', type: 'frame', model: 'Aluminum Thermal Break Frame', manufacturer: 'Frame Masters NV' },
    { scid: 'z-demo-frame-002', did: 'did:webvh:localhost:3000:z-demo-frame-002', type: 'frame', model: 'Wood Grain Aluminum Frame', manufacturer: 'Frame Masters NV' },
    { scid: 'z-demo-frame-003', did: 'did:webvh:localhost:3000:z-demo-frame-003', type: 'frame', model: 'Steel Reinforced Frame', manufacturer: 'Frame Masters NV' },
];

/**
 * Helper: SHA256 hashing for Merkle Tree
 */
const sha256 = (data: string | Buffer) => crypto.createHash('sha256').update(data).digest();

async function generateDemoLogs() {
    console.log('🔧 Generating demo did.jsonl files (Real Merkle Logic)...');

    for (const identity of DEMO_IDENTITIES) {
        const dirPath = path.join(STORAGE_ROOT, identity.scid);
        const logPath = path.join(dirPath, 'did.jsonl');

        // Create directory
        await fs.mkdir(dirPath, { recursive: true });

        // 1. Setup Version 1
        const demoPublicKey = 'z6Mk' + crypto.randomBytes(32).toString('hex').substring(0, 43);
        const v1NextKey = 'z6Mk' + crypto.randomBytes(32).toString('hex').substring(0, 43);
        const timestamp = new Date().toISOString();
        
        const v1State = {
            '@context': ['https://www.w3.org/ns/did/v1', 'https://w3id.org/security/multikey/v1'],
            id: identity.did,
            verificationMethod: [{
                id: `${identity.did}#key-1`,
                controller: identity.did,
                type: 'Multikey',
                publicKeyMultibase: demoPublicKey
            }],
            authentication: [`${identity.did}#key-1`],
            assertionMethod: [`${identity.did}#key-1`],
            service: [{
                id: `${identity.did}#domain`,
                type: 'LinkedDomains',
                serviceEndpoint: `https://localhost:3000`
            }]
        };

        const v1Entry: any = {
            versionId: '1',
            versionTime: timestamp,
            parameters: {
                method: 'did:webvh:1.0',
                scid: identity.scid,
                updateKeys: [v1NextKey]
            },
            state: v1State,
            proof: [
                {
                    type: 'DataIntegrityProof',
                    cryptosuite: 'eddsa-jcs-2022',
                    verificationMethod: `${identity.did}#key-1`,
                    proofPurpose: 'assertionMethod',
                    created: timestamp,
                    proofValue: 'z' + crypto.randomBytes(64).toString('base64url')
                }
            ]
        };

        // 2. Setup Version 2 (for demonstrating history/witnesses)
        const v2Timestamp = new Date(Date.now() + 86400000).toISOString();
        // v1Hash MUST be calculated on the object WITHOUT the MerkleProof2019
        const v1Hash = crypto.createHash('sha256').update(JSON.stringify(v1Entry)).digest('hex');
        
        const v2Entry: any = {
            versionId: '2',
            versionTime: v2Timestamp,
            parameters: {
                method: 'did:webvh:1.0',
                scid: identity.scid,
                prevVersionHash: v1Hash,
                updateKeys: ['z6Mk' + crypto.randomBytes(32).toString('hex').substring(0, 43)]
            },
            state: v1State, // same state for demo
            proof: [
                {
                    type: 'DataIntegrityProof',
                    cryptosuite: 'eddsa-jcs-2022',
                    verificationMethod: `${identity.did}#key-1`,
                    proofPurpose: 'assertionMethod',
                    created: v2Timestamp,
                    proofValue: 'z' + crypto.randomBytes(64).toString('base64url')
                }
            ]
        };

        // 3. GENERATE REAL MERKLE PROOFS
        // Note: leaves are calculated from objects BEFORE adding MerkleProof2019
        const v1Leaf = crypto.createHash('sha256').update(JSON.stringify(v1Entry)).digest();
        const v2Leaf = crypto.createHash('sha256').update(JSON.stringify(v2Entry)).digest();
        const sibling1 = sha256('fake-event-1');
        const sibling2 = sha256('fake-event-2');

        const tree = new MerkleTree([v1Leaf, v2Leaf, sibling1, sibling2], sha256, { sortPairs: true });
        const root = tree.getHexRoot();

        // Add Merkle Proofs to entries
        [v1Entry, v2Entry].forEach((entry, idx) => {
            const leaf = idx === 0 ? v1Leaf : v2Leaf;
            const proof = tree.getHexProof(leaf);
            
            entry.proof.push({
                type: 'MerkleProof2019',
                proofPurpose: 'witness',
                merkleRoot: root,
                path: proof,
                anchor: {
                    type: 'EthereumSepolia',
                    contract: '0x1234...Placeholder', // This would be the deployed contract
                    block: 5432100 + idx
                }
            });
        });

        const logContent = [JSON.stringify(v1Entry), JSON.stringify(v2Entry)].join('\n') + '\n';
        await fs.writeFile(logPath, logContent);
        console.log(`   ✅ Created ${logPath} (REAL Merkle hashes generated)`);

        // 4. GENERATE did-witness.json (for visualization)
        const witnessPath = path.join(dirPath, 'did-witness.json');
        const witnessProofs = [v1Entry, v2Entry].map((entry, idx) => {
            const leaf = idx === 0 ? v1Leaf : v2Leaf;
            const proof = tree.getHexProof(leaf);
            
            return {
                versionId: entry.versionId,
                batchId: 100 + idx,
                merkleRoot: root,
                leafHash: '0x' + leaf.toString('hex'),
                merkleProof: proof,
                leafIndex: idx, // In our dummy tree v1 is 0, v2 is 1
                txHash: '0x' + crypto.randomBytes(32).toString('hex'),
                blockNumber: 5432100 + idx,
                timestamp: entry.versionTime,
                chainId: '11155111' // Sepolia
            };
        });

        await fs.writeFile(witnessPath, JSON.stringify(witnessProofs, null, 2));
        console.log(`   ✅ Created ${witnessPath}`);
    }

    console.log('✅ Demo logs updated with mathematically valid Merkle proofs!');
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
