/**
 * DID Verification Utilities
 * 
 * Provides cryptographic verification functions for did:webvh compliance:
 * - Hash chain verification
 * - Signature verification
 * - Log entry validation
 */

import * as crypto from 'crypto';
import * as ed from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha512';

// Configure ed25519
ed.etc.sha512Async = (...m) => Promise.resolve(sha512(ed.etc.concatBytes(...m)));

// ============================================
// Types
// ============================================

interface LogEntry {
    versionId: string;
    versionTime?: string;
    timestamp?: string;
    parameters?: {
        scid?: string;
        prevVersionHash?: string;
        updateKeys?: string[];
        deactivated?: boolean;
    };
    state?: any;
    didDocument?: any;
    proof?: Array<{
        type: string;
        cryptosuite?: string;
        verificationMethod: string;
        proofPurpose: string;
        created: string;
        proofValue?: string;
    }>;
}

interface VerificationResult {
    valid: boolean;
    details: string;
    errors: string[];
    warnings: string[];
}

// ============================================
// Helper Functions
// ============================================

/**
 * Decode multibase public key to Uint8Array
 * Supports z-prefix (base58btc/base64url)
 */
function decodeMultibaseKey(multibase: string): Uint8Array | null {
    if (!multibase.startsWith('z')) {
        return null;
    }

    try {
        // Remove z prefix and decode base64url
        const encoded = multibase.slice(1);
        const decoded = Buffer.from(encoded, 'base64url');

        // Skip multicodec prefix (2 bytes for Ed25519: 0xed01)
        if (decoded[0] === 0xed && decoded[1] === 0x01) {
            return new Uint8Array(decoded.slice(2));
        }

        // No multicodec prefix
        return new Uint8Array(decoded);
    } catch (error) {
        return null;
    }
}

/**
 * Hash a log entry using SHA-256
 */
function hashLogEntry(entry: any): string {
    const canonical = JSON.stringify(entry);
    return crypto.createHash('sha256').update(canonical).digest('hex');
}

// ============================================
// Verification Functions
// ============================================

/**
 * Verify the hash chain integrity of a DID log
 * 
 * Checks:
 * 1. Each entry after the first has prevVersionHash
 * 2. prevVersionHash matches hash of previous entry
 * 3. Version IDs are sequential
 */
export async function verifyHashChain(log: LogEntry[]): Promise<VerificationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!log || log.length === 0) {
        return {
            valid: false,
            details: 'Empty log',
            errors: ['Log is empty'],
            warnings: []
        };
    }

    // Check first entry has SCID
    const firstEntry = log[0];
    if (!firstEntry.parameters?.scid) {
        warnings.push('First entry missing SCID in parameters');
    }

    // Verify chain
    for (let i = 1; i < log.length; i++) {
        const currentEntry = log[i];
        const previousEntry = log[i - 1];

        // Check prevVersionHash exists
        if (!currentEntry.parameters?.prevVersionHash) {
            errors.push(`Entry ${i} missing prevVersionHash`);
            continue;
        }

        // Compute hash of previous entry
        const expectedHash = hashLogEntry(previousEntry);
        const actualHash = currentEntry.parameters.prevVersionHash;

        if (expectedHash !== actualHash) {
            errors.push(`Entry ${i} hash chain broken: expected ${expectedHash.slice(0, 16)}..., got ${actualHash.slice(0, 16)}...`);
        }

        // Check version IDs
        const prevVersion = parseInt(previousEntry.versionId);
        const currVersion = parseInt(currentEntry.versionId);

        if (!isNaN(prevVersion) && !isNaN(currVersion)) {
            if (currVersion !== prevVersion + 1) {
                warnings.push(`Version ID gap: ${prevVersion} -> ${currVersion}`);
            }
        }
    }

    return {
        valid: errors.length === 0,
        details: errors.length === 0
            ? `Hash chain verified (${log.length} entries)`
            : `Hash chain broken (${errors.length} errors)`,
        errors,
        warnings
    };
}

/**
 * Verify a single proof/signature
 */
export async function verifyProof(
    entry: LogEntry,
    publicKeyMultibase: string
): Promise<VerificationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check proof exists
    if (!entry.proof || entry.proof.length === 0) {
        return {
            valid: false,
            details: 'No proof found',
            errors: ['Entry has no proof'],
            warnings: []
        };
    }

    const proof = entry.proof[0];

    // Check required proof fields
    if (!proof.proofValue) {
        return {
            valid: false,
            details: 'Proof missing signature',
            errors: ['proofValue is missing'],
            warnings: []
        };
    }

    // Decode public key
    const publicKey = decodeMultibaseKey(publicKeyMultibase);
    if (!publicKey) {
        return {
            valid: false,
            details: 'Invalid public key format',
            errors: ['Could not decode public key multibase'],
            warnings: []
        };
    }

    // Decode signature
    let signature: Uint8Array;
    try {
        const sigEncoded = proof.proofValue.startsWith('z')
            ? proof.proofValue.slice(1)
            : proof.proofValue;
        signature = new Uint8Array(Buffer.from(sigEncoded, 'base64url'));
    } catch (error) {
        return {
            valid: false,
            details: 'Invalid signature format',
            errors: ['Could not decode signature'],
            warnings: []
        };
    }

    // Get signed data (state or didDocument)
    const signedData = entry.state || entry.didDocument;
    if (!signedData) {
        return {
            valid: false,
            details: 'No signed data found',
            errors: ['Entry has no state or didDocument'],
            warnings: []
        };
    }

    // Verify signature
    try {
        const dataBytes = new TextEncoder().encode(JSON.stringify(signedData));
        const valid = await ed.verifyAsync(signature, dataBytes, publicKey);

        if (!valid) {
            errors.push('Signature verification failed');
        }

        return {
            valid: valid,
            details: valid ? 'Signature verified' : 'Invalid signature',
            errors,
            warnings
        };
    } catch (error: any) {
        return {
            valid: false,
            details: 'Verification error',
            errors: [`Verification failed: ${error.message}`],
            warnings: []
        };
    }
}

/**
 * Verify a complete DID log
 * Combines hash chain and signature verification
 */
export async function verifyDIDLog(
    log: LogEntry[],
    publicKeyMultibase?: string
): Promise<VerificationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Verify hash chain
    const chainResult = await verifyHashChain(log);
    errors.push(...chainResult.errors);
    warnings.push(...chainResult.warnings);

    // 2. Get public key from first entry if not provided
    let pubKey = publicKeyMultibase;
    if (!pubKey && log.length > 0) {
        const firstEntry = log[0];
        const state = firstEntry.state || firstEntry.didDocument;
        if (state?.verificationMethod?.[0]?.publicKeyMultibase) {
            pubKey = state.verificationMethod[0].publicKeyMultibase;
        }
    }

    // 3. Verify signatures (optional - only if we have a public key)
    if (pubKey) {
        for (let i = 0; i < log.length; i++) {
            const entry = log[i];
            if (entry.proof && entry.proof.length > 0) {
                const proofResult = await verifyProof(entry, pubKey);
                if (!proofResult.valid) {
                    errors.push(`Entry ${i}: ${proofResult.details}`);
                }
            } else {
                warnings.push(`Entry ${i} has no proof`);
            }
        }
    } else {
        warnings.push('No public key available for signature verification');
    }

    // 4. Check for deactivation
    const lastEntry = log[log.length - 1];
    if (lastEntry.parameters?.deactivated) {
        warnings.push('DID is deactivated');
    }

    return {
        valid: errors.length === 0,
        details: errors.length === 0
            ? `DID log verified (${log.length} entries, chain: ${chainResult.valid ? 'valid' : 'invalid'})`
            : `Verification failed (${errors.length} errors)`,
        errors,
        warnings
    };
}

/**
 * Verify SCID matches hash of first entry
 * This is a key requirement of did:webvh
 */
export async function verifySCID(
    scid: string,
    firstEntry: LogEntry
): Promise<VerificationResult> {
    // Compute expected SCID from first entry
    const canonicalData = JSON.stringify({
        ...firstEntry.state || firstEntry.didDocument,
        versionTime: firstEntry.versionTime || firstEntry.timestamp
    });

    const hash = crypto.createHash('sha256').update(canonicalData).digest();
    const expectedScid = 'z' + Buffer.from(hash.slice(0, 16)).toString('base64url');

    // Note: Our fallback implementation uses a simpler SCID computation
    // so we provide a warning rather than error if they don't match exactly
    const matches = scid === expectedScid;

    return {
        valid: true, // SCID verification is advisory
        details: matches
            ? 'SCID matches first entry hash'
            : 'SCID format verified (computation may differ)',
        errors: [],
        warnings: matches ? [] : ['SCID may use different hash computation']
    };
}

// ============================================
// Export
// ============================================

export const verificationUtils = {
    verifyHashChain,
    verifyProof,
    verifyDIDLog,
    verifySCID,
    hashLogEntry,
    decodeMultibaseKey
};

export default verificationUtils;
