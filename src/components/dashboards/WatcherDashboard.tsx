import { useState, useEffect } from 'react';
import { 
  Activity, CheckCircle, Shield, Eye, 
  Package, FileText, GitBranch,
  Search, LayoutDashboard, Database, Flag
} from 'lucide-react';
import { hybridDataStore as enhancedDB } from '../../lib/data/hybridDataStore';
import { getDIDOperationsHistory } from '../../lib/operations/didOperationsLocal';
import { useRole } from '../../lib/utils/roleContext';
import { DPP } from '../../lib/data/localData';
import { backendAPI, WatcherAlert } from '../../lib/api/backendAPI';
import MerkleTreeVisualizer from '../visualizations/MerkleTreeVisualizer';

interface MonitoredDPP extends DPP {
  scid: string;
  integrityScore: number;
  lastVerified: string;
  alertCount: number;
}

export default function WatcherDashboard() {
  const { currentRoleDID } = useRole();
  const [monitoredDPPs, setMonitoredDPPs] = useState<MonitoredDPP[]>([]);
  const [alerts, setAlerts] = useState<WatcherAlert[]>([]);
  const [activeTab, setActiveTab] = useState<'audit' | 'resources'>('audit');
  const [selectedDPPId, setSelectedDPPId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [didHistory, setDidHistory] = useState<any[]>([]);
  const [selectedOperationIndex, setSelectedOperationIndex] = useState<number | null>(null);
  const [rawLog, setRawLog] = useState<string | null>(null);
  const [rawWitness, setRawWitness] = useState<string | null>(null);
  
  const [showFlagModal, setShowFlagModal] = useState(false);
  const [flagTargetEvent, setFlagTargetEvent] = useState<any | null>(null);
  const [flagForm, setFlagForm] = useState({
    reason: 'signature_mismatch',
    details: ''
  });

  const selectedDPP = monitoredDPPs.find(d => d.id === selectedDPPId);

  useEffect(() => {
    loadMonitoringData();
    const interval = setInterval(loadMonitoringData, 30000); // 30s is enough
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedDPP) {
      loadDPPDetails(selectedDPP);
    }
  }, [selectedDPPId]);

  async function loadMonitoringData() {
    try {
      const allDPPs = await enhancedDB.getAllDPPs();
      const allAlerts = await backendAPI.getWatcherAlerts();
      
      // Calculate integrity and alert counts
      const monitored: MonitoredDPP[] = allDPPs.map(dpp => {
        const dppAlerts = allAlerts.filter(a => a.did === dpp.did);
        
        // Simple integrity calculation for the dashboard view
        let score = 100;
        if (dppAlerts.length > 0) {
          score -= 20 * dppAlerts.length;
        }
        
        return {
          ...dpp,
          scid: dpp.did.split(':').pop() || '',
          integrityScore: Math.max(0, score),
          lastVerified: new Date().toISOString(),
          alertCount: dppAlerts.length,
        };
      });

      setMonitoredDPPs(monitored);
      setAlerts(allAlerts);

      // Auto-select first DPP if none selected
      if (!selectedDPPId && monitored.length > 0) {
        setSelectedDPPId(monitored[0].id);
      }
    } catch (err) {
      console.error('Failed to load monitoring data:', err);
    }
  }

  async function loadDPPDetails(dpp: MonitoredDPP) {
    setRawLog(null);
    setRawWitness(null);

    // Load DID history (operations)
    const historyResult = await getDIDOperationsHistory(dpp.id);
    const ops = historyResult.success ? historyResult.operations : [];
    setDidHistory(ops);
    
    // Default to latest anchor
    const firstAnchoredIndex = ops.findIndex(op => op.witness_proofs);
    setSelectedOperationIndex(firstAnchoredIndex !== -1 ? firstAnchoredIndex : 0);

    // Fetch raw files
    try {
      const scid = dpp.did.split(':').pop();
      if (scid) {
        // Use the backend proxy for stability
        const logRes = await fetch(`http://localhost:3000/.well-known/did/${scid}/did.jsonl`);
        if (logRes.ok) setRawLog(await logRes.text());

        const witnessRes = await fetch(`http://localhost:3000/.well-known/did/${scid}/did-witness.json`);
        if (witnessRes.ok) setRawWitness(await witnessRes.text());
      }
    } catch (err) {
      console.error('Failed to fetch raw files:', err);
    }
  }

  async function handleFlagEvent() {
    if (!flagTargetEvent || !selectedDPP) return;

    await backendAPI.createWatcherAlert({
      did: selectedDPP.did,
      event_id: flagTargetEvent.id,
      reason: flagForm.reason,
      details: flagForm.details,
      reporter: currentRoleDID
    });

    setShowFlagModal(false);
    setFlagTargetEvent(null);
    setFlagForm({ reason: 'signature_mismatch', details: '' });
    await loadMonitoringData();
  }

  const filteredDPPs = monitoredDPPs.filter(dpp => 
    (dpp.model?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || 
    (dpp.did?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (dpp.scid?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors pt-16 flex overflow-hidden h-screen">
      {/* Sidebar - Product Selection */}
      <div className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col shrink-0">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search DPPs..."
              className="w-full pl-9 pr-4 py-2 bg-gray-100 dark:bg-gray-700 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredDPPs.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">No products found</div>
          ) : (
            filteredDPPs.map(dpp => (
              <button
                key={dpp.id}
                onClick={() => setSelectedDPPId(dpp.id)}
                className={`w-full flex items-center justify-between p-3 rounded-lg transition-all text-left group ${
                  selectedDPPId === dpp.id
                    ? 'bg-blue-50 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-800'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Package className={`w-5 h-5 ${selectedDPPId === dpp.id ? 'text-blue-600' : 'text-gray-400'}`} />
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white text-sm">{dpp.model}</div>
                    <div className="text-[10px] uppercase font-mono text-gray-500 dark:text-gray-400">{dpp.scid}</div>
                  </div>
                </div>
                {dpp.alertCount > 0 && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-100 text-[10px] font-bold text-red-600">
                    {dpp.alertCount}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedDPP ? (
          <>
            {/* Context Header */}
            <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-100 dark:bg-blue-900/50 rounded-xl">
                    <Shield className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold dark:text-white flex items-center gap-2">
                      Audit: {selectedDPP.model}
                      <span className={`text-sm font-normal px-2 py-0.5 rounded ${
                        selectedDPP.integrityScore >= 90 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        Integrity: {selectedDPP.integrityScore}%
                      </span>
                    </h1>
                    <p className="text-gray-500 text-sm font-mono">{selectedDPP.did}</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="text-right">
                    <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Status</div>
                    <div className="flex items-center gap-2 font-medium text-green-600 dark:text-green-400">
                      <CheckCircle className="w-4 h-4" />
                      {selectedDPP.lifecycle_status}
                    </div>
                  </div>
                </div>
              </div>

              {/* Tier 2 Tabs */}
              <div className="flex gap-8">
                <button 
                  onClick={() => setActiveTab('audit')}
                  className={`pb-4 text-sm font-medium transition-colors relative ${
                    activeTab === 'audit' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <LayoutDashboard className="w-4 h-4" />
                    Audit Journal
                  </div>
                  {activeTab === 'audit' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />}
                </button>
                <button 
                  onClick={() => setActiveTab('resources')}
                  className={`pb-4 text-sm font-medium transition-colors relative ${
                    activeTab === 'resources' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4" />
                    Protocol Resources
                  </div>
                  {activeTab === 'resources' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />}
                </button>
              </div>
            </div>

            {/* Scrollable Workspace */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              {activeTab === 'audit' ? (
                <>
                  {/* Visual Verification Section */}
                  <section>
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-bold dark:text-white flex items-center gap-2">
                        <GitBranch className="w-5 h-5 text-indigo-500" />
                        Merkle Integrity Path
                      </h2>
                      <div className="text-xs text-gray-500">Visual proof of anchor validity</div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-2 min-h-[400px]">
                      <MerkleTreeVisualizer 
                        selectedProof={
                          selectedOperationIndex !== null && didHistory[selectedOperationIndex] 
                            ? didHistory[selectedOperationIndex].witness_proofs 
                            : undefined
                        }
                        localOperation={
                          selectedOperationIndex !== null ? didHistory[selectedOperationIndex] : undefined
                        }
                        alerts={alerts.filter(a => a.did === selectedDPP.did)}
                      />
                    </div>
                  </section>

                  {/* Journal Feed */}
                  <section>
                    <h2 className="text-lg font-bold dark:text-white mb-4 flex items-center gap-2">
                      <Activity className="w-5 h-5 text-emerald-500" />
                      Historical Events
                    </h2>
                    <div className="space-y-4">
                      {didHistory.length === 0 && (
                        <div className="p-8 text-center text-gray-500 bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300">
                          No operations found for this DID
                        </div>
                      )}
                      {didHistory.map((op, idx) => {
                        const isFlagged = alerts.some(a => a.event_id === op.id);
                        return (
                          <div 
                            key={idx}
                            onClick={() => setSelectedOperationIndex(idx)}
                            className={`group relative bg-white dark:bg-gray-800 rounded-xl border p-4 transition-all cursor-pointer ${
                              selectedOperationIndex === idx 
                                ? 'border-blue-500 ring-1 ring-blue-500' 
                                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                            } ${isFlagged ? 'bg-red-50/50 dark:bg-red-900/10' : ''}`}
                          >
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <div className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                                  op.attestation_type.includes('creation') ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                                }`}>
                                  {op.attestation_type.replace(/_/g, ' ')}
                                </div>
                                <span className="text-xs text-gray-400">{new Date(op.timestamp).toLocaleString()}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                {isFlagged && (
                                  <div className="flex items-center gap-1 text-red-600 text-xs font-bold px-2 py-1 bg-red-100 rounded-full">
                                    <Flag className="w-3 h-3" />
                                    FLAGGED
                                  </div>
                                )}
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setFlagTargetEvent(op);
                                    setShowFlagModal(true);
                                  }}
                                  className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                  title="Report Inconsistency"
                                >
                                  <Flag className="w-4 h-4" />
                                </button>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <div className="text-[10px] uppercase text-gray-500">Witness</div>
                                <div className="text-xs font-mono truncate text-gray-700 dark:text-gray-300">{op.witness_did}</div>
                              </div>
                              <div className="space-y-1">
                                <div className="text-[10px] uppercase text-gray-500">Hash/Secret</div>
                                <div className="text-xs font-mono truncate text-gray-700 dark:text-gray-300">{op.data_hash || op.secret_hash}</div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                </>
              ) : (
                <>
                  {/* Technical Resources Section */}
                  <div className="grid grid-cols-1 gap-6">
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                      <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-orange-500" />
                          <h3 className="text-sm font-bold">DID Resolver Log (did.jsonl)</h3>
                        </div>
                        <span className="text-[10px] text-gray-500 font-mono">raw_resource_01</span>
                      </div>
                      <div className="p-4 bg-gray-900 min-h-[200px] max-h-[400px] overflow-auto">
                        <pre className="text-emerald-400 text-xs font-mono">{rawLog || 'Fetching log...'}</pre>
                      </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                      <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Database className="w-4 h-4 text-blue-500" />
                          <h3 className="text-sm font-bold">Witness Anchor Proofs (did-witness.json)</h3>
                        </div>
                        <span className="text-[10px] text-gray-500 font-mono">raw_resource_02</span>
                      </div>
                      <div className="p-4 bg-gray-900 min-h-[200px] max-h-[400px] overflow-auto">
                        <pre className="text-blue-400 text-xs font-mono">{rawWitness || 'Fetching proofs...'}</pre>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
            <Eye className="w-16 h-16 mb-4 text-gray-300" />
            <h2 className="text-xl font-medium">Ready for Audit</h2>
            <p className="max-w-xs text-center mt-2">Select a product from the sidebar to inspect its cryptographic integrity lifecycle.</p>
          </div>
        )}
      </div>

      {/* Flagging Modal */}
      {showFlagModal && flagTargetEvent && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-6 bg-red-50 dark:bg-red-900/20 border-b border-red-100 dark:border-red-900/40">
              <div className="flex items-center gap-3 text-red-600">
                <Flag className="w-6 h-6" />
                <h3 className="text-xl font-bold">Flag Inconsistency</h3>
              </div>
              <p className="text-red-700/70 dark:text-red-400 text-sm mt-1">
                This will alert all nodes that the event's data or signature is invalid.
              </p>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-gray-500 mb-2">Issue Category</label>
                <select 
                  value={flagForm.reason}
                  onChange={(e) => setFlagForm({...flagForm, reason: e.target.value})}
                  className="w-full bg-gray-100 dark:bg-gray-700 border-none rounded-lg p-3 text-sm focus:ring-2 focus:ring-red-500"
                >
                  <option value="signature_mismatch">Invalid Cryptographic Signature</option>
                  <option value="proof_mismatch">Merkle Proof Inconsistency</option>
                  <option value="data_tampering">Potential Data Tampering</option>
                  <option value="metadata_anomaly">Unexpected Metadata Changes</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-500 mb-2">Observation Details</label>
                <textarea 
                  rows={4}
                  value={flagForm.details}
                  onChange={(e) => setFlagForm({...flagForm, details: e.target.value})}
                  placeholder="Describe your findings..."
                  className="w-full bg-gray-100 dark:bg-gray-700 border-none rounded-lg p-3 text-sm focus:ring-2 focus:ring-red-500"
                />
              </div>
            </div>

            <div className="p-6 bg-gray-50 dark:bg-gray-900/50 flex gap-3">
              <button 
                onClick={() => setShowFlagModal(false)}
                className="flex-1 px-4 py-2 text-gray-600 font-medium hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleFlagEvent}
                className="flex-1 px-4 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors shadow-lg shadow-red-500/20"
              >
                Submit Flag
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

