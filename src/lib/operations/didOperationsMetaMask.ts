import { ethers } from 'ethers';
import { hybridDataStore as enhancedDB } from '../data/hybridDataStore';
import { localDB } from '../data/localData';

/**
 * DID Operations utilizing MetaMask for signing
 * These functions replace the automated/mock local operations when a wallet is connected.
 */

interface WalletInfo {
    address: string;
    signer: ethers.JsonRpcSigner;
    did: string;
}

/**
 * Helper to generate a standardized DID from domain and unique ID
 */
function generateDID(domain: string, type: string, uniqueId: string): string {
    return `did:webvh:${domain}:products:${type}-${uniqueId}`;
}

/**
 * Sign a payload using EIP-712 or Personal Sign
 */
async function signPayload(signer: ethers.JsonRpcSigner, payload: any): Promise<{ signature: string, timestamp: string } | null | never> {
    const timestamp = new Date().toISOString();
    const message = JSON.stringify({
        ...payload,
        timestamp
    }, null, 2);

    try {
        const signature = await signer.signMessage(message);
        return { signature, timestamp };
    } catch (err: any) {
        // Handle MetaMask rejection (Ethers v6 uses ACTION_REJECTED)
        if (err.code === 'ACTION_REJECTED' || err.code === 4001 || err.message?.includes('rejected')) {
            return null;
        }
        throw err;
    }
}

// --- Batch Operation Primitives ---

export interface PreparedOperation {
    type: 'create' | 'link' | 'transfer' | 'rotate' | 'deactivate' | 'update' | 'certify';
    description: string;
    payload: any;
    did?: string; // For creation
    execute: (signature: string, timestamp: string) => Promise<any>;
}

/**
 * Prepares a DID creation operation without signing or executing it yet.
 */
export function prepareCreateDPP(
    wallet: WalletInfo,
    productData: {
        type: 'main' | 'component';
        model: string;
        metadata: any;
        parentDid?: string;
    },
    domain: string = 'example.com'
): PreparedOperation {
    const timestamp = Date.now();
    const uniqueId = `${timestamp}-${Math.random().toString(36).substr(2, 9)}`;
    const productType = productData.metadata.productType || 'product';
    const did = generateDID(domain, productType, uniqueId);

    const genesisPayload = {
        operation: 'create',
        did: did,
        controller: wallet.did,
        type: productData.type,
        model: productData.model,
        created_at: new Date().toISOString()
    };

    return {
        type: 'create',
        description: `Create ${productData.model} (${did})`,
        payload: genesisPayload,
        did: did,
        execute: async (signature: string, timestamp: string) => {
            // Create DPP Entry
            const dppResult = await enhancedDB.insertDPP({
                did: did,
                type: productData.type,
                model: productData.model,
                parent_did: productData.parentDid || null,
                lifecycle_status: 'active',
                owner: wallet.did,
                custodian: wallet.did,
                metadata: {
                    ...productData.metadata,
                    signerAddress: wallet.address,
                    creationMechanism: 'wallet-signed'
                },
                version: 1,
                previous_version_id: null,
            });

            if (!dppResult) {
                throw new Error('Failed to insert DPP');
            }

            // Create DID Document
            await enhancedDB.insertDIDDocument({
                dpp_id: dppResult.id,
                did: did,
                controller: wallet.did,
                verification_method: [{
                    id: `${did}#owner-key`,
                    type: 'EcdsaSecp256k1RecoveryMethod2020',
                    controller: wallet.did,
                    blockchainAccountId: `eip155:1:${wallet.address}`
                }],
                service_endpoints: [{
                    id: `${did}#dpp-service`,
                    type: 'DPPService',
                    serviceEndpoint: `https://${domain}/dpp/${did.split(':').pop()}`,
                }],
                proof: {
                    type: 'EcdsaSecp256k1RecoveryMethod2020',
                    created: timestamp,
                    verificationMethod: `${did}#owner-key`,
                    proofPurpose: 'assertionMethod',
                    jws: signature
                },
                document_metadata: {
                    created: true,
                    productType: productData.metadata.productType
                },
            });

            return { dpp: dppResult, did: did };
        }
    };
}

/**
 * Prepares a relationship creation operation.
 */
export function prepareRelationship(
    wallet: WalletInfo,
    relationship: {
        parentDid: string;
        childDid: string;
        type: string;
        metadata?: any;
    }
): PreparedOperation {
    const payload = {
        operation: 'link',
        parent: relationship.parentDid,
        child: relationship.childDid,
        type: relationship.type
    };

    return {
        type: 'link',
        description: `Link ${relationship.parentDid} -> ${relationship.childDid}`,
        payload: payload,
        execute: async (signature: string, timestamp: string) => {
            await enhancedDB.insertRelationship({
                parent_did: relationship.parentDid,
                child_did: relationship.childDid,
                relationship_type: relationship.type,
                position: 0,
                metadata: {
                    ...relationship.metadata,
                    signedBy: wallet.address,
                    signature: signature
                }
            });
        }
    };
}

/**
 * Prepares a Transfer Ownership operation.
 */
export function prepareTransferOwnership(
    wallet: WalletInfo,
    dppId: string,
    currentOwner: string,
    newOwner: string
): PreparedOperation {
    const payload = {
        operation: 'transfer_ownership',
        dpp_id: dppId,
        prior_owner: currentOwner,
        new_owner: newOwner
    };

    return {
        type: 'transfer',
        description: `Transfer ownership to ${newOwner}`,
        payload: payload,
        execute: async (signature: string, timestamp: string) => {
            let result = { success: true, message: 'Ownership transferred and synced via backend' };

            // Call backend via hybrid data store
            await enhancedDB.transferOwnership(dppId, {
                newOwnerDID: newOwner,
                signature: signature,
                signerAddress: wallet.address
            });

            return result;
        }
    };
}

/**
 * Prepares a Key Rotation operation.
 */
export function prepareRotateKey(
    wallet: WalletInfo,
    dppId: string,
    currentOwner: string
): PreparedOperation {
    const newKeyId = `key-${Date.now()}`;
    const payload = {
        operation: 'rotate_key',
        dpp_id: dppId,
        owner: currentOwner,
        new_key_id: newKeyId
    };

    return {
        type: 'rotate',
        description: `Rotate cryptographic key`,
        payload: payload,
        execute: async (signature: string, timestamp: string) => {
            // Call backend
            await enhancedDB.rotateKey(dppId, {
                newPublicKey: 'z6MnewKey...', // Placeholder
                signature: signature,
                signerAddress: wallet.address
            });

            return { success: true, message: 'Key rotated and synced via backend' };
        }
    };
}

/**
 * Prepares a generic Update DID Document operation.
 */
export function prepareUpdateDID(
    wallet: WalletInfo,
    dppId: string,
    currentOwner: string,
    updates: {
        serviceEndpoints?: any[];
        description?: string;
    }
): PreparedOperation {
    const payload = {
        operation: 'update_did',
        dpp_id: dppId,
        updates: updates
    };

    return {
        type: 'update',
        description: `Update DID Document`,
        payload: payload,
        execute: async (signature: string, timestamp: string) => {
            // Call backend sync
            await enhancedDB.updateDID(dppId, {
                updates,
                signature: signature,
                signerAddress: wallet.address
            });

            if (updates.description) {
                await enhancedDB.updateDPP(dppId, {
                    metadata: { description: updates.description }
                });
            }

            return { success: true, message: 'DID updated successfully via backend' };
        }
    };
}

/**
 * Prepares a generic Update Status (Deactivate) operation.
 */
export function prepareDeactivateDID(
    wallet: WalletInfo,
    dppId: string,
    currentOwner: string,
    reason: string
): PreparedOperation {
    const payload = {
        operation: 'deactivate',
        dpp_id: dppId,
        reason: reason
    };

    return {
        type: 'deactivate',
        description: `Deactivate DID: ${reason}`,
        payload: payload,
        execute: async (signature: string, timestamp: string) => {
            // Call backend sync
            await enhancedDB.deactivateDID(dppId, {
                signature: signature,
                signerAddress: wallet.address
            });

            return { success: true, message: 'DID deactivated successfully via backend' };
        }
    };
}

/**
 * Prepares a Product Certification operation.
 */
export function prepareCertifyProduct(
    wallet: WalletInfo,
    dppId: string,
    currentOwner: string,
    certificationData: {
        inspector: string;
        certificateType: string;
        notes: string;
        status?: string;
    }
): PreparedOperation {
    const payload = {
        operation: 'certify',
        dpp_id: dppId,
        certification: certificationData
    };

    return {
        type: 'certify',
        description: `Certify product: ${certificationData.certificateType}`,
        payload: payload,
        execute: async (signature: string, timestamp: string) => {
            if (certificationData.status) {
                await enhancedDB.updateDPP(dppId, { lifecycle_status: certificationData.status });
            }

            await enhancedDB.insertAttestation({
                dpp_id: dppId,
                did: currentOwner,
                witness_did: currentOwner,
                attestation_type: 'certification',
                attestation_data: {
                    inspector: certificationData.inspector,
                    certificateType: certificationData.certificateType,
                    notes: certificationData.notes,
                    result: 'Certified / Approved',
                    organization: 'External Certifier (Wallet)',
                    timestamp: timestamp
                },
                signature: signature,
                approval_status: 'approved',
                witness_status: 'pending',
                timestamp: timestamp
            });

            return { success: true, message: 'Product certified successfully via backend' };
        }
    };
}

/**
 * Executes a batch of prepared operations with a single signature.
 */
export async function executeBatch(
    wallet: WalletInfo,
    operations: PreparedOperation[],
    onSigned?: () => void
) {
    if (operations.length === 0) return [];

    console.log(`[MetaMask] Executing batch of ${operations.length} operations`);

    // 1. Construct Batch Payload
    const batchPayload = {
        action: 'Batch Operation Authorization',
        controller: wallet.did,
        operations: operations.map(op => ({
            type: op.type,
            summary: op.description,
            payloadHash: ethers.id(JSON.stringify(op.payload))
        })),
        count: operations.length
    };

    // 2. Sign Batch Payload ONCE
    const signResult = await signPayload(wallet.signer, batchPayload);
    if (!signResult) {
        throw new Error('Transaction cancelled');
    }

    if (onSigned) onSigned();

    const { signature, timestamp } = signResult;

    // 3. Execute all operations using the batch signature
    const results = [];
    for (const op of operations) {
        const result = await op.execute(signature, timestamp);
        results.push(result);
    }

    return results;
}

// --- Backward Compatibility / Single Operation Wrappers ---

export async function createSignedDPP(
    wallet: WalletInfo,
    productData: {
        type: 'main' | 'component';
        model: string;
        metadata: any;
        parentDid?: string;
    },
    domain: string = 'example.com',
    onSigned?: () => void
) {
    const prep = prepareCreateDPP(wallet, productData, domain);
    const signResult = await signPayload(wallet.signer, prep.payload);
    if (!signResult) return { success: false, message: 'Operation cancelled by user' };
    
    if (onSigned) onSigned();
    const { signature, timestamp } = signResult;
    return prep.execute(signature, timestamp);
}

export async function createSignedRelationship(
    wallet: WalletInfo,
    relationship: {
        parentDid: string;
        childDid: string;
        type: string;
        metadata?: any;
    },
    onSigned?: () => void
) {
    const prep = prepareRelationship(wallet, relationship);
    const signResult = await signPayload(wallet.signer, prep.payload);
    if (!signResult) return { success: false, message: 'Operation cancelled by user' };
    
    if (onSigned) onSigned();
    const { signature, timestamp } = signResult;
    return prep.execute(signature, timestamp);
}

export async function performTransferOwnership(
    wallet: WalletInfo,
    dppId: string,
    currentOwner: string,
    newOwner: string,
    onSigned?: () => void
) {
    const prep = prepareTransferOwnership(wallet, dppId, currentOwner, newOwner);
    const signResult = await signPayload(wallet.signer, prep.payload);
    if (!signResult) return { success: false, message: 'Operation cancelled by user' };

    if (onSigned) onSigned();
    const { signature, timestamp } = signResult;
    return prep.execute(signature, timestamp);
}

export async function performRotateKey(
    wallet: WalletInfo,
    dppId: string,
    currentOwner: string,
    onSigned?: () => void
) {
    const prep = prepareRotateKey(wallet, dppId, currentOwner);
    const signResult = await signPayload(wallet.signer, prep.payload);
    if (!signResult) return { success: false, message: 'Operation cancelled by user' };

    if (onSigned) onSigned();
    const { signature, timestamp } = signResult;
    return prep.execute(signature, timestamp);
}

export async function performUpdateDID(
    wallet: WalletInfo,
    dppId: string,
    currentOwner: string,
    updates: { serviceEndpoints?: any[]; description?: string; },
    onSigned?: () => void
) {
    const prep = prepareUpdateDID(wallet, dppId, currentOwner, updates);
    const signResult = await signPayload(wallet.signer, prep.payload);
    if (!signResult) return { success: false, message: 'Operation cancelled by user' };

    if (onSigned) onSigned();
    const { signature, timestamp } = signResult;
    return prep.execute(signature, timestamp);
}

export async function performDeactivateDID(
    wallet: WalletInfo,
    dppId: string,
    currentOwner: string,
    reason: string,
    onSigned?: () => void
) {
    const prep = prepareDeactivateDID(wallet, dppId, currentOwner, reason);
    const signResult = await signPayload(wallet.signer, prep.payload);
    if (!signResult) return { success: false, message: 'Operation cancelled by user' };

    if (onSigned) onSigned();
    const { signature, timestamp } = signResult;
    return prep.execute(signature, timestamp);
}

export async function performCertifyProduct(
    wallet: WalletInfo,
    dppId: string,
    currentOwner: string,
    certificationData: {
        inspector: string;
        certificateType: string;
        notes: string;
        status?: string;
    },
    onSigned?: () => void
) {
    const prep = prepareCertifyProduct(wallet, dppId, currentOwner, certificationData);
    const signResult = await signPayload(wallet.signer, prep.payload);
    if (!signResult) return { success: false, message: 'Operation cancelled by user' };

    if (onSigned) onSigned();
    const { signature, timestamp } = signResult;
    return prep.execute(signature, timestamp);
}
