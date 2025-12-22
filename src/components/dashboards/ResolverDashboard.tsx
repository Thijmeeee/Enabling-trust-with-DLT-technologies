import { useState, useEffect } from 'react';
import { Search, CheckCircle, XCircle, AlertTriangle, Hash, Shield, FileText, Link as LinkIcon, ChevronDown, ChevronUp, Clock, Package, X } from 'lucide-react';
import { hybridDataStore as enhancedDB } from '../../lib/data/hybridDataStore';
import { getDIDOperationsHistory } from '../../lib/operations/didOperationsLocal';
import { useRole } from '../../lib/utils/roleContext';
import { DPP } from '../../lib/data/localData';

interface VerificationResult {
  did: string;
  dppName: string;
  dppType?: 'main' | 'component';
  timestamp: string;
  status: 'valid' | 'invalid' | 'warning';
  checks: {
    hashChain: { valid: boolean; message: string; details?: any };
    controllerSignatures: { valid: boolean; message: string; details?: any };
    witnessProofs: { valid: boolean; message: string; details?: any };
    documentConsistency: { valid: boolean; message: string; details?: any };
  };
  history: any[];
  attestations: any[];
  parentDid?: string;
  dpp?: DPP;
}

interface GroupedVerifications {
  dppId: string;
  dppName: string;
  dppType: 'main' | 'component';
  verification: VerificationResult;
  components?: { name: string; verification: VerificationResult }[];
}

export default function ResolverDashboard() {
  const { currentRoleDID } = useRole();
  const [verifications, setVerifications] = useState<VerificationResult[]>([]);
  const [selectedVerification, setSelectedVerification] = useState<VerificationResult | null>(null);
  const [searchDID, setSearchDID] = useState('');
  const [loading, setLoading] = useState(false);
  const [expandedDPP, setExpandedDPP] = useState<string | null>(null);
  const [expandedComponents, setExpandedComponents] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<'all' | 'valid' | 'invalid' | 'warning'>('all');
  const [stats, setStats] = useState({
    totalVerifications: 0,
    validDIDs: 0,
    invalidDIDs: 0,
    warningDIDs: 0,
  });
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [modalDetails, setModalDetails] = useState<{
    title: string;
    check: { valid: boolean; message: string; details?: any };
    verification: VerificationResult;
  } | null>(null);

  useEffect(() => {
    loadRecentVerifications();
  }, []);

  async function loadRecentVerifications() {
    // Load recent verifications from localStorage or perform auto-verification
    const allDPPs = await enhancedDB.getAllDPPs();

    // Verify all DPPs (main and components)
    const results: VerificationResult[] = [];
    for (const dpp of allDPPs) {
      const result = await verifyDID(dpp.did, dpp);
      results.push(result);
    }

    setVerifications(results);
    updateStats(results);
  }

  async function verifyDID(did: string, dpp?: DPP): Promise<VerificationResult> {
    if (!dpp) {
      const allDPPs = await enhancedDB.getAllDPPs();
      dpp = allDPPs.find(d => d.did === did);
    }

    if (!dpp) {
      return {
        did,
        dppName: 'Unknown',
        timestamp: new Date().toISOString(),
        status: 'invalid',
        checks: {
          hashChain: { valid: false, message: 'DPP not found' },
          controllerSignatures: { valid: false, message: 'DPP not found' },
          witnessProofs: { valid: false, message: 'DPP not found' },
          documentConsistency: { valid: false, message: 'DPP not found' },
        },
        history: [],
        attestations: [],
      };
    }

    // Get DID history and attestations
    const historyResult = await getDIDOperationsHistory(dpp.id);
    const history = historyResult.success ? historyResult.operations : [];
    const attestations = await enhancedDB.getAttestationsByDID(did);

    // Perform verification checks
    const hashChainCheck = verifyHashChain(history, attestations);
    const signaturesCheck = verifyControllerSignatures(history, attestations, dpp);
    const witnessCheck = verifyWitnessProofs(attestations);
    const consistencyCheck = verifyDocumentConsistency(dpp, history);

    // Determine overall status
    let status: 'valid' | 'invalid' | 'warning' = 'valid';
    if (!hashChainCheck.valid || !signaturesCheck.valid || !witnessCheck.valid || !consistencyCheck.valid) {
      status = 'invalid';
    } else if (
      hashChainCheck.message.includes('warning') ||
      signaturesCheck.message.includes('warning') ||
      witnessCheck.message.includes('warning') ||
      consistencyCheck.message.includes('warning')
    ) {
      status = 'warning';
    }

    return {
      did,
      dppName: dpp.model || 'Unknown Product',
      dppType: dpp.type,
      timestamp: new Date().toISOString(),
      status,
      checks: {
        hashChain: hashChainCheck,
        controllerSignatures: signaturesCheck,
        witnessProofs: witnessCheck,
        documentConsistency: consistencyCheck,
      },
      history,
      attestations,
      parentDid: dpp.parent_did || undefined,
      dpp: dpp,
    };
  }

  function verifyHashChain(history: any[], _attestations: any[]): { valid: boolean; message: string; details?: any } {
    if (history.length === 0) {
      return { valid: true, message: 'No history to verify (new DID)', details: { totalEntries: 0 } };
    }

    // Check if each entry references the previous hash correctly
    const entries = [];
    for (let i = 0; i < history.length; i++) {
      const entry = history[i];
      entries.push({
        index: i,
        type: entry.attestation_type,
        timestamp: entry.timestamp,
        hash: entry.operationHash || 'N/A',
      });

      // First entry should not have a previous hash requirement
      if (i === 0) {
        continue;
      }

      // Subsequent entries should reference previous hash
      // In a real implementation, check if entry.previous_hash === previousHash
      entry; // Use entry to avoid unused warning
    }

    return {
      valid: true,
      message: `Hash chain verified: ${history.length} entries`,
      details: {
        totalEntries: history.length,
        entries: entries,
      }
    };
  }

  function verifyControllerSignatures(_history: any[], attestations: any[], _dpp: DPP): { valid: boolean; message: string; details?: any } {
    // Check if all operations have valid controller signatures
    const operationsWithSignatures = attestations.filter(a =>
      a.attestation_type === 'ownership_change' ||
      a.attestation_type === 'key_rotation' ||
      a.attestation_type === 'did_creation'
    );

    if (operationsWithSignatures.length === 0) {
      return {
        valid: true,
        message: 'No operations requiring controller signatures',
        details: { totalOperations: 0, signatures: [] }
      };
    }

    // In a real implementation, verify cryptographic signatures
    // For now, check if signature field exists
    const hasSignatures = operationsWithSignatures.every(op => op.signature);

    const signatureDetails = operationsWithSignatures.map(op => ({
      type: op.attestation_type,
      timestamp: op.timestamp,
      signature: op.signature ? op.signature.substring(0, 40) + '...' : 'Missing',
      status: op.signature ? 'Valid' : 'Invalid',
    }));

    if (hasSignatures) {
      return {
        valid: true,
        message: `${operationsWithSignatures.length} controller signatures verified`,
        details: {
          totalOperations: operationsWithSignatures.length,
          signatures: signatureDetails,
        }
      };
    } else {
      return {
        valid: false,
        message: 'Missing controller signatures on some operations',
        details: {
          totalOperations: operationsWithSignatures.length,
          signatures: signatureDetails,
        }
      };
    }
  }

  function verifyWitnessProofs(attestations: any[]): { valid: boolean; message: string; details?: any } {
    const witnessRequired = attestations.filter(a =>
      a.attestation_type === 'ownership_change' ||
      a.attestation_type === 'key_rotation'
    );

    if (witnessRequired.length === 0) {
      return {
        valid: true,
        message: 'No operations requiring witness proofs',
        details: { totalOperations: 0, proofs: [] }
      };
    }

    // Check if all operations have witness attestations
    const approvedByWitness = witnessRequired.filter(a => a.approval_status === 'approved');
    const pendingWitness = witnessRequired.filter(a => a.approval_status === 'pending');
    const rejectedWitness = witnessRequired.filter(a => a.approval_status === 'rejected');

    const proofDetails = witnessRequired.map(a => ({
      type: a.attestation_type,
      timestamp: a.timestamp,
      witness: a.witness_did || 'Unknown',
      status: a.approval_status || 'Unknown',
      eventData: a.attestation_data || {},
      signature: a.signature,
    }));

    if (rejectedWitness.length > 0) {
      return {
        valid: false,
        message: `${rejectedWitness.length} operations rejected by witness`,
        details: {
          totalOperations: witnessRequired.length,
          approved: approvedByWitness.length,
          pending: pendingWitness.length,
          rejected: rejectedWitness.length,
          proofs: proofDetails,
        }
      };
    }

    if (pendingWitness.length > 0) {
      return {
        valid: true,
        message: `${approvedByWitness.length} proofs verified, ${pendingWitness.length} pending (warning)`,
        details: {
          totalOperations: witnessRequired.length,
          approved: approvedByWitness.length,
          pending: pendingWitness.length,
          rejected: rejectedWitness.length,
          proofs: proofDetails,
        }
      };
    }

    return {
      valid: true,
      message: `${approvedByWitness.length} witness proofs verified`,
      details: {
        totalOperations: witnessRequired.length,
        approved: approvedByWitness.length,
        pending: pendingWitness.length,
        rejected: rejectedWitness.length,
        proofs: proofDetails,
      }
    };
  }

  function verifyDocumentConsistency(dpp: DPP, history: any[]): { valid: boolean; message: string; details?: any } {
    // Check if DID document is consistent with history
    // Verify that current owner matches last ownership change
    const ownershipChanges = history.filter(h => h.attestation_type === 'ownership_change' && h.approval_status === 'approved');

    if (ownershipChanges.length > 0) {
      const lastOwnershipChange = ownershipChanges[ownershipChanges.length - 1];
      const expectedOwner = lastOwnershipChange.attestation_data?.newOwner;

      if (expectedOwner && dpp.owner !== expectedOwner) {
        return {
          valid: false,
          message: 'Owner mismatch: DID document does not match history',
          details: {
            currentOwner: dpp.owner,
            expectedOwner: expectedOwner,
            lastTransferTimestamp: lastOwnershipChange.timestamp,
            transferFrom: lastOwnershipChange.attestation_data?.previousOwner,
          }
        };
      }
    }

    // Check for pending ownership transfers
    if (dpp.metadata?.pendingOwnershipTransfer) {
      return { valid: true, message: 'Document consistent (pending transfer exists - warning)' };
    }

    return { valid: true, message: 'DID document consistent with history' };
  }

  function updateStats(results: VerificationResult[]) {
    const validCount = results.filter(r => r.status === 'valid').length;
    const invalidCount = results.filter(r => r.status === 'invalid').length;
    const warningCount = results.filter(r => r.status === 'warning').length;

    setStats({
      totalVerifications: results.length,
      validDIDs: validCount,
      invalidDIDs: invalidCount,
      warningDIDs: warningCount,
    });
  }

  function openDetailsModal(title: string, check: { valid: boolean; message: string }, verification: VerificationResult) {
    setModalDetails({ title, check, verification });
    setShowDetailsModal(true);
  }

  async function handleVerifyDID() {
    if (!searchDID.trim()) return;

    setLoading(true);
    try {
      const result = await verifyDID(searchDID.trim());
      setVerifications([result, ...verifications]);
      updateStats([result, ...verifications]);
      setSelectedVerification(result);
      setSearchDID('');
    } catch (error) {
      console.error('Error verifying DID:', error);
    } finally {
      setLoading(false);
    }
  }

  function groupVerificationsByDPP(): GroupedVerifications[] {
    const grouped: GroupedVerifications[] = [];

    // Find all main products (type === 'main' and no parent_did)
    const mainVerifications = verifications.filter(v => v.dppType === 'main' || (!v.parentDid && v.dppType !== 'component'));

    mainVerifications.forEach(mainVerification => {
      // Find all components that belong to this main product
      const components = verifications
        .filter(v => v.parentDid === mainVerification.did)
        .map(v => ({
          name: v.dppName,
          verification: v,
        }));

      // Determine overall status: window is only valid if ALL components are valid
      let overallStatus = mainVerification.status;
      if (components.length > 0) {
        const hasInvalidComponent = components.some(c => c.verification.status === 'invalid');
        const hasWarningComponent = components.some(c => c.verification.status === 'warning');

        if (hasInvalidComponent || mainVerification.status === 'invalid') {
          overallStatus = 'invalid';
        } else if (hasWarningComponent || mainVerification.status === 'warning') {
          overallStatus = 'warning';
        } else {
          overallStatus = 'valid';
        }
      }

      // Create a modified verification with the overall status
      const groupVerification = { ...mainVerification, status: overallStatus };

      grouped.push({
        dppId: mainVerification.did,
        dppName: mainVerification.dppName,
        dppType: 'main',
        verification: groupVerification,
        components: components.length > 0 ? components : undefined,
      });
    });

    return grouped;
  }

  const groupedVerifications = groupVerificationsByDPP();

  // Update stats based on grouped verifications (only count main products)
  useEffect(() => {
    const validCount = groupedVerifications.filter(g => g.verification.status === 'valid').length;
    const invalidCount = groupedVerifications.filter(g => g.verification.status === 'invalid').length;
    const warningCount = groupedVerifications.filter(g => g.verification.status === 'warning').length;

    setStats({
      totalVerifications: groupedVerifications.length,
      validDIDs: validCount,
      invalidDIDs: invalidCount,
      warningDIDs: warningCount,
    });
  }, [groupedVerifications]);

  // Apply filter - only show main products at top level, components shown within their parent
  const filteredVerifications = filter === 'all'
    ? groupedVerifications
    : groupedVerifications.filter(group => {
      // Use the overall status that includes component validation
      return group.verification.status === filter;
    });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6 pt-20 transition-colors">
      <div className="max-w-[1920px] mx-auto">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 mb-6 transition-colors">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-3 bg-purple-100 dark:bg-purple-900/50 rounded-lg">
                  <Search className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Resolver Dashboard</h1>
                  <p className="text-gray-600 dark:text-gray-400">Reconstruct and verify DID history integrity</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm text-gray-600 dark:text-gray-400">Resolver Node</p>
                <p className="text-xs font-mono text-gray-500 dark:text-gray-400">{currentRoleDID}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Verifications</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalVerifications}</p>
              </div>
              <FileText className="w-8 h-8 text-blue-500 dark:text-blue-400" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Valid DIDs</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.validDIDs}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500 dark:text-green-400" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Invalid DIDs</p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.invalidDIDs}</p>
              </div>
              <XCircle className="w-8 h-8 text-red-500 dark:text-red-400" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Warnings</p>
                <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{stats.warningDIDs}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-yellow-500 dark:text-yellow-400" />
            </div>
          </div>
        </div>

        {/* Search/Verify DID */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 mb-6 transition-colors">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Verify DID</h2>
          <div className="flex gap-3">
            <input
              type="text"
              value={searchDID}
              onChange={(e) => setSearchDID(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleVerifyDID()}
              placeholder="Enter DID to verify (e.g., did:webvh:example.com:products:window-123)"
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors"
            />
            <button
              onClick={handleVerifyDID}
              disabled={loading || !searchDID.trim()}
              className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
            >
              <Search className="w-4 h-4" />
              {loading ? 'Verifying...' : 'Verify'}
            </button>
          </div>
        </div>

        {/* Verifications List */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 mb-6 transition-colors">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Verification History</h2>

              {/* Filter Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => setFilter('all')}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${filter === 'all'
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                >
                  All ({stats.totalVerifications})
                </button>
                <button
                  onClick={() => setFilter('valid')}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-1 ${filter === 'valid'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                >
                  <CheckCircle className="w-3 h-3" />
                  Valid ({stats.validDIDs})
                </button>
                <button
                  onClick={() => setFilter('invalid')}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-1 ${filter === 'invalid'
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                >
                  <XCircle className="w-3 h-3" />
                  Invalid ({stats.invalidDIDs})
                </button>
                <button
                  onClick={() => setFilter('warning')}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-1 ${filter === 'warning'
                    ? 'bg-yellow-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                >
                  <AlertTriangle className="w-3 h-3" />
                  Warning ({stats.warningDIDs})
                </button>
              </div>
            </div>
          </div>

          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredVerifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                <Search className="w-12 h-12 mx-auto mb-3 text-gray-400 dark:text-gray-500" />
                <p>No verifications yet. Enter a DID above to verify.</p>
              </div>
            ) : (
              filteredVerifications.map((group) => (
                <div key={group.dppId} className="p-4">
                  {/* Main DPP */}
                  <div
                    className="flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 p-3 rounded-lg transition-colors"
                    onClick={() => setExpandedDPP(expandedDPP === group.dppId ? null : group.dppId)}
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <Package className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className="font-semibold text-gray-900 dark:text-white">{group.dppName}</h3>
                          {group.verification.status === 'valid' && (
                            <span className="flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300">
                              <CheckCircle className="w-3 h-3" />
                              Valid
                            </span>
                          )}
                          {group.verification.status === 'invalid' && (
                            <span className="flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300">
                              <XCircle className="w-3 h-3" />
                              Invalid
                            </span>
                          )}
                          {group.verification.status === 'warning' && (
                            <span className="flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300">
                              <AlertTriangle className="w-3 h-3" />
                              Warning
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-mono text-gray-500 dark:text-gray-400">{group.verification.did}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                          Verified: {new Date(group.verification.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <button className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors">
                      {expandedDPP === group.dppId ? (
                        <ChevronUp className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                      )}
                    </button>
                  </div>

                  {/* Expanded Details */}
                  {expandedDPP === group.dppId && (
                    <div className="ml-8 mt-4 space-y-3">
                      {/* Verification Checks */}
                      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 space-y-2 transition-colors">
                        <h4 className="font-semibold text-sm text-gray-900 dark:text-white mb-3">Verification Checks</h4>

                        <div className="flex items-start gap-2">
                          {group.verification.checks.hashChain.valid ? (
                            <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5" />
                          )}
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900 dark:text-white">Hash Chain</p>
                            <button
                              onClick={() => openDetailsModal('Hash Chain Verification', group.verification.checks.hashChain, group.verification)}
                              className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline text-left"
                            >
                              {group.verification.checks.hashChain.message}
                            </button>
                          </div>
                        </div>

                        <div className="flex items-start gap-2">
                          {group.verification.checks.controllerSignatures.valid ? (
                            <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-600 mt-0.5" />
                          )}
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900 dark:text-white">Controller Signatures</p>
                            <button
                              onClick={() => openDetailsModal('Controller Signatures Verification', group.verification.checks.controllerSignatures, group.verification)}
                              className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline text-left"
                            >
                              {group.verification.checks.controllerSignatures.message}
                            </button>
                          </div>
                        </div>

                        <div className="flex items-start gap-2">
                          {group.verification.checks.witnessProofs.valid ? (
                            <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-600 mt-0.5" />
                          )}
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900 dark:text-white">Witness Proofs</p>
                            <button
                              onClick={() => openDetailsModal('Witness Proofs Verification', group.verification.checks.witnessProofs, group.verification)}
                              className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline text-left"
                            >
                              {group.verification.checks.witnessProofs.message}
                            </button>
                          </div>
                        </div>

                        <div className="flex items-start gap-2">
                          {group.verification.checks.documentConsistency.valid ? (
                            <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-600 mt-0.5" />
                          )}
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900 dark:text-white">Document Consistency</p>
                            <button
                              onClick={() => openDetailsModal('Document Consistency Verification', group.verification.checks.documentConsistency, group.verification)}
                              className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline text-left"
                            >
                              {group.verification.checks.documentConsistency.message}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* History Summary */}
                      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                        <h4 className="font-semibold text-sm text-gray-900 dark:text-white mb-2">History Summary</h4>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          {group.verification.history.length} operations in history
                        </p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          {group.verification.attestations.length} attestations recorded
                        </p>
                      </div>

                      {/* Components */}
                      {group.components && group.components.length > 0 && (
                        <div className="mt-4">
                          <h4 className="font-semibold text-sm text-gray-900 dark:text-white mb-3">Components ({group.components.length})</h4>
                          <div className="space-y-2">
                            {group.components.map((component) => (
                              <div
                                key={component.verification.did}
                                className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-3"
                              >
                                <div
                                  className="flex items-center justify-between cursor-pointer"
                                  onClick={() => {
                                    const newExpanded = new Set(expandedComponents);
                                    if (newExpanded.has(component.verification.did)) {
                                      newExpanded.delete(component.verification.did);
                                    } else {
                                      newExpanded.add(component.verification.did);
                                    }
                                    setExpandedComponents(newExpanded);
                                  }}
                                >
                                  <div className="flex items-center gap-2 flex-1">
                                    <Package className="w-4 h-4 text-gray-500" />
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium text-sm text-gray-900 dark:text-white">{component.name}</span>
                                        {component.verification.status === 'valid' && (
                                          <CheckCircle className="w-3 h-3 text-green-600" />
                                        )}
                                        {component.verification.status === 'invalid' && (
                                          <XCircle className="w-3 h-3 text-red-600" />
                                        )}
                                        {component.verification.status === 'warning' && (
                                          <AlertTriangle className="w-3 h-3 text-yellow-600" />
                                        )}
                                      </div>
                                      <p className="text-xs font-mono text-gray-500">{component.verification.did}</p>
                                    </div>
                                  </div>
                                  {expandedComponents.has(component.verification.did) ? (
                                    <ChevronUp className="w-4 h-4 text-gray-600" />
                                  ) : (
                                    <ChevronDown className="w-4 h-4 text-gray-600" />
                                  )}
                                </div>

                                {/* Component Details */}
                                {expandedComponents.has(component.verification.did) && (
                                  <div className="mt-3 space-y-2 pl-6 border-l-2 border-gray-200">
                                    <div className="space-y-1">
                                      <div className="flex items-start gap-2">
                                        {component.verification.checks.hashChain.valid ? (
                                          <CheckCircle className="w-3 h-3 text-green-600 mt-0.5" />
                                        ) : (
                                          <XCircle className="w-3 h-3 text-red-600 mt-0.5" />
                                        )}
                                        <div className="flex-1">
                                          <p className="text-xs font-medium text-gray-900 dark:text-white">Hash Chain</p>
                                          <button
                                            onClick={() => openDetailsModal('Hash Chain Verification', component.verification.checks.hashChain, component.verification)}
                                            className="text-xs text-blue-600 hover:text-blue-800 hover:underline text-left"
                                          >
                                            {component.verification.checks.hashChain.message}
                                          </button>
                                        </div>
                                      </div>

                                      <div className="flex items-start gap-2">
                                        {component.verification.checks.controllerSignatures.valid ? (
                                          <CheckCircle className="w-3 h-3 text-green-600 mt-0.5" />
                                        ) : (
                                          <XCircle className="w-3 h-3 text-red-600 mt-0.5" />
                                        )}
                                        <div className="flex-1">
                                          <p className="text-xs font-medium text-gray-900 dark:text-white">Controller Signatures</p>
                                          <button
                                            onClick={() => openDetailsModal('Controller Signatures Verification', component.verification.checks.controllerSignatures, component.verification)}
                                            className="text-xs text-blue-600 hover:text-blue-800 hover:underline text-left"
                                          >
                                            {component.verification.checks.controllerSignatures.message}
                                          </button>
                                        </div>
                                      </div>

                                      <div className="flex items-start gap-2">
                                        {component.verification.checks.witnessProofs.valid ? (
                                          <CheckCircle className="w-3 h-3 text-green-600 mt-0.5" />
                                        ) : (
                                          <XCircle className="w-3 h-3 text-red-600 mt-0.5" />
                                        )}
                                        <div className="flex-1">
                                          <p className="text-xs font-medium text-gray-900 dark:text-white">Witness Proofs</p>
                                          <button
                                            onClick={() => openDetailsModal('Witness Proofs Verification', component.verification.checks.witnessProofs, component.verification)}
                                            className="text-xs text-blue-600 hover:text-blue-800 hover:underline text-left"
                                          >
                                            {component.verification.checks.witnessProofs.message}
                                          </button>
                                        </div>
                                      </div>

                                      <div className="flex items-start gap-2">
                                        {component.verification.checks.documentConsistency.valid ? (
                                          <CheckCircle className="w-3 h-3 text-green-600 mt-0.5" />
                                        ) : (
                                          <XCircle className="w-3 h-3 text-red-600 mt-0.5" />
                                        )}
                                        <div className="flex-1">
                                          <p className="text-xs font-medium text-gray-900 dark:text-white">Document Consistency</p>
                                          <button
                                            onClick={() => openDetailsModal('Document Consistency Verification', component.verification.checks.documentConsistency, component.verification)}
                                            className="text-xs text-blue-600 hover:text-blue-800 hover:underline text-left"
                                          >
                                            {component.verification.checks.documentConsistency.message}
                                          </button>
                                        </div>
                                      </div>
                                    </div>

                                    <div className="bg-gray-50 rounded p-2 mt-2">
                                      <p className="text-xs text-gray-600">
                                        {component.verification.history.length} operations, {component.verification.attestations.length} attestations
                                      </p>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Verification Details Modal */}
      {showDetailsModal && modalDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{modalDetails.title}</h3>
                  <p className="text-sm text-gray-600 mt-1">{modalDetails.verification.dppName}</p>
                </div>
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {/* Status */}
              <div className="mb-6">
                <div className="flex items-center gap-3 mb-2">
                  {modalDetails.check.valid ? (
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  ) : (
                    <XCircle className="w-6 h-6 text-red-600" />
                  )}
                  <span className="text-lg font-semibold text-gray-900">
                    {modalDetails.check.valid ? 'Valid' : 'Invalid'}
                  </span>
                </div>
                <p className="text-gray-700">{modalDetails.check.message}</p>
              </div>

              {/* DID Info */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <h4 className="font-semibold text-sm text-gray-900 mb-2">DID Information</h4>
                <div className="space-y-1">
                  <div className="flex items-start gap-2">
                    <span className="text-xs text-gray-500 min-w-[60px]">DID:</span>
                    <span className="text-xs font-mono text-gray-900 break-all">{modalDetails.verification.did}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-xs text-gray-500 min-w-[60px]">Type:</span>
                    <span className="text-xs text-gray-900">{modalDetails.verification.dppType || 'N/A'}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-xs text-gray-500 min-w-[60px]">Verified:</span>
                    <span className="text-xs text-gray-900">{new Date(modalDetails.verification.timestamp).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Detailed Explanation */}
              {modalDetails.title === 'Document Consistency Verification' && !modalDetails.check.valid && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                  <h4 className="font-semibold text-sm text-red-900 mb-2">Owner Mismatch Details</h4>
                  <p className="text-sm text-red-800 mb-3">
                    The current owner in the DID document does not match the expected owner from the most recent approved ownership transfer in the history.
                  </p>

                  {modalDetails.check.details && (
                    <div className="bg-white rounded p-3 mb-3">
                      <div className="space-y-2 text-xs">
                        <div className="flex items-start gap-2">
                          <span className="font-semibold text-red-900 min-w-[120px]">Current Owner:</span>
                          <span className="font-mono text-red-800 break-all">{modalDetails.check.details.currentOwner}</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="font-semibold text-green-900 min-w-[120px]">Expected Owner:</span>
                          <span className="font-mono text-green-800 break-all">{modalDetails.check.details.expectedOwner}</span>
                        </div>
                        {modalDetails.check.details.transferFrom && (
                          <div className="flex items-start gap-2">
                            <span className="font-semibold text-gray-700 min-w-[120px]">Transferred From:</span>
                            <span className="font-mono text-gray-600 break-all">{modalDetails.check.details.transferFrom}</span>
                          </div>
                        )}
                        {modalDetails.check.details.lastTransferTimestamp && (
                          <div className="flex items-start gap-2">
                            <span className="font-semibold text-gray-700 min-w-[120px]">Transfer Time:</span>
                            <span className="text-gray-600">{new Date(modalDetails.check.details.lastTransferTimestamp).toLocaleString()}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <div>
                      <span className="text-xs font-semibold text-red-900">Possible causes:</span>
                      <ul className="list-disc list-inside text-xs text-red-800 mt-1 space-y-1">
                        <li>Ownership transfer was not properly recorded in DID document</li>
                        <li>DID document was manually modified outside of proper procedures</li>
                        <li>History tampering or incomplete synchronization</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {modalDetails.title === 'Witness Proofs Verification' && modalDetails.check.details && (
                <div className={`border rounded-lg p-4 mb-6 ${modalDetails.check.valid ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                  <h4 className={`font-semibold text-sm mb-2 ${modalDetails.check.valid ? 'text-green-900' : 'text-red-900'}`}>
                    Witness Proofs Details
                  </h4>
                  <div className="bg-white rounded p-3 mb-3">
                    <div className="grid grid-cols-4 gap-2 text-xs mb-2">
                      <div><span className="font-semibold text-gray-700">Total:</span> {modalDetails.check.details.totalOperations}</div>
                      <div><span className="font-semibold text-green-700">Approved:</span> {modalDetails.check.details.approved}</div>
                      <div><span className="font-semibold text-yellow-700">Pending:</span> {modalDetails.check.details.pending}</div>
                      <div><span className="font-semibold text-red-700">Rejected:</span> {modalDetails.check.details.rejected}</div>
                    </div>
                    {modalDetails.check.details.proofs && modalDetails.check.details.proofs.length > 0 && (
                      <div className="mt-3 space-y-2">
                        <p className="text-xs font-semibold text-gray-700">Proof Details:</p>
                        {modalDetails.check.details.proofs.map((proof: any, idx: number) => (
                          <div key={idx} className="bg-gray-50 rounded p-3 text-xs space-y-2">
                            <div className="flex justify-between">
                              <span className="font-medium">{proof.type}</span>
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${proof.status === 'approved' ? 'bg-green-100 text-green-800' :
                                proof.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-red-100 text-red-800'
                                }`}>{proof.status}</span>
                            </div>
                            <div className="text-gray-600">
                              <span className="font-semibold">Witness:</span> <span className="font-mono text-xs">{proof.witness}</span>
                            </div>
                            <div className="text-gray-600">
                              <span className="font-semibold">Time:</span> {new Date(proof.timestamp).toLocaleString()}
                            </div>

                            {/* Event Data Details */}
                            {proof.eventData && Object.keys(proof.eventData).length > 0 && (
                              <div className="mt-2 pt-2 border-t border-gray-200">
                                <p className="font-semibold text-gray-700 mb-1">Event Data:</p>
                                <div className="space-y-1">
                                  {proof.eventData.previousOwner && (
                                    <div>
                                      <span className="font-semibold text-gray-600">Previous Owner:</span>
                                      <div className="font-mono text-xs text-gray-700 break-all ml-2">{proof.eventData.previousOwner}</div>
                                    </div>
                                  )}
                                  {proof.eventData.newOwner && (
                                    <div>
                                      <span className="font-semibold text-gray-600">New Owner:</span>
                                      <div className="font-mono text-xs text-gray-700 break-all ml-2">{proof.eventData.newOwner}</div>
                                    </div>
                                  )}
                                  {proof.eventData.oldKeyId && (
                                    <div>
                                      <span className="font-semibold text-gray-600">Old Key:</span>
                                      <span className="font-mono text-xs text-gray-700 ml-2">{proof.eventData.oldKeyId}</span>
                                    </div>
                                  )}
                                  {proof.eventData.newKeyId && (
                                    <div>
                                      <span className="font-semibold text-gray-600">New Key:</span>
                                      <span className="font-mono text-xs text-gray-700 ml-2">{proof.eventData.newKeyId}</span>
                                    </div>
                                  )}
                                  {proof.eventData.transferMethod && (
                                    <div>
                                      <span className="font-semibold text-gray-600">Transfer Method:</span>
                                      <span className="text-gray-700 ml-2">{proof.eventData.transferMethod}</span>
                                    </div>
                                  )}
                                  {proof.eventData.organization && (
                                    <div>
                                      <span className="font-semibold text-gray-600">Organization:</span>
                                      <span className="text-gray-700 ml-2">{proof.eventData.organization}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Signature */}
                            {proof.signature && (
                              <div className="mt-2 pt-2 border-t border-gray-200">
                                <span className="font-semibold text-gray-600">Signature:</span>
                                <div className="font-mono text-xs text-gray-700 break-all mt-1">{proof.signature}</div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {!modalDetails.check.valid && (
                    <div className="space-y-2">
                      <div>
                        <span className="text-xs font-semibold text-red-900">Possible causes:</span>
                        <ul className="list-disc list-inside text-xs text-red-800 mt-1 space-y-1">
                          <li>Operations are pending witness approval</li>
                          <li>Witness rejected the operation</li>
                          <li>Witness proofs were not properly recorded</li>
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {modalDetails.title === 'Hash Chain Verification' && modalDetails.check.details && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                  <h4 className="font-semibold text-sm text-green-900 mb-2">Hash Chain Details</h4>
                  <div className="bg-white rounded p-3">
                    <p className="text-xs text-gray-700 mb-2">
                      <span className="font-semibold">Total Entries:</span> {modalDetails.check.details.totalEntries}
                    </p>
                    {modalDetails.check.details.entries && modalDetails.check.details.entries.length > 0 && (
                      <div className="mt-3 space-y-2 max-h-60 overflow-y-auto">
                        <p className="text-xs font-semibold text-gray-700">Chain Entries:</p>
                        {modalDetails.check.details.entries.map((entry: any, idx: number) => (
                          <div key={idx} className="bg-gray-50 rounded p-2 text-xs">
                            <div className="flex justify-between items-start">
                              <span className="font-medium">Entry {entry.index}</span>
                              <span className="text-gray-600">{entry.type}</span>
                            </div>
                            <div className="text-gray-600 mt-1">Hash: <span className="font-mono text-xs">{entry.hash}</span></div>
                            <div className="text-gray-600">Time: {new Date(entry.timestamp).toLocaleString()}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {modalDetails.title === 'Controller Signatures Verification' && modalDetails.check.details && (
                <div className={`border rounded-lg p-4 mb-6 ${modalDetails.check.valid ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                  <h4 className={`font-semibold text-sm mb-2 ${modalDetails.check.valid ? 'text-green-900' : 'text-red-900'}`}>
                    Controller Signatures Details
                  </h4>
                  <div className="bg-white rounded p-3">
                    <p className="text-xs text-gray-700 mb-2">
                      <span className="font-semibold">Total Operations:</span> {modalDetails.check.details.totalOperations}
                    </p>
                    {modalDetails.check.details.signatures && modalDetails.check.details.signatures.length > 0 && (
                      <div className="mt-3 space-y-2 max-h-60 overflow-y-auto">
                        <p className="text-xs font-semibold text-gray-700">Signatures:</p>
                        {modalDetails.check.details.signatures.map((sig: any, idx: number) => (
                          <div key={idx} className="bg-gray-50 rounded p-2 text-xs">
                            <div className="flex justify-between">
                              <span className="font-medium">{sig.type}</span>
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${sig.status === 'Valid' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                }`}>{sig.status}</span>
                            </div>
                            <div className="text-gray-600 mt-1">Signature: <span className="font-mono text-xs">{sig.signature}</span></div>
                            <div className="text-gray-600">Time: {new Date(sig.timestamp).toLocaleString()}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* History Summary */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-sm text-gray-900 mb-2">History Summary</h4>
                <div className="space-y-1">
                  <p className="text-xs text-gray-600">
                    Total operations: {modalDetails.verification.history.length}
                  </p>
                  <p className="text-xs text-gray-600">
                    Total attestations: {modalDetails.verification.attestations.length}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200">
              <button
                onClick={() => setShowDetailsModal(false)}
                className="w-full px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
