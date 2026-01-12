import { 
  Database, 
  Server, 
  Globe, 
  Smartphone, 
  Shield, 
  Search, 
  Key, 
  FileCheck,
  Activity,
  Box,
  Cpu,
  Radio,
  HardDrive,
  Users,
  Link,
  Calculator,
  Scan
} from 'lucide-react';
import type { UserRole } from './utils/roleContext';

export interface InfrastructureEntity {
  id: string;
  name: string;
  type: 'node' | 'database' | 'service' | 'client';
  description: string;
  icon: any;
}

export interface StakeholderProfile {
  role: UserRole;
  label: string;
  description: string;
  responsibilities: string[];
  infrastructure: InfrastructureEntity[];
}

export const ECOSYSTEM_MAP: Record<string, StakeholderProfile> = {
  Manufacturer: {
    role: 'Manufacturer',
    label: 'Manufacturer',
    description: 'Creates products and mints initial Digital Product Passports.',
    responsibilities: [
      'Minting new DPPs',
      'Managing product data',
      'Managing DID-files'
    ],
    infrastructure: [
      {
        id: 'man-wallet',
        name: 'Identity Agent (Wallet)',
        type: 'service',
        description: 'Manages private keys for signing DPPs',
        icon: Key
      },
      {
        id: 'man-db',
        name: 'Product Database',
        type: 'database',
        description: 'Stores private technical specifications',
        icon: Database,
      },
    ]
  },
  Witness: {
    role: 'Witness',
    label: 'Witness',
    description: 'Neutral party that validates critical lifecycle events.',
    responsibilities: [
      'Validating DID-operations',
      'Anchoring proofs on blockchain'
    ],
    infrastructure: [
      {
        id: 'wit-service',
        name: 'Notary Service',
        type: 'service',
        description: 'Automated signing of valid requests',
        icon: FileCheck,
      },
       {
        id: 'man-gateway',
        name: 'Trust Anchor Gateway',
        type: 'node',
        description: 'Connects internal systems to blockchain',
        icon: Server,
      }
    ]
  },
  Watcher: {
    role: 'Watcher',
    label: 'Watcher',
    description: 'Monitors network health and detects anomalies.',
    responsibilities: [
      'Audit logging',
      'Fraud detection',
    ],
    infrastructure: [
      {
        id: 'observer-node',
        name: 'Observer Node',
        type: 'node',
        description: 'Full copy of the ledger for validation',
        icon: Globe,
      },
      {
        id: 'audit-node',
        name: 'Audit Node',
        type: 'node',
        description: 'Read-only access to all public proofs',
        icon: Search,
      },
      {
        id: 'calculating-node',
        name: 'Calculating Node',
        type: 'node',
        description: 'Reconstructing the merkle tree with verifying hashes',
        icon: Calculator,
      },
    ]
  },
  Resolver: {
    role: 'Resolver',
    label: 'DID Resolver',
    description: 'Resolves Decentralized Identifiers (DIDs) to their latest valid state.',
    responsibilities: [
      'DID resolving',
      'Caching document states',
      'Verifying DID history'
    ],
    infrastructure: [
      {
        id: 'res-node',
        name: 'Resolver Node',
        type: 'node',
        description: 'Global entry point for DID traversal',
        icon: Link,
      }
    ]
  },
  ConsumerRecycler: {
    role: 'Consumer' as any,
    label: 'Consumer & Recycler',
    description: 'End-users and recycling facilities who interact with products throughout and at the end of their lifecycle.',
    responsibilities: [
      'Accessing product story and transparency data',
      'Claiming ownership and verifying authenticity',
      'Marking products as recycled at end-of-life',
      'Recovering valuable materials using DPP data'
    ],
    infrastructure: [
      {
        id: 'con-app',
        name: 'Consumer App',
        type: 'client',
        description: 'Scans QR-codes to access the Digital Product Passport data.',
        icon: Scan,
      },
      {
        id: 'rec-scanner',
        name: 'Recycler Portal',
        type: 'client',
        description: 'Interface for material recovery and recycling status updates.',
        icon: Radio,
      }
    ]
  }
};
