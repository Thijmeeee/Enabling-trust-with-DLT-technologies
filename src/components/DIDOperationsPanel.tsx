import { useState, useEffect } from 'react';
import { useRole } from '../lib/utils/roleContext';
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
      setLoading(true);
      const result = await getDIDOperationsHistory(dpp.id);
      if (result.success) {
        setHistory(result.operations);
      }
      setLoading(false);
    };
    loadHistory();
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
      // Remove success message - only show pending notification
      setMessage(null);
      setNewOwnerDID('');
      setShowTransferModal(false);

      // Clear any existing approved/rejected notifications from both state and localStorage
      localStorage.removeItem(`approved_op_${dpp.did}`);
      localStorage.removeItem(`rejected_op_${dpp.did}`);
      setCurrentApprovedOp(null);
      setCurrentRejectedOp(null);

      // Show orange pending notification
      const pendingOp = {
        type: 'ownership_change',
        details: {
          from: currentRoleDID,
          to: newOwnerDID,
          timestamp: new Date().toISOString()
        }
      };
      localStorage.setItem(`pending_op_${dpp.did}`, JSON.stringify(pendingOp));
      setCurrentPendingOp(pendingOp);
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
      // Remove success message - only show pending notification
      setMessage(null);

      // Clear any existing approved/rejected notifications from both state and localStorage
      localStorage.removeItem(`approved_op_${dpp.did}`);
      localStorage.removeItem(`rejected_op_${dpp.did}`);
      setCurrentApprovedOp(null);
      setCurrentRejectedOp(null);

      // Show orange pending notification
      const pendingOp = {
        type: 'key_rotation',
        details: {
          owner: currentRoleDID,
          timestamp: new Date().toISOString()
        }
      };
      localStorage.setItem(`pending_op_${dpp.did}`, JSON.stringify(pendingOp));
      setCurrentPendingOp(pendingOp);
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
      key_rotation: 'Key Rotation',
      ownership_change: 'Ownership Transfer',
      did_update: 'DID Update',
    };

    return {
      label: typeLabels[attestation.attestation_type] || attestation.attestation_type,
      icon: attestation.attestation_type === 'did_creation' ? '🆕' :
        attestation.attestation_type === 'key_rotation' ? '🔑' :
          attestation.attestation_type === 'ownership_change' ? '👤' : '📝',
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
            </div>
          </div>
        )}
      </div>
      {/* DID Operations History */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6 transition-colors">
        <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4">DID Operations History</h2>
        {loading ? (
          <p className="text-gray-600 dark:text-gray-400 text-center py-8">Loading...</p>
        ) : history.length === 0 ? (
          <p className="text-gray-600 dark:text-gray-400 text-center py-8">No DID operations yet</p>
        ) : (
          <div className="space-y-3">
            {history.map((attestation, index) => {
              const formatted = formatAttestation(attestation);
              const keyFields = getKeyFields(attestation);
              const isExpanded = expandedItems.has(index);

              return (
                <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <span className="text-2xl">{formatted.icon}</span>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-gray-800 dark:text-white">{formatted.label}</h4>

                        {/* Key Fields */}
                        {keyFields.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {keyFields.map((field, idx) => (
                              <div key={idx} className="text-sm">
                                <span className="text-gray-600 dark:text-gray-400 font-medium">{field.label}:</span>{' '}
                                <span className="text-gray-800 dark:text-gray-200 font-mono text-xs break-all">
                                  {field.value.length > 60 ? `${field.value.substring(0, 60)}...` : field.value}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 break-all">
                          Witness: <span className="font-mono">{attestation.witness_did}</span>
                        </p>

                        {/* Toggle for full JSON */}
                        {attestation.attestation_data && Object.keys(attestation.attestation_data).length > 0 && (
                          <div className="mt-3">
                            <button
                              onClick={() => toggleExpanded(index)}
                              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
                            >
                              {isExpanded ? (
                                <>
                                  <ChevronUp size={14} />
                                  Hide full data
                                </>
                              ) : (
                                <>
                                  <ChevronDown size={14} />
                                  Show full data
                                </>
                              )}
                            </button>
                            {isExpanded && (
                              <div className="text-xs text-gray-700 dark:text-gray-300 mt-2 bg-gray-50 dark:bg-gray-700 p-3 rounded border border-gray-200 dark:border-gray-600">
                                <pre className="whitespace-pre-wrap break-all overflow-x-auto">
                                  {JSON.stringify(attestation.attestation_data, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap ml-4">
                      {new Date(attestation.timestamp).toLocaleString()}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Transfer Ownership Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Transfer Ownership</h3>
            <p className="text-sm text-gray-600 mb-4">
              Enter the DID of the new owner. They will have full control over this DPP's DID document.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                New Owner DID
              </label>
              <input
                type="text"
                value={newOwnerDID}
                onChange={(e) => setNewOwnerDID(e.target.value)}
                placeholder="did:webvh:example.com:..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowTransferModal(false);
                  setNewOwnerDID('');
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleTransferOwnership}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
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
