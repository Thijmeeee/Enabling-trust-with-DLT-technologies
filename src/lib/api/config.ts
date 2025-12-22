/**
 * API Configuration
 * 
 * Central configuration for backend API connections.
 * In production, these would be set via environment variables.
 */

// Detect if we're running on local development
const IS_LOCAL_DEV = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

// API Base URLs
export const API_CONFIG = {
  // Backend API base URL - use localhost:3000 in dev, /api in production
  BASE_URL: IS_LOCAL_DEV ? 'http://localhost:3000/api' : '/api',

  // Identity Service endpoints
  IDENTITY: {
    CREATE: '/products/create',
    GET: '/identity', // + /:scid
    LIST: '/identities',
    EVENTS: '/events',
  },

  // Witness Service endpoints  
  WITNESS: {
    ATTEST: '/witness/attest',
    BATCHES: '/batches',
    PROOF: '/witness/proof', // + /:eventId
  },

  // Watcher Service endpoints
  WATCHER: {
    AUDITS: '/audits',
    STATUS: '/watcher/status',
  },

  // Blockchain configuration
  BLOCKCHAIN: {
    // For local dev, use Hardhat; for production, use Sepolia
    RPC_URL: import.meta.env.VITE_RPC_URL || (IS_LOCAL_DEV
      ? 'http://localhost:8545'
      : 'https://sepolia.infura.io/v3/your-api-key'),
    CHAIN_ID: IS_LOCAL_DEV ? 31337 : 11155111,
    // EXPLORER_URL can be configured via VITE_EXPLORER_URL env var
    // Set to https://sepolia.etherscan.io for Sepolia testnet
    EXPLORER_URL: import.meta.env.VITE_EXPLORER_URL || (IS_LOCAL_DEV ? null : 'https://sepolia.etherscan.io'),
    CONTRACT_ADDRESS: import.meta.env.VITE_CONTRACT_ADDRESS || '0x5FbDB2315678afecb367f032d93F642f64180aa3',
    IS_LOCAL: IS_LOCAL_DEV,
  },
};

// Helper to build full API URLs
export function apiUrl(endpoint: string): string {
  return `${API_CONFIG.BASE_URL}${endpoint}`;
}

// Helper to build Etherscan links (returns null for local Hardhat)
export function etherscanTxUrl(txHash: string): string | null {
  if (!API_CONFIG.BLOCKCHAIN.EXPLORER_URL) return null;
  return `${API_CONFIG.BLOCKCHAIN.EXPLORER_URL}/tx/${txHash}`;
}

export function etherscanBlockUrl(blockNumber: number): string | null {
  if (!API_CONFIG.BLOCKCHAIN.EXPLORER_URL) return null;
  return `${API_CONFIG.BLOCKCHAIN.EXPLORER_URL}/block/${blockNumber}`;
}

export function etherscanAddressUrl(address: string): string {
  return `${API_CONFIG.BLOCKCHAIN.EXPLORER_URL}/address/${address}`;
}
