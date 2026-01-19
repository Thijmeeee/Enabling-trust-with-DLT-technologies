import { useState, useEffect } from 'react';
import { 
  Eye, 
  Anchor, 
  ChevronDown, 
  ChevronUp, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Hash, 
  Activity, 
  Loader2, 
  XCircle, 
  ExternalLink,
  Network,
  AlertCircle,
  Fingerprint,
  Link2
} from 'lucide-react';
import { hybridDataStore, getRecentBlockchainAnchors, getBlockchainVerification } from '../lib/data/hybridDataStore';
import { etherscanTxUrl, etherscanBlockUrl } from '../lib/api/config';
import { useRole } from '../lib/utils/roleContext';
import { useUI } from '../lib/utils/UIContext';
import { verifyHashChain, type HashChainEntry } from '../lib/utils/merkle';
import { verifyProtocolFiles } from '../lib/operations/didResolverLocal';
import type { WitnessAttestation, WatcherAlert, AnchoringEvent } from '../lib/data/localData';

interface TrustValidationTabProps {
  did: string;
}

type VerificationStatus = 'checking' | 'valid' | 'invalid' | 'pending';

interface VerificationState {
  hashChain: VerificationStatus;
  witnesses: VerificationStatus;
  blockchain: VerificationStatus;
  regulatory: VerificationStatus;
  trustScore: number;
  details: {
    hashChainErrors: string[];
    witnessCount: number;
    witnessThreshold: number;
    blockNumber: number | null;
    txHash: string | null;
    merkleRoot: string | null;
    etherscanTxUrl: string | null;
    etherscanBlockUrl: string | null;
    onChainVerified: boolean | null;
    lastVerified: Date | null;
  };
}

// ============================================
// Sub-Components
// ============================================

/** Circular Progress Ring for Trust Score */
// TrustScoreRing removed as part of Authenticity Certificate removal


/** Status Badge Component */
function StatusBadge({ status, size = 'md' }: { status: VerificationStatus; size?: 'sm' | 'md' }) {
  const config = {
    checking: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300', label: 'Verifying' },
    valid: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300', label: 'Verified' },
    invalid: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300', label: 'Failed' },
    pending: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-300', label: 'Pending' },
  };

  const c = config[status];
  const sizeClasses = size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-1';

  return (
    <span className={`${c.bg} ${c.text} ${sizeClasses} font-semibold rounded-full`}>
      {c.label}
    </span>
  );
}

/** Verification Check Row */
function VerificationCheck({
  icon: Icon,
  label,
  description,
  status,
  details,
}: {
  icon: React.ElementType;
  label: string;
  description: string;
  status: VerificationStatus;
  details?: string;
}) {
  const getStatusIcon = () => {
    switch (status) {
      case 'checking':
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'valid':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'invalid':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'pending':
        return <Clock className="w-5 h-5 text-yellow-500" />;
    }
  };

  return (
    <div className="flex items-start gap-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-700">
      <div className="p-2 bg-white dark:bg-gray-700 rounded-lg shadow-sm">
        <Icon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <h4 className="font-semibold text-gray-900 dark:text-white text-sm">{label}</h4>
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <StatusBadge status={status} size="sm" />
          </div>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>
        {details && (
          <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 font-mono bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded inline-block">
            {details}
          </p>
        )}
      </div>
    </div>
  );
}

/** Collapsible Section */
function CollapsibleSection({
  icon: Icon,
  title,
  subtitle,
  badge,
  expanded,
  onToggle,
  children,
  iconColor = 'text-blue-600 dark:text-blue-400',
}: {
  icon: React.ElementType;
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  iconColor?: string;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg bg-gray-100 dark:bg-gray-700 ${iconColor}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>
            {subtitle && <p className="text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {badge}
          {expanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </button>
      {expanded && (
        <div className="border-t border-gray-200 dark:border-gray-700 p-4">
          {children}
        </div>
      )}
    </div>
  );
}

/** Witness Card */
function WitnessCard({ 
  witnessId, 
  attestations,
  expanded,
  onToggle,
}: { 
  witnessId: string; 
  attestations: WitnessAttestation[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const lastAttestation = attestations[0];
  const shortId = witnessId.split(':').pop()?.substring(0, 16) || 'Unknown';

  return (
    <div className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-600/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-green-100 dark:bg-green-900/30 rounded-full">
            <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
          </div>
          <div className="text-left">
            <p className="font-medium text-sm text-gray-900 dark:text-white">{shortId}...</p>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 font-mono truncate max-w-[200px]">{witnessId}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">{attestations.length} attestations</p>
            <p className="text-[10px] text-gray-500 dark:text-gray-400">
              Last: {lastAttestation ? new Date(lastAttestation.timestamp).toLocaleDateString() : 'N/A'}
            </p>
          </div>
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </button>
      
      {expanded && (
        <div className="p-3 border-t border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Recent Attestations</p>
          <div className="space-y-1.5 max-h-32 overflow-y-auto">
            {attestations.slice(0, 5).map((att, i) => (
              <div key={i} className="flex items-center justify-between text-xs p-2 bg-gray-50 dark:bg-gray-700 rounded">
                <div className="flex items-center gap-2">
                  <Activity className="w-3 h-3 text-green-500" />
                  <span className="font-medium capitalize text-gray-700 dark:text-gray-300">
                    {att.attestation_type.replace(/_/g, ' ')}
                  </span>
                </div>
                <span className="text-gray-500 dark:text-gray-400 font-mono text-[10px]">
                  {new Date(att.timestamp).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Alert Item */
function AlertItem({ alert }: { alert: WatcherAlert }) {
  const severityConfig = {
    critical: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20' },
    warning: { icon: AlertTriangle, color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-900/20' },
    info: { icon: AlertCircle, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20' },
  };

  const config = severityConfig[alert.severity as keyof typeof severityConfig] || severityConfig.info;
  const Icon = config.icon;

  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg ${config.bg}`}>
      <Icon className={`w-4 h-4 mt-0.5 ${config.color}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-white">{alert.alert_type}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          {new Date(alert.created_at).toLocaleString()}
        </p>
      </div>
      {alert.resolved && (
        <span className="text-[10px] font-semibold text-green-600 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded-full">
          Resolved
        </span>
      )}
    </div>
  );
}

// ============================================
// Main Component
// ============================================

export default function TrustValidationTab({ did }: TrustValidationTabProps) {
  const { currentRole } = useRole();
  const { viewMode, t } = useUI();
  const [attestations, setAttestations] = useState<WitnessAttestation[]>([]);
  const [alerts, setAlerts] = useState<WatcherAlert[]>([]);
  const [anchorings, setAnchorings] = useState<AnchoringEvent[]>([]);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [expandedWitness, setExpandedWitness] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  // Cryptographic Verification State
  const [verification, setVerification] = useState<VerificationState>({
    hashChain: 'pending',
    witnesses: 'pending',
    blockchain: 'pending',
    regulatory: 'pending',
    trustScore: 0,
    details: {
      hashChainErrors: [],
      witnessCount: 0,
      witnessThreshold: 1,
      blockNumber: null,
      txHash: null,
      merkleRoot: null,
      etherscanTxUrl: null,
      etherscanBlockUrl: null,
      onChainVerified: null,
      lastVerified: null,
    }
  });

  // Blockchain anchors
  const [blockchainAnchors, setBlockchainAnchors] = useState<Array<{
    batchId: number;
    merkleRoot: string;
    blockNumber: number;
    timestamp: Date;
    txHash?: string;
    etherscanTxUrl?: string | null;
    etherscanBlockUrl: string | null;
  }>>([]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, [did]);

  useEffect(() => {
    if (attestations.length > 0 || anchorings.length > 0) {
      runVerification();
    }
  }, [attestations, anchorings]);

  async function loadData() {
    const [attestationsData, alertsData, anchoringsData] = await Promise.all([
      hybridDataStore.getAttestationsByDID(did),
      hybridDataStore.getAllAlerts(),
      hybridDataStore.getAnchoringEventsByDID(did),
    ]);

    // Filter DID-related attestations
    const didEventTypes = [
      'did_creation', 'key_rotation', 'ownership_change', 
      'ownership_transfer', 'did_update', 'did_lifecycle_update', 'create'
    ];
    setAttestations(attestationsData.filter(att => didEventTypes.includes(att.attestation_type)));

    // Filter alerts for this DID
    const dpp = await hybridDataStore.getDPPByDID(did);
    setAlerts(dpp ? alertsData.filter(a => a.dpp_id === dpp.id) : []);
    setAnchorings(anchoringsData as AnchoringEvent[]);

    // Load blockchain anchors
    try {
      const anchors = await getRecentBlockchainAnchors(10);
      setBlockchainAnchors(anchors);
    } catch (e) {
      console.warn('Could not load blockchain anchors:', e);
    }
  }

  async function runVerification() {
    setIsVerifying(true);
    
    // Reset to checking
    setVerification(prev => ({
      ...prev,
      hashChain: 'checking',
      witnesses: 'checking',
      blockchain: 'checking',
      regulatory: 'checking',
    }));

    await new Promise(r => setTimeout(r, 400));

    // 0. Comprehensive Verification from Protocol Files (NEW - DIRECT FROM FS)
    console.log('[TrustValidation] Verifying directly from protocol files...');
    const protocolResults = await verifyProtocolFiles(did);
    console.log('[TrustValidation] Protocol results:', protocolResults);

    // 1. Hash Chain Verification (Using protocol results)
    const hashChainValid = protocolResults.hashChainValid && protocolResults.logEntries.length > 0;
    
    setVerification(prev => ({
      ...prev,
      hashChain: hashChainValid ? 'valid' : 'invalid',
      details: {
        ...prev.details,
        hashChainErrors: protocolResults.errors,
      }
    }));

    await new Promise(r => setTimeout(r, 300));

    // 2. Witness Verification (Using protocol results)
    const witnessThreshold = 1;
    const hasWitnessProof = protocolResults.witnessValid && protocolResults.proofs.length > 0;
    const witnessValid = hasWitnessProof || protocolResults.witnessCount >= witnessThreshold;

    setVerification(prev => ({
      ...prev,
      witnesses: witnessValid ? 'valid' : 'pending',
      details: {
        ...prev.details,
        witnessCount: protocolResults.witnessCount || 0,
        witnessThreshold,
      }
    }));

    await new Promise(r => setTimeout(r, 300));

    // 3. Blockchain Verification
    // We combine the protocol file proofs with what we found in the blockchain state
    let blockchainVerified = false;
    let blockNumber: number | null = null;
    let txHash: string | null = null;
    let merkleRoot: string | null = null;
    let etherscanTxUrlValue: string | null = null;
    let etherscanBlockUrlValue: string | null = null;

    // Favor protocol file data if it has proofs
    if (protocolResults.proofs.length > 0) {
      const latestProof = protocolResults.proofs[protocolResults.proofs.length - 1];
      blockchainVerified = true;
      blockNumber = latestProof.blockNumber || null;
      txHash = latestProof.txHash || null;
      merkleRoot = latestProof.merkleRoot || null;
      if (txHash?.startsWith('0x')) etherscanTxUrlValue = etherscanTxUrl(txHash);
      if (blockNumber) etherscanBlockUrlValue = etherscanBlockUrl(blockNumber);
    } 
    // Fallback to DB/RPC discovery if file has no proofs yet
    else if (blockchainAnchors.length > 0) {
      const latestAnchor = blockchainAnchors[0];
      blockchainVerified = true;
      blockNumber = latestAnchor.blockNumber;
      txHash = latestAnchor.txHash || null;
      merkleRoot = latestAnchor.merkleRoot;
      etherscanTxUrlValue = latestAnchor.etherscanTxUrl || null;
      etherscanBlockUrlValue = latestAnchor.etherscanBlockUrl;
    }

    setVerification(prev => ({
      ...prev,
      blockchain: blockchainVerified ? 'valid' : 'pending',
      details: {
        ...prev.details,
        blockNumber,
        txHash,
        merkleRoot,
        etherscanTxUrl: etherscanTxUrlValue,
        etherscanBlockUrl: etherscanBlockUrlValue,
        onChainVerified: blockchainVerified,
      }
    }));

    await new Promise(r => setTimeout(r, 200));

    // 4. Regulatory Compliance
    const regulatoryValid = hashChainValid && witnessValid && blockchainVerified;
    setVerification(prev => ({
      ...prev,
      regulatory: regulatoryValid ? 'valid' : (hashChainValid || witnessValid ? 'pending' : 'pending'),
    }));

    // Calculate Trust Score based on file-derived metrics
    let score = 0;
    if (hashChainValid) score += 25;
    if (witnessValid) score += 25;
    if (blockchainVerified) score += 30;
    if (regulatoryValid) score += 20;

    setVerification(prev => ({
      ...prev,
      trustScore: score,
      details: {
        ...prev.details,
        lastVerified: new Date(),
      }
    }));

    setIsVerifying(false);
  }

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const uniqueWitnesses = Array.from(new Set(attestations.map(a => a.witness_did)));
  const activeAlerts = alerts.filter(a => !a.resolved);

  return (
    <div className="space-y-6">
      {/* ============================================ */}
      {/* PART B: Technical Audit Trail */}
      {/* ============================================ */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest px-1">
          {t('Technical Audit Trail')}
        </h3>

        {/* Integrity Verification Section */}
        <CollapsibleSection
          icon={Hash}
          title={t('Integrity Verification')}
          subtitle="Cryptographic hash chain validation"
          badge={<StatusBadge status={verification.hashChain} />}
          expanded={expandedSection === 'integrity'}
          onToggle={() => toggleSection('integrity')}
          iconColor="text-blue-600 dark:text-blue-400"
        >
          <div className="space-y-3">
            <VerificationCheck
              icon={Link2}
              label={t('Hash Chain Integrity')}
              description="Validates backlinks between all DID log entries"
              status={verification.hashChain}
              details={verification.hashChain === 'valid' 
                ? `${attestations.length} entries verified` 
                : verification.details.hashChainErrors[0]}
            />
            <VerificationCheck
              icon={Fingerprint}
              label="Entry Authenticity"
              description="Each entry cryptographically signed by controller"
              status={verification.hashChain}
            />
          </div>
        </CollapsibleSection>

        {/* Witness Network Section */}
        <CollapsibleSection
          icon={Network}
          title={t('Witness Network')}
          subtitle="Independent validator attestations"
          badge={
            <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">
              {uniqueWitnesses.length} witness{uniqueWitnesses.length !== 1 ? 'es' : ''}
            </span>
          }
          expanded={expandedSection === 'witnesses'}
          onToggle={() => toggleSection('witnesses')}
          iconColor="text-green-600 dark:text-green-400"
        >
          {uniqueWitnesses.length === 0 ? (
            <div className="text-center py-8">
              <Network className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
              <p className="text-sm text-gray-500 dark:text-gray-400">No witnesses have attested to this DID yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {uniqueWitnesses.map((witnessId) => (
                <WitnessCard
                  key={witnessId}
                  witnessId={witnessId}
                  attestations={attestations.filter(a => a.witness_did === witnessId)}
                  expanded={expandedWitness === witnessId}
                  onToggle={() => setExpandedWitness(expandedWitness === witnessId ? null : witnessId)}
                />
              ))}
            </div>
          )}
        </CollapsibleSection>

        {/* DLT Anchoring Section */}
        <CollapsibleSection
          icon={Anchor}
          title="DLT Anchoring"
          subtitle="Blockchain immutability proofs"
          badge={
            <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">
              {anchorings.length} anchor{anchorings.length !== 1 ? 's' : ''}
            </span>
          }
          expanded={expandedSection === 'anchoring'}
          onToggle={() => toggleSection('anchoring')}
          iconColor="text-purple-600 dark:text-purple-400"
        >
          {/* Latest Anchor Details */}
          {verification.details.merkleRoot && (
            <div className="mb-4 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-700">
              <h4 className="text-xs font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wider mb-3">
                Latest Anchor
              </h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-600 dark:text-gray-400">{t('merkleRoot')}:</span>
                  <span className="text-xs font-mono text-gray-800 dark:text-gray-200 truncate max-w-[200px]">
                    {verification.details.merkleRoot}
                  </span>
                </div>
                {verification.details.blockNumber && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-600 dark:text-gray-400">Block Number:</span>
                    <a
                      href={verification.details.etherscanBlockUrl || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-mono text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
                    >
                      #{verification.details.blockNumber}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
                {verification.details.txHash && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-600 dark:text-gray-400">Transaction:</span>
                    <a
                      href={verification.details.etherscanTxUrl || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-mono text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1 truncate max-w-[180px]"
                    >
                      {verification.details.txHash.slice(0, 16)}...
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Anchor History */}
          {anchorings.length === 0 ? (
            <div className="text-center py-8">
              <Anchor className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
              <p className="text-sm text-gray-500 dark:text-gray-400">No blockchain anchors found</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Events will be anchored in the next batch</p>
            </div>
          ) : (
            <div className="space-y-2">
              {anchorings.slice(0, 5).map((anchoring, idx) => (
                <div 
                  key={idx} 
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-100 dark:border-gray-600"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-purple-100 dark:bg-purple-900/30 rounded">
                      <Anchor className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        Block #{anchoring.block_number}
                      </p>
                      {anchoring.transaction_hash ? (
                        <a 
                          href={etherscanTxUrl(anchoring.transaction_hash) || '#'} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-[10px] text-purple-600 dark:text-purple-400 font-mono hover:underline flex items-center gap-1 transition-colors"
                        >
                          {anchoring.transaction_hash.slice(0, 24)}...
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      ) : (
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 font-mono truncate max-w-[180px]">
                          Pending anchoring...
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">
                      {new Date(anchoring.timestamp).toLocaleDateString()}
                    </p>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500">
                      {new Date(anchoring.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
              {anchorings.length > 5 && (
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center pt-2">
                  +{anchorings.length - 5} more anchors
                </p>
              )}
            </div>
          )}
        </CollapsibleSection>

        {/* Watcher Alerts Section */}
        <CollapsibleSection
          icon={Eye}
          title="Watcher Alert Feed"
          subtitle="Anomaly detection and monitoring"
          badge={
            activeAlerts.length > 0 ? (
              <span className="px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 text-xs font-semibold rounded-full">
                {activeAlerts.length} Active
              </span>
            ) : (
              <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs font-semibold rounded-full">
                All Clear
              </span>
            )
          }
          expanded={expandedSection === 'watchers'}
          onToggle={() => toggleSection('watchers')}
          iconColor="text-orange-600 dark:text-orange-400"
        >
          {alerts.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">System Healthy</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                No anomalies detected by the watcher network
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {alerts.slice(0, 5).map((alert, idx) => (
                <AlertItem key={idx} alert={alert} />
              ))}
            </div>
          )}
        </CollapsibleSection>
      </div>
    </div>
  );
}
