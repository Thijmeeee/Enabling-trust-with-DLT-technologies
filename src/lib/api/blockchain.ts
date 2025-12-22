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
  etherscanTxUrl?: string;
  etherscanBlockUrl: string;
}

export interface VerificationResult {
  verified: boolean;
  batchId: number;
  onChainRoot: string;
  expectedRoot: string;
  blockNumber: number;
  timestamp: Date;
  etherscanBlockUrl: string;
}

let provider: ethers.JsonRpcProvider | null = null;
let contract: ethers.Contract | null = null;

/**
 * Initialize the blockchain provider and contract
 */
function getProvider(): ethers.JsonRpcProvider {
  if (!provider) {
    provider = new ethers.JsonRpcProvider(API_CONFIG.BLOCKCHAIN.RPC_URL);
  }
  return provider;
}

function getContract(): ethers.Contract {
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
 * Get the total number of batches anchored
 */
export async function getBatchCount(): Promise<number> {
  const contract = getContract();
  const count = await contract.batchCount();
  return Number(count);
}

/**
 * Get batch information by ID
 */
export async function getBatch(batchId: number): Promise<BatchInfo> {
  const contract = getContract();
  const [root, timestamp, blockNum] = await contract.getBatch(batchId);
  
  return {
    batchId,
    merkleRoot: root,
    timestamp: Number(timestamp),
    blockNumber: Number(blockNum),
    etherscanBlockUrl: etherscanBlockUrl(Number(blockNum)),
  };
}

/**
 * Verify a Merkle root against the on-chain value
 */
export async function verifyOnChain(
  batchId: number, 
  expectedRoot: string
): Promise<VerificationResult> {
  const contract = getContract();
  
  // Get batch info
  const [root, timestamp, blockNum] = await contract.getBatch(batchId);
  
  // Verify
  const verified = await contract.verify(batchId, expectedRoot);
  
  return {
    verified,
    batchId,
    onChainRoot: root,
    expectedRoot,
    blockNumber: Number(blockNum),
    timestamp: new Date(Number(timestamp) * 1000),
    etherscanBlockUrl: etherscanBlockUrl(Number(blockNum)),
  };
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
  etherscanTxUrl: string;
}>> {
  const contract = getContract();
  
  const filter = contract.filters.Anchored();
  const events = await contract.queryFilter(filter, fromBlock);
  
  return events.map(event => {
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
