import fs from 'fs/promises';
import path from 'path';
import { createServiceLogger } from './logger.js';

const log = createServiceLogger('witness-file-manager');

/**
 * @title AnchoringProof Interface
 * Represents a single batch of Anchoring information.
 */
export interface AnchoringProof {
  versionId: string;
  batchId: number;
  merkleRoot: string;
  leafHash: string;
  merkleProof: string[];
  leafIndex: number;
  txHash: string;
  blockNumber: number;
  timestamp: string;
  chainId?: string;
}

export type WitnessFile = AnchoringProof[];

const STORAGE_ROOT = process.env.STORAGE_ROOT || './did-logs';

export class WitnessFileManager {
  private static locks = new Map<string, Promise<void>>();

  /**
   * Resolves the absolute path to the did-witness.json file for a given SCID.
   */
  public static getFilePath(scid: string): string {
    return path.join(process.cwd(), STORAGE_ROOT, scid, 'did-witness.json');
  }

  /**
   * Ensures the witness file exists and is initialized.
   */
  public static async initialize(scid: string): Promise<void> {
    const filePath = this.getFilePath(scid);
    const dirPath = path.dirname(filePath);

    try {
      await fs.mkdir(dirPath, { recursive: true });
      try {
        await fs.access(filePath);
      } catch {
        // File doesn't exist, create empty array
        await fs.writeFile(filePath, JSON.stringify([], null, 2));
        log.info('Initialized new witness file', { scid, path: filePath });
      }
    } catch (err) {
      log.error('Failed to initialize witness file', { scid, error: err });
      throw err;
    }
  }

  /**
   * Reads the witness file for a given SCID.
   */
  public static async read(scid: string): Promise<WitnessFile> {
    const filePath = this.getFilePath(scid);
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        return [];
      }
      log.error('Failed to read witness file', { scid, error: err });
      throw err;
    }
  }

  /**
   * Adds multiple proofs to a witness file atomically.
   */
  public static async addProofs(scid: string, proofs: AnchoringProof[]): Promise<void> {
    const lock = this.locks.get(scid) || Promise.resolve();
    
    const operation = lock.then(async () => {
      const filePath = this.getFilePath(scid);
      const tempPath = `${filePath}.tmp`;

      try {
        // 1. Ensure initialized
        await this.initialize(scid);

        // 2. Read existing data
        const existingData = await this.read(scid);

        // 3. Merge data (avoid duplicates based on versionId)
        const versionMap = new Map<string, AnchoringProof>();
        existingData.forEach(p => versionMap.set(p.versionId, p));
        proofs.forEach(p => versionMap.set(p.versionId, p));

        const updatedData = Array.from(versionMap.values());

        // 4. Atomic write: Write to temp file then rename
        await fs.writeFile(tempPath, JSON.stringify(updatedData, null, 2));
        await fs.rename(tempPath, filePath);

        log.info('Updated witness file', { scid, addedCount: proofs.length, totalCount: updatedData.length });
      } catch (err) {
        log.error('Failed to update witness file', { scid, error: err });
        // Clean up temp file if it exists
        try { await fs.unlink(tempPath); } catch {}
        throw err;
      }
    });

    this.locks.set(scid, operation);
    
    try {
      await operation;
    } finally {
      // Small delay before removing lock to handle very fast successive calls if needed
      // but usually delete is fine
      if (this.locks.get(scid) === operation) {
        this.locks.delete(scid);
      }
    }
  }
}

export const witnessFileManager = WitnessFileManager;
