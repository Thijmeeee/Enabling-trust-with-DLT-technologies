/**
 * Key Management Service
 * 
 * Provides secure Ed25519 key generation, storage, and signer creation
 * for use with the didwebvh-ts library.
 * 
 * Security:
 * - Private keys stored encrypted at rest
 * - Keys identified by unique keyId
 * - Supports key rotation
 */

import * as ed from '@noble/ed25519';
import { sha256 } from '@noble/hashes/sha256';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';

// Configure ed25519 to use synchronous SHA-512
import { sha512 } from '@noble/hashes/sha512';
ed.etc.sha512Async = (...m) => Promise.resolve(sha512(ed.etc.concatBytes(...m)));

// ============================================
// Types
// ============================================

interface StoredKeyPair {
    keyId: string;
    publicKeyMultibase: string;
    encryptedPrivateKey: string;
    algorithm: 'Ed25519';
    createdAt: string;
    iv: string; // Initialization vector for encryption
}

interface KeyPairResult {
    keyId: string;
    publicKey: Uint8Array;
    publicKeyMultibase: string;
}

export interface Signer {
    sign: (data: Uint8Array) => Promise<Uint8Array>;
    publicKey: Uint8Array;
    publicKeyMultibase: string;
    algorithm: string;
}

// ============================================
// Configuration
// ============================================

const KEY_STORAGE_DIR = process.env.KEY_STORAGE_DIR || './key-store';
const ENCRYPTION_KEY = process.env.KEY_ENCRYPTION_SECRET || 'development-secret-key-replace-in-production-32b';

// Ensure encryption key is 32 bytes
function getEncryptionKey(): Buffer {
    const key = Buffer.from(ENCRYPTION_KEY);
    if (key.length < 32) {
        // Pad to 32 bytes with SHA256
        return Buffer.from(sha256(key));
    }
    return key.slice(0, 32);
}

// ============================================
// Key Storage Functions
// ============================================

/**
 * Initialize the key storage directory
 */
async function ensureStorageDir(): Promise<void> {
    try {
        await fs.mkdir(KEY_STORAGE_DIR, { recursive: true });
    } catch (error) {
        // Directory might already exist
    }
}

/**
 * Encrypt private key for storage
 */
function encryptPrivateKey(privateKey: Uint8Array): { encrypted: string; iv: string } {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', getEncryptionKey(), iv);
    const encrypted = Buffer.concat([
        cipher.update(Buffer.from(privateKey)),
        cipher.final()
    ]);
    return {
        encrypted: encrypted.toString('base64'),
        iv: iv.toString('base64')
    };
}

/**
 * Decrypt private key from storage
 */
function decryptPrivateKey(encrypted: string, iv: string): Uint8Array {
    const decipher = crypto.createDecipheriv(
        'aes-256-cbc',
        getEncryptionKey(),
        Buffer.from(iv, 'base64')
    );
    const decrypted = Buffer.concat([
        decipher.update(Buffer.from(encrypted, 'base64')),
        decipher.final()
    ]);
    return new Uint8Array(decrypted);
}

/**
 * Convert public key to multibase format (z-base58btc for Ed25519)
 * Using simplified z + base64url encoding
 */
function toMultibase(publicKey: Uint8Array): string {
    // Multicodec prefix for Ed25519 public key: 0xed01
    const multicodecPrefix = new Uint8Array([0xed, 0x01]);
    const prefixedKey = new Uint8Array(multicodecPrefix.length + publicKey.length);
    prefixedKey.set(multicodecPrefix);
    prefixedKey.set(publicKey, multicodecPrefix.length);

    // z prefix = base58btc (but we use base64url for simplicity)
    return 'z' + Buffer.from(prefixedKey).toString('base64url');
}

// ============================================
// Key Management Functions
// ============================================

/**
 * Generate a new Ed25519 keypair and store it securely
 */
export async function generateKeyPair(): Promise<KeyPairResult> {
    await ensureStorageDir();

    // Generate Ed25519 keypair
    const privateKey = ed.utils.randomPrivateKey();
    const publicKey = await ed.getPublicKeyAsync(privateKey);

    // Create unique key ID
    const keyId = 'key-' + crypto.randomBytes(8).toString('hex') + '-' + Date.now().toString(36);

    // Encrypt private key for storage
    const { encrypted, iv } = encryptPrivateKey(privateKey);

    // Create multibase public key
    const publicKeyMultibase = toMultibase(publicKey);

    // Store key
    const storedKey: StoredKeyPair = {
        keyId,
        publicKeyMultibase,
        encryptedPrivateKey: encrypted,
        algorithm: 'Ed25519',
        createdAt: new Date().toISOString(),
        iv
    };

    const keyPath = path.join(KEY_STORAGE_DIR, `${keyId}.json`);
    await fs.writeFile(keyPath, JSON.stringify(storedKey, null, 2));

    console.log(`[KeyManagement] Generated new keypair: ${keyId}`);

    return {
        keyId,
        publicKey,
        publicKeyMultibase
    };
}

/**
 * Load a stored keypair by ID
 */
export async function loadKeyPair(keyId: string): Promise<{
    publicKey: Uint8Array;
    privateKey: Uint8Array;
    publicKeyMultibase: string;
} | null> {
    const keyPath = path.join(KEY_STORAGE_DIR, `${keyId}.json`);

    try {
        const data = await fs.readFile(keyPath, 'utf-8');
        const stored: StoredKeyPair = JSON.parse(data);

        const privateKey = decryptPrivateKey(stored.encryptedPrivateKey, stored.iv);
        const publicKey = await ed.getPublicKeyAsync(privateKey);

        return {
            publicKey,
            privateKey,
            publicKeyMultibase: stored.publicKeyMultibase
        };
    } catch (error) {
        console.error(`[KeyManagement] Failed to load key ${keyId}:`, error);
        return null;
    }
}

/**
 * Create a signer for use with didwebvh-ts
 * 
 * The signer provides:
 * - sign(data): Signs data with the private key
 * - publicKey: The public key as Uint8Array
 * - publicKeyMultibase: The public key in multibase format
 * - algorithm: The algorithm identifier
 */
export async function createSigner(keyId: string): Promise<Signer | null> {
    const keyPair = await loadKeyPair(keyId);

    if (!keyPair) {
        console.error(`[KeyManagement] Cannot create signer: key ${keyId} not found`);
        return null;
    }

    const { privateKey, publicKey, publicKeyMultibase } = keyPair;

    return {
        sign: async (data: Uint8Array): Promise<Uint8Array> => {
            const signature = await ed.signAsync(data, privateKey);
            return signature;
        },
        publicKey,
        publicKeyMultibase,
        algorithm: 'Ed25519'
    };
}

/**
 * List all stored key IDs
 */
export async function listKeys(): Promise<string[]> {
    await ensureStorageDir();

    try {
        const files = await fs.readdir(KEY_STORAGE_DIR);
        return files
            .filter(f => f.endsWith('.json'))
            .map(f => f.replace('.json', ''));
    } catch (error) {
        return [];
    }
}

/**
 * Delete a stored key
 */
export async function deleteKey(keyId: string): Promise<boolean> {
    const keyPath = path.join(KEY_STORAGE_DIR, `${keyId}.json`);

    try {
        await fs.unlink(keyPath);
        console.log(`[KeyManagement] Deleted key: ${keyId}`);
        return true;
    } catch (error) {
        return false;
    }
}

/**
 * Find a key ID by its public key multibase
 */
export async function findKeyIdByPublicKey(publicKeyMultibase: string): Promise<string | null> {
    try {
        const keys = await listKeys();
        for (const keyId of keys) {
            const keyPath = path.join(KEY_STORAGE_DIR, `${keyId}.json`);
            const data = await fs.readFile(keyPath, 'utf-8');
            const stored: StoredKeyPair = JSON.parse(data);
            if (stored.publicKeyMultibase === publicKeyMultibase) {
                return keyId;
            }
        }
    } catch (error) {
        console.error('[KeyManagement] Error finding key by public key:', error);
    }
    return null;
}

/**
 * Verify a signature
 */
export async function verifySignature(
    message: Uint8Array,
    signature: Uint8Array,
    publicKey: Uint8Array
): Promise<boolean> {
    try {
        return await ed.verifyAsync(signature, message, publicKey);
    } catch (error) {
        console.error('[KeyManagement] Signature verification failed:', error);
        return false;
    }
}

// ============================================
// Export
// ============================================

export const keyManagementService = {
    generateKeyPair,
    loadKeyPair,
    createSigner,
    listKeys,
    deleteKey,
    findKeyIdByPublicKey,
    verifySignature,
    toMultibase
};

export default keyManagementService;
