import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { MerkleTree } from 'merkletreejs';

const STORAGE_PATHS = ['./did-logs', '../deployment/did-logs'];

/**
 * Helper: SHA256 hashing for Merkle Tree
 */
const sha256 = (data: string | Buffer) => crypto.createHash('sha256').update(data).digest();

async function generateAllWitnessFiles() {
    for (const storageRoot of STORAGE_PATHS) {
        console.log(`🔧 Scanning ${storageRoot} for identities...`);

        try {
            const absoluteRoot = path.resolve(process.cwd(), storageRoot);
            try {
                await fs.access(absoluteRoot);
            } catch {
                console.log(`   ⚠️ Path ${storageRoot} not found, skipping.`);
                continue;
            }

            const entries = await fs.readdir(absoluteRoot, { withFileTypes: true });
            const scidDirs = entries.filter(e => e.isDirectory()).map(e => e.name);

            console.log(`   found ${scidDirs.length} potential identity directories.`);

            for (const scid of scidDirs) {
                const dirPath = path.join(absoluteRoot, scid);
                const logPath = path.join(dirPath, 'did.jsonl');
                const witnessPath = path.join(dirPath, 'did-witness.json');

                try {
                    // Check if did.jsonl exists
                    await fs.access(logPath);
                    
                    const content = await fs.readFile(logPath, 'utf-8');
                    let logEntries: any[] = [];

                    // Try parsing as a single JSON object first (pretty-printed case)
                    try {
                        const singleObj = JSON.parse(content.trim());
                        logEntries = Array.isArray(singleObj) ? singleObj : [singleObj];
                    } catch {
                        // If that fails, treat as standard JSONL (one object per line)
                        const lines = content.trim().split('\n').filter(l => l.trim().length > 0);
                        if (lines.length === 0) continue;
                        
                        for (const line of lines) {
                            try {
                                logEntries.push(JSON.parse(line));
                            } catch (e) {
                                // Skip malformed lines if it's actually partially pretty-printed
                                continue;
                            }
                        }
                    }
                    
                    if (logEntries.length === 0) {
                        console.warn(`   ⚠️ No valid JSON entries found in ${logPath}`);
                        continue;
                    }

                const witnessProofs: any[] = [];
                for (let i = 0; i < logEntries.length; i++) {
                    const entry = logEntries[i];
                    const entryBuf = Buffer.from(JSON.stringify(entry));
                    const leaf = sha256(entryBuf);
                    
                    // Create dummy siblings for a more interesting tree
                    const sibling1 = sha256(`dummy-sibling-${scid}-${i}-1`);
                    const sibling2 = sha256(`dummy-sibling-${scid}-${i}-2`);
                    const leaves = [leaf, sibling1, sibling2];
                    
                    const tree = new MerkleTree(leaves, sha256, { sortPairs: true });
                    const root = tree.getHexRoot();
                    const proof = tree.getHexProof(leaf);
                    const leafIndex = tree.getLeafIndex(leaf);

                    witnessProofs.push({
                        versionId: entry.versionId || (i + 1).toString(),
                        batchId: 1000 + i,
                        merkleRoot: root,
                        leafHash: '0x' + leaf.toString('hex'),
                        merkleProof: proof,
                        leafIndex: leafIndex,
                        txHash: '0x' + crypto.randomBytes(32).toString('hex'),
                        blockNumber: 6000000 + i,
                        timestamp: entry.versionTime || new Date().toISOString(),
                        chainId: '11155111' // Sepolia
                    });
                }

                await fs.writeFile(witnessPath, JSON.stringify(witnessProofs, null, 2));
                console.log(`   ✅ Generated ${witnessPath} (${witnessProofs.length} proofs)`);

            } catch (err: any) {
                if (err.code !== 'ENOENT') {
                    console.error(`   ❌ Error processing ${scid}:`, err.message);
                }
            }
            }

            console.log(`\n✨ Finished processing ${storageRoot}`);

        } catch (err: any) {
            console.error(`Failed to read storage root ${storageRoot}:`, err.message);
        }
    }
}

generateAllWitnessFiles().catch(console.error);
