/**
 * Blockchain Client
 * 
 * Direct blockchain interaction for verification purposes.
 * Uses ethers.js to query the WitnessAnchorRegistry contract.
 */

import { ethers } from 'ethers';
import { API_CONFIG, etherscanTxUrl, etherscanBlockUrl } from './config';

// WitnessAnchorRegistry ABI (minimal for read operations)
const CONTRACT_ABI = [
  "function batchCount() external view returns (uint256)",
  "function roots(uint256 batchId) external view returns (bytes32)",
  "function timestamps(uint256 batchId) external view returns (uint256)",
  "function blockNumbers(uint256 batchId) external view returns (uint256)",
  "function verify(uint256 batchId, bytes32 expectedRoot) external view returns (bool)",
  "function getBatch(uint256 batchId) external view returns (bytes32 root, uint256 timestamp, uint256 blockNum)",
  "event Anchored(uint256 indexed batchId, bytes32 indexed root, uint256 timestamp, uint256 blockNumber)"
];

export interface BatchInfo {
  batchId: number;
  merkleRoot: string;
  timestamp: number;
  blockNumber: number;
  etherscanTxUrl?: string | null;
  etherscanBlockUrl: string | null;
}

export interface VerificationResult {
  verified: boolean;
  batchId: number;
  onChainRoot: string;
  expectedRoot: string;
  blockNumber: number;
  timestamp: Date;
  etherscanBlockUrl: string | null;
}

let provider: ethers.JsonRpcProvider | null = null;
let contract: ethers.Contract | null = null;
let isBlockchainReachable = true;
let lastReachabilityCheck = 0;
const REACHABILITY_TTL = 60000; // 1 minute

// Caches to avoid redundant RPC calls
const batchCache = new Map<number, BatchInfo>();
let lastAnchorFetch = 0;
let cachedAnchors: any[] = [];
const ANCHOR_CACHE_TTL = 30000; // 30 seconds

let cachedBatchCount: number | null = null;
let lastBatchCountFetch = 0;
const BATCH_COUNT_TTL = 10000; // 10 seconds

/**
 * Initialize the blockchain provider and contract
 */
function getProvider(): ethers.JsonRpcProvider {
  if (!provider) {
    // Determine the network from config to avoid auto-probing
    const chainId = API_CONFIG.BLOCKCHAIN.CHAIN_ID;
    provider = new ethers.JsonRpcProvider(API_CONFIG.BLOCKCHAIN.RPC_URL, chainId, {
      staticNetwork: new ethers.Network(chainId === 11155111 ? 'sepolia' : 'hardhat', chainId),
      batchMaxCount: 1
    });
  }
  return provider;
}

function getContract(): ethers.Contract {
  if (!isBlockchainReachable && (Date.now() - lastReachabilityCheck < REACHABILITY_TTL)) {
    throw new Error('Blockchain is currently unreachable (CORS or network error). Skipping.');
  }

  if (!contract) {
    const contractAddress = API_CONFIG.BLOCKCHAIN.CONTRACT_ADDRESS;
    if (!contractAddress) {
      throw new Error('Contract address not configured. Set VITE_CONTRACT_ADDRESS.');
    }
    contract = new ethers.Contract(contractAddress, CONTRACT_ABI, getProvider());
  }
  return contract;
}

/**
 * Check if the blockchain is reachable (one-time check per interval)
 */
async function checkReachability(): Promise<boolean> {
  const now = Date.now();
  if (now - lastReachabilityCheck < REACHABILITY_TTL) {
    return isBlockchainReachable;
  }

  try {
    const p = getProvider();
    // Use a tiny timeout for the reachability check to fail fast for CORS
    const result = await Promise.race([
      p.getBlockNumber(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000))
    ]);
    isBlockchainReachable = true;
    lastReachabilityCheck = now;
    return true;
  } catch (e) {
    console.warn('Blockchain RPC is unreachable or blocked by CORS:', e);
    isBlockchainReachable = false;
    lastReachabilityCheck = now;
    return false;
  }
}

/**
 * Get the total number of batches anchored
 */
export async function getBatchCount(): Promise<number> {
  const now = Date.now();
  if (cachedBatchCount !== null && now - lastBatchCountFetch < BATCH_COUNT_TTL) {
    return cachedBatchCount;
  }

  if (!(await checkReachability())) return 0;

  try {
    const contract = getContract();
    const count = await contract.batchCount();
    cachedBatchCount = Number(count);
    lastBatchCountFetch = now;
    return cachedBatchCount;
  } catch (e) {
    console.error('getBatchCount failed:', e);
    return 0;
  }
}

/**
 * Get batch information by ID
 */
export async function getBatch(batchId: number): Promise<BatchInfo> {
  if (batchCache.has(batchId)) {
    return batchCache.get(batchId)!;
  }

  if (!(await checkReachability())) {
    throw new Error('Blockchain unreachable');
  }

  try {
    const contract = getContract();
    const [root, timestamp, blockNum] = await contract.getBatch(batchId);
    
    const info: BatchInfo = {
      batchId,
      merkleRoot: root,
      timestamp: Number(timestamp),
      blockNumber: Number(blockNum),
      etherscanBlockUrl: etherscanBlockUrl(Number(blockNum)),
    };

    if (root && root !== '0x' + '0'.repeat(64)) {
      batchCache.set(batchId, info);
    }

    return info;
  } catch (e) {
    console.error(`getBatch(${batchId}) failed:`, e);
    throw e;
  }
}

/**
 * Verify a Merkle root against the on-chain value
 */
export async function verifyOnChain(
  batchId: number, 
  expectedRoot: string
): Promise<VerificationResult> {
  const defaultResult: VerificationResult = {
    verified: false,
    batchId,
    onChainRoot: '0x',
    expectedRoot,
    blockNumber: 0,
    timestamp: new Date(),
    etherscanBlockUrl: null,
  };

  if (!(await checkReachability())) return defaultResult;

  try {
    // Use cached getBatch to avoid redundant RPC calls
    const batch = await getBatch(batchId);
    
    // Verification is simple comparison of roots
    const verified = batch.merkleRoot === expectedRoot;
    
    return {
      verified,
      batchId,
      onChainRoot: batch.merkleRoot,
      expectedRoot,
      blockNumber: batch.blockNumber,
      timestamp: new Date(batch.timestamp * 1000),
      etherscanBlockUrl: batch.etherscanBlockUrl,
    };
  } catch (e) {
    console.error(`Verification failed for batch ${batchId}:`, e);
    return defaultResult;
  }
}

/**
 * Get all recent batches (last N)
 */
export async function getRecentBatches(count: number = 10): Promise<BatchInfo[]> {
  const totalBatches = await getBatchCount();
  const batches: BatchInfo[] = [];
  
  const startId = Math.max(0, totalBatches - count);
  
  for (let i = totalBatches - 1; i >= startId; i--) {
    try {
      const batch = await getBatch(i);
      batches.push(batch);
    } catch (e) {
      console.error(`Failed to fetch batch ${i}:`, e);
    }
  }
  
  return batches;
}

/**
 * Get Anchored events from the contract
 */
export async function getAnchoredEvents(fromBlock: number = 0): Promise<Array<{
  batchId: number;
  root: string;
  timestamp: number;
  blockNumber: number;
  transactionHash: string;
  etherscanTxUrl: string | null;
}>> {
  const now = Date.now();
  if (now - lastAnchorFetch < ANCHOR_CACHE_TTL && cachedAnchors.length > 0) {
    return cachedAnchors;
  }

  if (!(await checkReachability())) return [];

  try {
    const contract = getContract();
    
    const filter = contract.filters.Anchored();
    const events = await contract.queryFilter(filter, fromBlock);
    
    const results = events.map(event => {
      const log = event as ethers.Log & { args: [bigint, string, bigint, bigint] };
      return {
        batchId: Number(log.args[0]),
        root: log.args[1],
        timestamp: Number(log.args[2]),
        blockNumber: Number(log.args[3]),
        transactionHash: log.transactionHash,
        etherscanTxUrl: etherscanTxUrl(log.transactionHash),
      };
    });

    cachedAnchors = results;
    lastAnchorFetch = now;
    return results;
  } catch (e) {
    console.error('getAnchoredEvents failed:', e);
    return [];
  }
}

/**
 * Check if blockchain is reachable
 */
export async function checkBlockchainHealth(): Promise<{
  connected: boolean;
  blockNumber: number | null;
  chainId: number | null;
  error?: string;
}> {
  try {
    const provider = getProvider();
    const [blockNumber, network] = await Promise.all([
      provider.getBlockNumber(),
      provider.getNetwork(),
    ]);
    
    return {
      connected: true,
      blockNumber,
      chainId: Number(network.chainId),
    };
  } catch (e: any) {
    return {
      connected: false,
      blockNumber: null,
      chainId: null,
      error: e.message,
    };
  }
}

export const blockchainClient = {
  getBatchCount,
  getBatch,
  verifyOnChain,
  getRecentBatches,
  getAnchoredEvents,
  checkBlockchainHealth,
};

export default blockchainClient;
