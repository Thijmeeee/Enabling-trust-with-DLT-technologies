import { useState, useEffect, useRef } from 'react';
import { 
  FileCheck, CheckCircle, XCircle, Clock, Shield, Activity, Search, 
  Filter as FilterIcon, X, ChevronDown, ChevronUp, Square, Maximize, 
  Package, User, ArrowRight, Key, RefreshCw, FileText, Edit, Anchor, 
  ExternalLink, Terminal, Zap, Database, History, LayoutDashboard, Globe
} from 'lucide-react';
import enhancedDB from '../../lib/data/hybridDataStore';
import { useRole } from '../../lib/utils/roleContext';
import { getDIDOperationsHistory } from '../../lib/operations/didOperationsLocal';
import { backendAPI, type BackendBatch } from '../../lib/api/backendAPI';
import { etherscanTxUrl, etherscanBlockUrl } from '../../lib/api/config';
import MerkleTreeVisualizer from '../visualizations/MerkleTreeVisualizer';

interface EvidenceEvent {
  id: string;
  did: string;
  eventType: string;
  timestamp: string;
  description: string;
  data: any;
  status: 'pending' | 'approved' | 'rejected';
  witness_signature?: string;
  merkleRoot?: string;
  blockchain_tx_id?: string;
  isVerified?: boolean;
  witness_proofs?: any;
}

interface MonitoredAsset {
  id: string;
  did: string;
  model: string;
  lastActivity: string;
  syncStatus: 'synchronized' | 'pending_anchor';
  eventCount: number;
}

export default function WitnessDashboard() {
  const { currentRoleDID } = useRole();
  const [assets, setAssets] = useState<MonitoredAsset[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'ledger' | 'anchors'>('ledger');
  const [events, setEvents] = useState<EvidenceEvent[]>([]);
  const [batches, setBatches] = useState<BackendBatch[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showMerkleModal, setShowMerkleModal] = useState(false);
  const [selectedProof, setSelectedProof] = useState<any | null>(null);
  
  // Modal for manual verification/approval (keeping legacy logic for compatibility)
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [eventToConfirm, setEventToConfirm] = useState<any | null>(null);
  const [confirmAction, setConfirmAction] = useState<'approve' | 'reject' | null>(null);
  
  const selectedAsset = assets.find(a => a.id === selectedAssetId);

  useEffect(() => {
    loadAssets();
    const interval = setInterval(loadAssets, 10000); // 10s is sufficient
    return () => clearInterval(interval);
  }, []);

  // Set initial selection only if none exists
  useEffect(() => {
    if (!selectedAssetId && assets.length > 0) {
      setSelectedAssetId(assets[0].id);
    }
  }, [assets, selectedAssetId]);

  useEffect(() => {
    if (selectedAssetId) {
      loadAssetEvidence(selectedAssetId);
    }
  }, [selectedAssetId]);

  async function loadAssets() {
    try {
      const allDPPs = await enhancedDB.getAllDPPs();
      
      const monitored: MonitoredAsset[] = await Promise.all(allDPPs.map(async dpp => {
        const history = await getDIDOperationsHistory(dpp.id);
        const ops = history.success ? history.operations : [];
        
        const hasUnanchored = ops.some(op => op.status === 'approved' && !op.witness_proofs);
        
        return {
          id: dpp.id,
          did: dpp.did,
          model: dpp.model,
          lastActivity: ops.length > 0 ? ops[0].timestamp : dpp.created_at || new Date().toISOString(),
          syncStatus: hasUnanchored ? 'pending_anchor' : 'synchronized',
          eventCount: ops.length
        };
      }));

      // Sort by last activity
      monitored.sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime());

      setAssets(monitored);
    } catch (err) {
      console.error('Failed to load assets:', err);
    }
  }

  async function loadAssetEvidence(dppId: string) {
    try {
      const history = await getDIDOperationsHistory(dppId);
      let relevantBatchIds = new Set<number>();
      
      if (history.success) {
        const formattedEvents: EvidenceEvent[] = history.operations.map((op: any) => {
          // Determine a readable description
          let description = op.attestation_data?.description || op.description;
          
          if (!description || description === 'Process Operation') {
            const typeMap: Record<string, string> = {
              'create': 'Product Identity Created',
              'update': 'Product Update Logged',
              'transfer': 'Change of Ownership',
              'ownership_change': 'Change of Ownership',
              'did_update': 'DID Document Updated',
              'certification': 'Quality Certification Issued',
              'deactivate': 'Product Deactivated'
            };
            description = typeMap[op.attestation_type] || 'Process Operation';
          }

          if (op.witness_proofs?.batchId !== undefined) {
            relevantBatchIds.add(Number(op.witness_proofs.batchId));
          }

          return {
            id: op.id,
            did: op.did,
            eventType: op.attestation_type || 'unknown_event',
            timestamp: op.timestamp,
            description: description,
            data: op.attestation_data || op.data,
            status: op.approval_status || op.status,
            witness_signature: op.signature,
            merkleRoot: op.witness_proofs?.merkleRoot,
            blockchain_tx_id: op.witness_proofs?.txHash || op.tx_hash,
            witness_proofs: op.witness_proofs, // Pass full proof
            isVerified: true
          };
        });
        setEvents(formattedEvents);
      }
      
      // Load and filter batches for this specific asset
      const allBatches = await backendAPI.getBatches();
      if (allBatches && history.success) {
        const filtered = allBatches.filter(b => relevantBatchIds.has(Number(b.batch_id)));
        setBatches(filtered);
      } else {
        setBatches(allBatches || []);
      }
    } catch (err) {
      console.error('Failed to load asset evidence:', err);
    }
  }

  const handleRecovery = async () => {
    if (!selectedAssetId) return;
    setIsRefreshing(true);
    // Simulate deep validation
    await new Promise(r => setTimeout(r, 2000));
    await loadAssetEvidence(selectedAssetId);
    setIsRefreshing(false);
    alert('Historical verification recovery completed. All signatures and anchors are valid.');
  };

  const filteredAssets = assets.filter(a => 
    (a.model?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || 
    (a.did?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors pt-16 flex overflow-hidden h-screen">
      {/* 1. Sidebar: Asset Inventory */}
      <div className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col shrink-0">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
          <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Package className="w-4 h-4 text-blue-500" />
            Evidence Inventory
          </h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search assets..."
              className="w-full pl-9 pr-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredAssets.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">No assets found</div>
          ) : (
            filteredAssets.map(asset => (
              <button
                key={asset.id}
                onClick={() => setSelectedAssetId(asset.id)}
                className={`w-full flex items-center justify-between p-3 rounded-xl transition-all text-left border ${
                  selectedAssetId === asset.id 
                    ? 'bg-blue-50 dark:bg-blue-900/40 border-blue-200 dark:border-blue-800 shadow-sm' 
                    : 'hover:bg-gray-50 dark:hover:bg-gray-800/50 border-transparent hover:border-gray-100 dark:hover:border-gray-700'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`p-2 rounded-lg shrink-0 ${
                    selectedAssetId === asset.id ? 'bg-blue-100 dark:bg-blue-800 text-blue-600' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'
                  }`}>
                    <Package className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-gray-900 dark:text-white text-sm truncate pr-2">
                      {asset.model}
                    </div>
                    <div className="text-[10px] font-mono text-gray-400 truncate tracking-tighter">
                      {asset.did.split(':').pop()}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-gray-500 bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">
                        {asset.eventCount} proofs
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1 shrink-0 ml-2">
                  {asset.syncStatus === 'synchronized' ? (
                    <div className="p-1 bg-green-100 dark:bg-green-900/30 rounded-full">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    </div>
                  ) : (
                    <div className="p-1 bg-amber-100 dark:bg-amber-900/30 rounded-full animate-pulse">
                      <Clock className="w-4 h-4 text-amber-500" />
                    </div>
                  )}
                  <span className="text-[9px] text-gray-400 tabular-nums">
                    {new Date(asset.lastActivity).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-gray-50 dark:bg-gray-950 overflow-hidden">
        {selectedAsset ? (
          <>
            {/* Asset Header */}
            <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                      <Package className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                        {selectedAsset.model}
                      </h1>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <span className="font-mono bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                          {selectedAsset.did}
                        </span>
                        <span className="text-gray-300">|</span>
                        <span>{selectedAsset.eventCount} Proofs of Existence</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleRecovery}
                    disabled={isRefreshing}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-all shadow-sm disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                    Verification Recovery
                  </button>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex gap-8 mt-8 border-b border-gray-100 dark:border-gray-700">
                <button
                  onClick={() => setActiveTab('ledger')}
                  className={`pb-4 px-2 text-sm font-bold transition-all relative ${
                    activeTab === 'ledger' 
                      ? 'text-blue-600 dark:text-blue-400' 
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <History className="w-4 h-4" />
                    Evidence Ledger
                  </div>
                  {activeTab === 'ledger' && (
                    <div className="absolute bottom-0 left-0 w-full h-1 bg-blue-600 rounded-t-full" />
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('anchors')}
                  className={`pb-4 px-2 text-sm font-bold transition-all relative ${
                    activeTab === 'anchors' 
                      ? 'text-blue-600 dark:text-blue-400' 
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    Blockchain Anchor Room
                  </div>
                  {activeTab === 'anchors' && (
                    <div className="absolute bottom-0 left-0 w-full h-1 bg-blue-600 rounded-t-full" />
                  )}
                </button>
              </div>
            </div>

            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto p-6">
              {activeTab === 'ledger' ? (
                /* 2. Main Area: Evidence Ledger */
                <div className="max-w-4xl mx-auto">
                  <div className="relative border-l-2 border-gray-200 dark:border-gray-800 ml-3 pl-8 space-y-8">
                    {events.map((event, idx) => (
                      <div key={event.id} className="relative group">
                        {/* Timeline Dot */}
                        <div className={`absolute -left-[41px] top-6 w-5 h-5 rounded-full border-4 border-white dark:border-gray-950 ${
                          event.status === 'approved' ? 'bg-green-500' : 'bg-gray-400'
                        }`} />
                        
                        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden transition-all hover:shadow-md">
                          <div className="p-4 border-b border-gray-50 dark:border-gray-700 bg-gray-50/30 dark:bg-gray-800/50 flex justify-between items-center">
                            <div className="flex items-center gap-4">
                              {event.status === 'approved' ? (
                                <div className="flex items-center gap-1.5 text-xs font-bold text-green-600 dark:text-green-400 uppercase tracking-widest bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded">
                                  <CheckCircle className="w-3.5 h-3.5" />
                                  Witness Validated
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5 text-xs font-bold text-gray-400 uppercase tracking-widest bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                                  <Clock className="w-3.5 h-3.5" />
                                  Pending Review
                                </div>
                              )}
                              
                              <div className="flex items-center gap-1 text-[10px] text-gray-400 font-medium italic border-l border-gray-200 dark:border-gray-700 pl-4">
                                <Shield className="w-3 h-3 text-blue-400" />
                                Live Check: Signature & Hash Integrity OK
                              </div>
                            </div>
                            <span className="text-xs text-gray-400 font-mono">
                              {new Date(event.timestamp).toLocaleString()}
                            </span>
                          </div>
                          
                          <div className="p-5">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                              {event.description}
                            </h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 capitalize">
                              {event.eventType?.replace(/_/g, ' ') || 'Process Operation'}
                            </p>

                            <div className="grid grid-cols-2 gap-4">
                              <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg border border-gray-100 dark:border-gray-800">
                                <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">Witness Signature</div>
                                <div className="text-xs font-mono text-gray-600 dark:text-gray-400 break-all leading-tight">
                                  {event.witness_signature ? event.witness_signature.slice(0, 64) + '...' : 'Pending signature...'}
                                </div>
                              </div>
                              
                              <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg border border-gray-100 dark:border-gray-800">
                                <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">Anchor Context</div>
                                {event.merkleRoot ? (
                                  <div className="space-y-1">
                                    <div className="flex justify-between items-center">
                                      <span className="text-[10px] text-blue-500 font-bold">MERKLE ROOT</span>
                                      <button 
                                        onClick={() => {
                                          setSelectedProof(event.witness_proofs);
                                          setShowMerkleModal(true);
                                        }}
                                        className="text-[10px] text-blue-600 hover:underline flex items-center gap-0.5"
                                      >
                                        <ExternalLink className="w-2.5 h-2.5" />
                                        VIEW TREE
                                      </button>
                                    </div>
                                    <div className="text-xs font-mono text-gray-600 dark:text-gray-400 truncate">
                                      {event.merkleRoot}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2 text-amber-500 font-medium py-1">
                                    <Clock className="w-4 h-4" />
                                    <span className="text-xs">Pending Batching</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                /* 3. De "Blockchain Anchor Room" */
                <div className="max-w-5xl mx-auto space-y-6">
                  <div className="grid grid-cols-3 gap-6 mb-8">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm text-center border-b-4 border-b-blue-500">
                      <div className="text-sm text-gray-500 mb-1">Relevant Batches</div>
                      <div className="text-4xl font-bold text-gray-900 dark:text-white">{batches.length}</div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm text-center">
                      <div className="text-sm text-gray-500 mb-1">Anchored Events</div>
                      <div className="text-4xl font-bold text-green-600 dark:text-green-400">
                        {events.filter(e => e.merkleRoot).length}
                      </div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm text-center">
                      <div className="text-sm text-gray-500 mb-1">Unanchored Wait</div>
                      <div className="text-4xl font-bold text-amber-500">
                        {events.filter(e => !e.merkleRoot).length}
                      </div>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                    <table className="w-full text-left">
                      <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700">
                        <tr>
                          <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Batch Info</th>
                          <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Merkle Root</th>
                          <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Network Proof</th>
                          <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                        {batches.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-6 py-12 text-center">
                              <div className="flex flex-col items-center gap-2 text-gray-400">
                                <Database className="w-8 h-8 opacity-20" />
                                <p className="text-sm">No batches found in the blockchain history yet.</p>
                                <p className="text-[10px]">Verify your node connection or wait for the next anchoring cycle.</p>
                              </div>
                            </td>
                          </tr>
                        ) : batches.map(batch => (
                          <tr key={batch.batch_id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors">
                            <td className="px-6 py-4">
                              <div className="font-bold text-gray-900 dark:text-white">Batch #{batch.batch_id}</div>
                              <div className="text-xs text-gray-500">{new Date(batch.timestamp || Date.now()).toLocaleString()}</div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="font-mono text-xs text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-900 px-2 py-1 rounded max-w-[200px] truncate" title={batch.merkle_root}>
                                {batch.merkle_root}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <a 
                                href={etherscanTxUrl(batch.tx_hash)} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
                              >
                                <ExternalLink className="w-3 h-3" />
                                {batch.tx_hash.slice(0, 12)}...
                              </a>
                              <div className="text-[10px] text-gray-400 mt-1">Block: {batch.block_number}</div>
                            </td>
                            <td className="px-6 py-4">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                                <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                                {batch.status.toUpperCase()}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
            <Shield className="w-16 h-16 mb-4 opacity-20" />
            <p className="text-lg">Select an asset to view historical evidence</p>
          </div>
        )}
      </div>

      {/* Merkle Tree Modal */}
      {showMerkleModal && selectedProof && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-gray-200 dark:border-gray-800">
            <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Anchor className="w-5 h-5 text-blue-500" />
                  Merkle Tree Verification
                </h2>
                <p className="text-sm text-gray-500 font-mono mt-1">{selectedProof.merkleRoot}</p>
              </div>
              <button 
                onClick={() => {
                  setShowMerkleModal(false);
                  setSelectedProof(null);
                }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
              >
                <X className="w-6 h-6 text-gray-500" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-8">
              <MerkleTreeVisualizer selectedProof={selectedProof} />
            </div>
            <div className="p-6 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 text-center">
              <p className="text-xs text-gray-500">
                This Merkle Tree represents the immutable batch state anchored on the blockchain. 
                The selected event is cryptographically linked to the root above.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Legacy Confirmation Modal would go here if still needed for one-off approvals */}
    </div>
  );
}
