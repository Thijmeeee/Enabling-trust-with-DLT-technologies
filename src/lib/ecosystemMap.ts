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
  Link
} from 'lucide-react';
import type { UserRole } from './utils/roleContext';

export interface InfrastructureEntity {
  id: string;
  name: string;
  type: 'node' | 'database' | 'service' | 'client';
  description: string;
  icon: any;
  status: 'active' | 'standby' | 'optional';
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
      'Minting new Passports',
      'Anchoring creation events',
      'Managing product data'
    ],
    infrastructure: [
      {
        id: 'man-wallet',
        name: 'Identity Agent (Wallet)',
        type: 'service',
        description: 'Manages private keys for signing DPPs',
        icon: Key,
        status: 'active'
      },
      {
        id: 'man-db',
        name: 'Product Database',
        type: 'database',
        description: 'Stores private technical specifications',
        icon: Database,
        status: 'active'
      },
      {
        id: 'man-gateway',
        name: 'Trust Anchor Gateway',
        type: 'node',
        description: 'Connects internal systems to DLT',
        icon: Server,
        status: 'active'
      }
    ]
  },
  Witness: {
    role: 'Witness',
    label: 'Witness Node',
    description: 'Neutral party that validates critical lifecycle events.',
    responsibilities: [
      'Validating transactions',
      'Signing attestations',
      'Preventing double-spending'
    ],
    infrastructure: [
      {
        id: 'wit-node',
        name: 'Observer Node',
        type: 'node',
        description: 'Full copy of the ledger for validation',
        icon: Globe,
        status: 'active'
      },
      {
        id: 'wit-service',
        name: 'Notary Service',
        type: 'service',
        description: 'Automated signing of valid requests',
        icon: FileCheck,
        status: 'active'
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
      'Compliance checking'
    ],
    infrastructure: [
      {
        id: 'watch-node',
        name: 'Audit Node',
        type: 'node',
        description: 'Read-only access to all public proofs',
        icon: Activity,
        status: 'active'
      },
      {
        id: 'watch-analytics',
        name: 'Anomaly Detector',
        type: 'service',
        description: 'AI model scanning for irregularities',
        icon: Search,
        status: 'active'
      }
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
        status: 'active'
      }
    ]
  },
  Consumer: {
    role: 'Consumer',
    label: 'Consumer',
    description: 'End-user who scans products to verify authenticity.',
    responsibilities: [
      'Authenticity verification',
      'Accessing product story',
      'Claiming ownership (optional)'
    ],
    infrastructure: [
      {
        id: 'con-app',
        name: 'Consumer App',
        type: 'client',
        description: 'Web app for seamless product interaction',
        icon: Smartphone,
        status: 'active'
      }
    ]
  },
  Supervisor: {
    role: 'Supervisor',
    label: 'Supervisor',
    description: 'Manages access rights and network governance.',
    responsibilities: [
      'Issuing credentials',
      'Revoking compromised keys'
    ],
    infrastructure: [
      {
        id: 'sup-auth',
        name: 'Authority Node',
        type: 'node',
        description: 'governance and permission management',
        icon: Shield,
        status: 'active'
      }
    ]
  },
  Recycler: {
    role: 'Recycler',
    label: 'Recycler',
    description: 'Processes products at end-of-life.',
    responsibilities: [
      'Marking products as recycled',
      'Recovering materials'
    ],
    infrastructure: [
      {
        id: 'rec-scanner',
        name: 'Intake Scanner',
        type: 'client',
        description: 'IoT device for checking material composition',
        icon: Radio,
        status: 'active'
      }
    ]
  }
};
