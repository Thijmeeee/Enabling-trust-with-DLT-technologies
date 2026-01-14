import React, { createContext, useContext, useState } from 'react';

export type ViewMode = 'simple' | 'technical';

interface UIContextType {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  toggleViewMode: () => void;
  t: (key: string) => string;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

const mapping: Record<ViewMode, Record<string, string>> = {
  simple: {
    // Nav & Tabs
    'Overview': 'Passport',
    'Passport': 'Passport',
    'Story': 'Journey',
    'Specifications': 'Tech Sheet',
    'Components': 'Materials',
    'Lifecycle': 'Life Trace',
    'DID Operations': 'Security Log',
    'Trust & Validation': 'Proof of Trust',
    'Events': 'History',

    // Concepts
    'blockchain.anchor': 'Public Notarization',
    'blockchain.seal': 'Digital Seal',
    'blockchain.authenticity': 'Authenticity Stamp',
    'did.controller': 'Verified Issuer',
    'witness.name': 'Independent Auditor',
    'watcher.name': 'Integrity Monitor',
    'event.hash': 'Digital Fingerprint',
    'merkle.root': 'Batch Signature',
    'trust.layer': 'Trust Layer',
    'trust.verified': 'Verified Origin',
    'DID:webvh (Verifiable Hash) Identifier': 'Verified Digital Identity',
    'did_identifier': 'Digital Identity',
    'Main Product': 'Verified Main Product',
    'Component': 'Certified Part',
    
    // Details
    'transactionHash': 'Digital Receipt',
    'txHash': 'Digital Receipt',
    'merkleRoot': 'Security Seal',
    'blockNumber': 'Blockchain Record',
    'signature': 'Digital Signature',
    'witness': 'Auditor',
    'controller': 'Account Owner',
    'Trust Score': 'Confidence Level',
    'Hash Chain': 'History Integrity',
    'Blockchain Anchors': 'Public Registry Records',
    'Regulatory Compliance': 'Policy Check',
    'Witness Attestations': 'Certified Auditor Reviews',
    'Blockchain Immutability': 'Permanent Public Record',
    'Regulatory Readiness': 'Legal Compliance',
    'Watcher Network Status': 'Security Monitoring',
    'Technical Audit Trail': 'Verification Details',
    'Integrity Verification': 'Digital Integrity',
    'Witness Network': 'Auditor Network',
    'Block & Merkle': 'Technical Security Details',
    'Product Identity Registered': 'Official Birth Certificate',
    'Security Key Rotated': 'Access Keys Renewed',
    'Ownership Transferred': 'New Owner Registered',
    'Identity Document Updated': 'Passport Details Updated',
    'Lifecycle Status Changed': 'Product Status Update',
    'DPP Created': 'Digital Passport Issued',

    // Overview Page
    'Dimensions': 'Product Size',
    'Weight': 'Total Mass',
    'Production Date': 'Date of Manufacture'
  },
  technical: {
    // Nav & Tabs
    'Overview': 'Overview',
    'Passport': 'Overview',
    'Story': 'Event Story',
    'Specifications': 'Specifications',
    'Components': 'Components',
    'Lifecycle': 'Lifecycle',
    'DID Operations': 'DID Operations',
    'Trust & Validation': 'Trust & Validation',
    'Events': 'Events',

    // Concepts
    'blockchain.anchor': 'Blockchain Anchor',
    'blockchain.seal': 'Cryptographic Seal',
    'blockchain.authenticity': 'Data Authenticity',
    'did.controller': 'DID Controller',
    'witness.name': 'Witness',
    'watcher.name': 'Watcher',
    'event.hash': 'Event Hash',
    'merkle.root': 'Merkle Root',
    'trust.layer': 'Blockchain Trust Layer',
    'trust.verified': 'Valid Proof Chain',
    'DID:webvh (Verifiable Hash) Identifier': 'DID:webvh Identifier',
    'did_identifier': 'DID:webvh Identifier',
    'Main Product': 'Main Product',
    'Component': 'Component'
  }
};

export const UIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [viewMode, setViewModeState] = useState<ViewMode>(() => {
    const saved = localStorage.getItem('viewMode');
    return (saved === 'simple' || saved === 'technical') ? saved : 'technical';
  });

  const setViewMode = (mode: ViewMode) => {
    setViewModeState(mode);
    localStorage.setItem('viewMode', mode);
  };

  const toggleViewMode = () => {
    const newMode = viewMode === 'simple' ? 'technical' : 'simple';
    setViewMode(newMode);
  };

  const t = (key: string): string => {
    return mapping[viewMode][key] || key;
  };

  return (
    <UIContext.Provider value={{ viewMode, setViewMode, toggleViewMode, t }}>
      {children}
    </UIContext.Provider>
  );
};

export const useUI = () => {
  const context = useContext(UIContext);
  if (context === undefined) {
    throw new Error('useUI must be used within a UIProvider');
  }
  return context;
};
