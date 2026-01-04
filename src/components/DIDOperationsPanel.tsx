import { useState, useEffect } from 'react';
import { useRole, roleDIDs, type UserRole } from '../lib/utils/roleContext';
import { transferOwnership, rotateKey, getDIDOperationsHistory, getPendingAndRejectedOperations } from '../lib/operations/didOperationsLocal';
import type { DPP, WitnessAttestation } from '../lib/data/localData';
import { Key, ArrowRightLeft, ChevronDown, ChevronUp, Clock, XCircle, CheckCircle } from 'lucide-react';

interface DIDOperationsPanelProps {
  dpp: DPP;
  onUpdate: () => void;
}

export default function DIDOperationsPanel({ dpp, onUpdate }: DIDOperationsPanelProps) {
  const { currentRoleDID } = useRole();
  const [history, setHistory] = useState<WitnessAttestation[]>([]);

  // Load pending/approved/rejected from localStorage on mount
  const [currentPendingOp, setCurrentPendingOp] = useState<{ type: string; details: any } | null>(() => {
    const stored = localStorage.getItem(`pending_op_${dpp.did}`);
    return stored ? JSON.parse(stored) : null;
  });
  const [currentApprovedOp, setCurrentApprovedOp] = useState<{ type: string; details: any } | null>(() => {
    const stored = localStorage.getItem(`approved_op_${dpp.did}`);
    return stored ? JSON.parse(stored) : null;
  });
  const [currentRejectedOp, setCurrentRejectedOp] = useState<{ type: string; details: any } | null>(() => {
    const stored = localStorage.getItem(`rejected_op_${dpp.did}`);
    return stored ? JSON.parse(stored) : null;
  });

  const [loading, setLoading] = useState(true);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [newOwnerDID, setNewOwnerDID] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());

  // Check if current user is the owner
  const isOwner = currentRoleDID === dpp.owner;

  // Save to localStorage whenever state changes
  useEffect(() => {
    if (currentPendingOp) {
      localStorage.setItem(`pending_op_${dpp.did}`, JSON.stringify(currentPendingOp));
    } else {
      localStorage.removeItem(`pending_op_${dpp.did}`);
    }
  }, [currentPendingOp, dpp.did]);

  useEffect(() => {
    if (currentApprovedOp) {
      localStorage.setItem(`approved_op_${dpp.did}`, JSON.stringify(currentApprovedOp));;
    } else {
      localStorage.removeItem(`approved_op_${dpp.did}`);
    }
  }, [currentApprovedOp, dpp.did]);

  useEffect(() => {
    if (currentRejectedOp) {
      localStorage.setItem(`rejected_op_${dpp.did}`, JSON.stringify(currentRejectedOp));
    } else {
      localStorage.removeItem(`rejected_op_${dpp.did}`);
    }
  }, [currentRejectedOp, dpp.did]);

  // Load DID operations history
  useEffect(() => {
    const loadHistory = async () => {
      const result = await getDIDOperationsHistory(dpp.id);
      if (result.success) {
        setHistory(result.operations);
      }
      setLoading(false);
    };
    
    loadHistory();
    
    // Auto-refresh history every 10 seconds to catch anchoring updates
    const interval = setInterval(loadHistory, 10000);
    return () => clearInterval(interval);
  }, [dpp.id]);

  // Poll for status changes on current pending operation
  useEffect(() => {
    if (!currentPendingOp) return;

    const interval = setInterval(async () => {
      const statusResult = await getPendingAndRejectedOperations(dpp.did);

      console.log('🔍 Polling status:', {
        dppDid: dpp.did,
        currentPendingType: currentPendingOp.type,
        rejectedCount: statusResult.rejected.length,
        rejectedItems: statusResult.rejected.map((r: any) => ({
          type: r.attestation_type,
          approval_status: r.approval_status,
          id: r.id
        })),
        pendingCount: statusResult.pending.length
      });

      // Check if operation was rejected
      if (statusResult.rejected.length > 0) {
        // Check for matching type (ownership_change or key_rotation)
        const rejectedOp = statusResult.rejected.find((op: any) => {
          const attestationType = op.attestation_type;
          const matches = attestationType === currentPendingOp.type;
          console.log('🔎 Checking rejection match:', {
            attestationType,
            currentPendingType: currentPendingOp.type,
            matches
          });
          return matches;
        });

        if (rejectedOp) {
          console.log('✅ Operation rejected, switching to red');
          // Immediately update localStorage before triggering state updates
          localStorage.removeItem(`pending_op_${dpp.did}`);
          localStorage.setItem(`rejected_op_${dpp.did}`, JSON.stringify(currentPendingOp));

          setCurrentPendingOp(null);
          setCurrentRejectedOp(currentPendingOp);
          onUpdate();
          return;
        } else {
          console.log('❌ No matching rejected operation found');
        }
      }

      // Check if operation was approved (no longer in pending, not in rejected)
      if (statusResult.pending.length === 0 && statusResult.rejected.length === 0) {
        // Reload history to check if it was added
        const historyResult = await getDIDOperationsHistory(dpp.id);
        if (historyResult.success) {
          const wasApproved = historyResult.operations.some((op: any) => {
            const attestationType = op.attestation_type;
            return (attestationType === currentPendingOp.type ||
              (attestationType === 'ownership_change' && currentPendingOp.type === 'ownership_change') ||
              (attestationType === 'key_rotation' && currentPendingOp.type === 'key_rotation')) &&
              op.approval_status === 'approved';
          });

          if (wasApproved) {
            console.log('Operation approved, switching to green');
            // Immediately update localStorage before triggering state updates
            localStorage.removeItem(`pending_op_${dpp.did}`);
            localStorage.setItem(`approved_op_${dpp.did}`, JSON.stringify(currentPendingOp));

            setCurrentPendingOp(null);
            setCurrentApprovedOp(currentPendingOp);
            setHistory(historyResult.operations);
            onUpdate();
          }
        }
      }
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(interval);
  }, [currentPendingOp, dpp.id, onUpdate]);

  const handleTransferOwnership = async () => {
    if (!newOwnerDID.trim()) {
      setMessage({ type: 'error', text: 'Please enter a valid DID' });
      return;
    }

    const result = await transferOwnership(dpp.id, currentRoleDID, newOwnerDID);
    if (result.success) {
      setMessage(null);
      setNewOwnerDID('');
      setShowTransferModal(false);

      // Clear any existing notifications
      localStorage.removeItem(`pending_op_${dpp.did}`);
      localStorage.removeItem(`approved_op_${dpp.did}`);
      localStorage.removeItem(`rejected_op_${dpp.did}`);
      setCurrentPendingOp(null);
      setCurrentApprovedOp(null);
      setCurrentRejectedOp(null);

      const opDetails = {
        type: 'ownership_change',
        details: {
          from: currentRoleDID,
          to: newOwnerDID,
          timestamp: new Date().toISOString()
        }
      };

      // Check if backend processed it (message contains 'via backend')
      if (result.message.includes('via backend')) {
        // Backend success = immediately approved (green)
        localStorage.setItem(`approved_op_${dpp.did}`, JSON.stringify(opDetails));
        setCurrentApprovedOp(opDetails);
        setMessage({ type: 'success', text: '✅ Ownership transferred and anchored to blockchain!' });
      } else {
        // Fallback mode = pending (orange)
        localStorage.setItem(`pending_op_${dpp.did}`, JSON.stringify(opDetails));
        setCurrentPendingOp(opDetails);
      }

      // Refresh history
      const historyResult = await getDIDOperationsHistory(dpp.id);
      if (historyResult.success) {
        setHistory(historyResult.operations);
      }
      onUpdate();
    } else {
      setMessage({ type: 'error', text: result.message });
    }
  };

  const handleRotateKey = async () => {
    if (!confirm('Are you sure you want to rotate the cryptographic key? This will invalidate the previous key.')) {
      return;
    }

    const result = await rotateKey(dpp.id, currentRoleDID);
    if (result.success) {
      setMessage(null);

      // Clear any existing notifications
      localStorage.removeItem(`pending_op_${dpp.did}`);
      localStorage.removeItem(`approved_op_${dpp.did}`);
      localStorage.removeItem(`rejected_op_${dpp.did}`);
      setCurrentPendingOp(null);
      setCurrentApprovedOp(null);
      setCurrentRejectedOp(null);

      const opDetails = {
        type: 'key_rotation',
        details: {
          owner: currentRoleDID,
          timestamp: new Date().toISOString()
        }
      };

      // Check if backend processed it (message contains 'via backend')
      if (result.message.includes('via backend')) {
        // Backend success = immediately approved (green)
        localStorage.setItem(`approved_op_${dpp.did}`, JSON.stringify(opDetails));
        setCurrentApprovedOp(opDetails);
        setMessage({ type: 'success', text: '✅ Key rotated and anchored to blockchain!' });
      } else {
        // Fallback mode = pending (orange)
        localStorage.setItem(`pending_op_${dpp.did}`, JSON.stringify(opDetails));
        setCurrentPendingOp(opDetails);
      }

      // Refresh history
      const historyResult = await getDIDOperationsHistory(dpp.id);
      if (historyResult.success) {
        setHistory(historyResult.operations);
      }
      onUpdate();
    } else {
      setMessage({ type: 'error', text: result.message });
    }
  };

  const toggleExpanded = (index: number) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedItems(newExpanded);
  };

  const formatAttestation = (attestation: WitnessAttestation) => {
    const typeLabels: Record<string, string> = {
      did_creation: 'DID Creation',
      create: 'DID Creation',
      key_rotation: 'Key Rotation',
      ownership_change: 'Ownership Transferred',
      ownership_transfer: 'Ownership Transferred',
      did_update: 'DID Update',
    };

    return {
      label: typeLabels[attestation.attestation_type] || attestation.attestation_type,
      icon: (attestation.attestation_type === 'did_creation' || attestation.attestation_type === 'create') ? '🆕' :
        attestation.attestation_type === 'key_rotation' ? '🔑' :
          (attestation.attestation_type === 'ownership_change' || attestation.attestation_type === 'ownership_transfer') ? '👤' : '📝',
    };
  };

  const getKeyFields = (attestation: WitnessAttestation) => {
    const data = attestation.attestation_data as any;
    const fields: { label: string; value: string }[] = [];

    if (attestation.attestation_type === 'ownership_change') {
      if (data.newOwner) fields.push({ label: 'New Owner', value: data.newOwner });
      if (data.previousOwner) fields.push({ label: 'Previous Owner', value: data.previousOwner });
    } else if (attestation.attestation_type === 'key_rotation') {
      if (data.newKeyId) fields.push({ label: 'New Key', value: data.newKeyId });
      if (data.oldKeyId) fields.push({ label: 'Old Key', value: data.oldKeyId });
      if (data.rotationReason) fields.push({ label: 'Reason', value: data.rotationReason });
    } else if (attestation.attestation_type === 'did_update') {
      if (data.updateType) fields.push({ label: 'Update Type', value: data.updateType });
      if (data.updatedFields) fields.push({ label: 'Fields', value: data.updatedFields.join(', ') });
    } else if (attestation.attestation_type === 'did_creation') {
      if (data.controller) fields.push({ label: 'Controller', value: data.controller });
      if (data.initialOwner) fields.push({ label: 'Initial Owner', value: data.initialOwner });
    }

    if (data.witness) fields.push({ label: 'Witness', value: data.witness });
    if (data.organization) fields.push({ label: 'Organization', value: data.organization });

    return fields;
  };

  return (
    <div className="space-y-6">
      {/* DID Information Card */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6 transition-colors">
        <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4">DID Information</h2>
        <div className="space-y-3">
          <div>
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">DID:</span>
            <p className="text-sm font-mono bg-gray-50 dark:bg-gray-700 px-3 py-2 rounded mt-1 break-all text-gray-900 dark:text-white">
              {dpp.did}
            </p>
          </div>
          <div>
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Current Owner:</span>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-sm font-mono bg-gray-50 dark:bg-gray-700 px-3 py-2 rounded flex-1 break-all text-gray-900 dark:text-white">
                {dpp.owner}
              </p>
              {isOwner && (
                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full font-semibold whitespace-nowrap">
                  You
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons - Only visible to owner */}
        {isOwner && (
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Owner Actions</h3>
            <div className="flex gap-3">
              <button
                onClick={handleRotateKey}
                className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors font-medium"
              >
                <Key size={18} />
                Rotate Key
              </button>
              <button
                onClick={() => setShowTransferModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
              >
                <ArrowRightLeft size={18} />
                Transfer Ownership
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Message Display */}
      {message && (
        <div className={`p-3 rounded ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          {message.text}
        </div>
      )}

      {/* Single Operation Status Notifications */}
      <div className="space-y-4">
        {/* Green - Approved Operation */}
        {currentApprovedOp && (
          <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-green-900 mb-1">
                      Operation Approved by Witness
                    </h3>
                    <p className="text-sm text-green-700 mb-2">
                      {currentApprovedOp.type === 'ownership_change'
                        ? `Ownership successfully transferred to: ${currentApprovedOp.details.to}`
                        : 'Key rotation completed successfully'}
                    </p>
                    <p className="text-xs text-gray-600">
                      Added to DID Operations History
                    </p>
                  </div>
                  <button
                    onClick={() => setCurrentApprovedOp(null)}
                    className="p-1 text-green-400 hover:text-green-600 hover:bg-green-100 rounded transition-opacity"
                    title="Dismiss"
                  >
                    <XCircle size={20} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Red - Rejected Operation */}
        {currentRejectedOp && (
          <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <XCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-red-900 mb-1">
                      Operation Rejected by Witness
                    </h3>
                    <p className="text-sm text-red-700 mb-2">
                      {currentRejectedOp.type === 'ownership_change'
                        ? `Ownership transfer to ${currentRejectedOp.details.to} was denied`
                        : 'Key rotation request was denied'}
                    </p>
                    <p className="text-xs text-gray-600">
                      Not added to DID Operations History
                    </p>
                  </div>
                  <button
                    onClick={() => setCurrentRejectedOp(null)}
                    className="p-1 text-red-400 hover:text-red-600 hover:bg-red-100 rounded transition-opacity"
                    title="Dismiss"
                  >
                    <XCircle size={20} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Orange - Pending Operation */}
        {currentPendingOp && (
          <div className="bg-orange-50 border-2 border-orange-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Clock className="w-6 h-6 text-orange-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-lg font-bold text-orange-900 mb-1">
                  Operation Pending Witness Approval
                </h3>
                <p className="text-sm text-orange-700 mb-2">
                  {currentPendingOp.type === 'ownership_change'
                    ? `Awaiting witness approval for ownership transfer to: ${currentPendingOp.details.to}`
                    : 'Awaiting witness approval for key rotation'}
                </p>
                <p className="text-xs text-gray-600">
                  Submitted: {new Date(currentPendingOp.details.timestamp).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => {
                  localStorage.removeItem(`pending_op_${dpp.did}`);
                  setCurrentPendingOp(null);
                }}
                className="text-orange-600 hover:text-orange-800 p-1 rounded hover:bg-orange-100"
                title="Dismiss notification"
              >
                <XCircle size={20} />
              </button>
            </div>
          </div>
        )}
      </div>
      {/* DID Operations History */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden transition-colors">
        <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white">DID Operations History</h2>
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <Clock size={14} />
            <span>Last updated: {new Date().toLocaleTimeString()}</span>
          </div>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
              <p className="text-gray-600 dark:text-gray-400">Loading history...</p>
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-dashed border-gray-300 dark:border-gray-700">
              <Clock size={40} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
              <p className="text-gray-600 dark:text-gray-400">No DID operations recorded yet</p>
            </div>
          ) : (
            <div className="relative">
              {/* Vertical Line */}
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700 z-0"></div>

              <div className="space-y-8 relative z-10">
                {history.map((attestation, index) => {
                  const formatted = formatAttestation(attestation);
                  const keyFields = getKeyFields(attestation);
                  const isExpanded = expandedItems.has(index);
                  const isAnchored = attestation.witness_status === 'anchored';

                  return (
                    <div key={index} className="flex gap-6">
                      {/* Timeline Icon */}
                      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center z-10 shadow-sm ${
                        formatted.label.toLowerCase().includes('create') ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' :
                        formatted.label.toLowerCase().includes('transfer') || formatted.label.toLowerCase().includes('ownership') ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' :
                        'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400'
                      }`}>
                        {formatted.icon === '🆕' ? <CheckCircle size={18} /> : 
                         formatted.icon === '🔑' ? <Key size={18} /> : 
                         formatted.icon === '🔄' ? <ArrowRightLeft size={18} /> : 
                         <Clock size={18} />}
                      </div>

                      {/* Content Card */}
                      <div className="flex-1 bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-5 hover:shadow-md transition-all group">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-gray-900 dark:text-white text-lg">{formatted.label}</h4>
                              {isAnchored ? (
                                <span className="px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 text-[10px] font-bold uppercase tracking-wider rounded-full flex items-center gap-1">
                                  <CheckCircle size={10} /> Anchored
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 text-[10px] font-bold uppercase tracking-wider rounded-full flex items-center gap-1">
                                  <Clock size={10} /> Pending
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              {new Date(attestation.timestamp).toLocaleString(undefined, { 
                                dateStyle: 'medium', 
                                timeStyle: 'short' 
                              })}
                            </p>
                          </div>
                          
                          <div className="text-right">
                            <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase font-semibold tracking-widest">Witness Node</p>
                            <p className="text-xs font-mono text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 px-2 py-1 rounded mt-1">
                              {attestation.witness_did.substring(0, 15)}...{attestation.witness_did.substring(attestation.witness_did.length - 4)}
                            </p>
                          </div>
                        </div>

                        {/* Key Fields Grid */}
                        {keyFields.length > 0 && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 bg-gray-50 dark:bg-gray-900/30 p-4 rounded-lg border border-gray-100 dark:border-gray-800">
                            {keyFields.map((field, idx) => (
                              <div key={idx} className="space-y-1">
                                <span className="text-[10px] uppercase font-bold text-gray-400 dark:text-gray-500 tracking-wider">{field.label}</span>
                                <p className="text-xs font-mono text-gray-800 dark:text-gray-200 break-all leading-relaxed">
                                  {field.value}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Toggle for full JSON */}
                        {attestation.attestation_data && Object.keys(attestation.attestation_data).length > 0 && (
                          <div className="mt-2">
                            <button
                              onClick={() => toggleExpanded(index)}
                              className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
                            >
                              {isExpanded ? (
                                <>
                                  <ChevronUp size={14} />
                                  Hide Technical Details
                                </>
                              ) : (
                                <>
                                  <ChevronDown size={14} />
                                  View Technical Details
                                </>
                              )}
                            </button>
                            
                            {isExpanded && (
                              <div className="mt-3 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                                <div className="bg-gray-100 dark:bg-gray-800 px-3 py-1.5 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Raw Attestation Data</span>
                                  <span className="text-[10px] text-gray-400 font-mono">JSON</span>
                                </div>
                                <pre className="text-[11px] text-gray-700 dark:text-gray-300 p-4 bg-gray-50 dark:bg-gray-900/80 whitespace-pre-wrap break-all overflow-x-auto font-mono leading-relaxed">
                                  {JSON.stringify(attestation.attestation_data, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Transfer Ownership Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">Transfer Ownership</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Select the new owner role. They will have full control over this DPP's DID document.
            </p>

            {/* Role Dropdown */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Select New Owner Role
              </label>
              <select
                value={newOwnerDID}
                onChange={(e) => setNewOwnerDID(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">-- Select a role --</option>
                {(Object.keys(roleDIDs) as UserRole[])
                  .filter(role => roleDIDs[role] !== currentRoleDID) // Exclude current owner
                  .map(role => (
                    <option key={role} value={roleDIDs[role]}>
                      {role}
                    </option>
                  ))
                }
              </select>
            </div>

            {/* Show selected DID */}
            {newOwnerDID && (
              <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-md">
                <span className="text-xs font-medium text-blue-700 dark:text-blue-300">New Owner DID:</span>
                <p className="text-xs font-mono text-blue-600 dark:text-blue-400 break-all mt-1">
                  {newOwnerDID}
                </p>
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowTransferModal(false);
                  setNewOwnerDID('');
                }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleTransferOwnership}
                disabled={!newOwnerDID}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Transfer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// Helper Functions
// ============================================

function formatAttestation(attestation: WitnessAttestation) {
  const type = attestation.attestation_type.toLowerCase();
  
  if (type === 'create' || type === 'did_creation') {
    return { label: 'Product Identity Registered', icon: '🆕' };
  }
  if (type === 'key_rotation' || type === 'rotate_key') {
    return { label: 'Security Key Rotated', icon: '🔑' };
  }
  if (type === 'ownership_transfer' || type === 'ownership_change' || type === 'transfer_ownership') {
    return { label: 'Ownership Transferred', icon: '🔄' };
  }
  if (type === 'did_update' || type === 'update') {
    return { label: 'Identity Document Updated', icon: '📝' };
  }
  
  // Fallback: capitalize and replace underscores
  const label = attestation.attestation_type
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
    
  return { label, icon: '📝' };
}

function getKeyFields(attestation: WitnessAttestation): { label: string; value: string }[] {
  const data = attestation.attestation_data;
  if (!data) return [];

  const fields: { label: string; value: string }[] = [];

  if (data.controller) fields.push({ label: 'Controller', value: data.controller });
  if (data.newOwner) fields.push({ label: 'New Owner', value: data.newOwner });
  if (data.to) fields.push({ label: 'To', value: data.to });
  if (data.newPublicKey) fields.push({ label: 'New Public Key', value: data.newPublicKey });
  if (data.versionId) fields.push({ label: 'Version', value: String(data.versionId) });

  return fields;
}
