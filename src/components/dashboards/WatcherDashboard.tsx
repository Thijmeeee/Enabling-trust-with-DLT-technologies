import { useState, useEffect, useMemo } from 'react';
import { 
  Activity, CheckCircle, Shield, Eye, 
  Package, FileText, GitBranch,
  Search, LayoutDashboard, Database, Flag,
  ShieldCheck, Lock, AlertTriangle, RefreshCw,
  ExternalLink
} from 'lucide-react';
import { hybridDataStore as enhancedDB } from '../../lib/data/hybridDataStore';
import { getDIDOperationsHistory } from '../../lib/operations/didOperationsLocal';
import { useRole } from '../../lib/utils/roleContext';
import { DPP } from '../../lib/data/localData';
import { api, type WatcherAlert } from '../../lib/api';
import MerkleTreeVisualizer from '../visualizations/MerkleTreeVisualizer';

/**
 * Robust helper to extract SCID from any DID format
 */
function extractSCID(did: string): string {
  if (!did) return '';
  try {
    const decoded = decodeURIComponent(did);
    // SCID is always the last part of a : separated DID
    const parts = decoded.split(':');
    const lastPart = parts[parts.length - 1];
    // Remove any potential fragments or query params
    return lastPart.split('?')[0].split('#')[0].trim();
  } catch (e) {
    return (did || '').split(':').pop() || '';
  }
}

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
  const [lastRefresh, setLastRefresh] = useState(Date.now());
  
  // Track manual verification results to override background alerts
  const [manualVerificationResults, setManualVerificationResults] = useState<Record<string, boolean>>({});
  
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
    const interval = setInterval(() => {
      loadMonitoringData();
      setLastRefresh(Date.now());
    }, 10000); // 10s for real-time feel
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedDPP) {
      loadDPPDetails(selectedDPP);
    }
  }, [selectedDPPId, lastRefresh]);

  // Reset operation selection when switching DPPs
  useEffect(() => {
    setSelectedOperationIndex(null);
  }, [selectedDPPId]);

  // Auto-select first anchored event once history is loaded
  useEffect(() => {
    if (didHistory.length > 0 && selectedOperationIndex === null) {
      const anchoredIndex = didHistory.findIndex(op => op.witness_proofs);
      setSelectedOperationIndex(anchoredIndex !== -1 ? anchoredIndex : 0);
    }
  }, [didHistory, selectedOperationIndex]);

  async function loadMonitoringData() {
    try {
      const allDPPs = await enhancedDB.getAllDPPs();
      const allAlerts = await api.watcher.getAlerts();
      
      console.log('[WatcherDashboard] Syncing Alerts via SCID matching...', { alertsCount: allAlerts.length });
      if (allAlerts.length > 0) {
        console.table(allAlerts.map(a => ({ did: a.did, reason: a.reason, scid: extractSCID(a.did) })));
      }
      
      // Calculate integrity and alert counts
      const monitored: MonitoredDPP[] = allDPPs.map(dpp => {
        const dppScid = extractSCID(dpp.did);
        
        // Find ALL alerts that match this SCID
        const dppAlerts = allAlerts.filter(a => {
          const alertScid = extractSCID(a.did);
          return alertScid.toLowerCase() === dppScid.toLowerCase() && alertScid.length > 5;
        });

        // Deduplicate alerts for the counter to avoid "Spam" counts if backend loops
        const uniqueAlerts = dppAlerts.filter((v, i, a) => 
          a.findIndex(t => t.reason === v.reason && t.event_id === v.event_id) === i
        );

        // Calculate score
        let score = 100;
        const manuallyVerifiedOk = manualVerificationResults[dppScid] === true;

        if (dppAlerts.length > 0 && !manuallyVerifiedOk) {
          const hasCritical = dppAlerts.some(a => {
            const searchBody = `${a.reason} ${a.details}`.toLowerCase();
            return searchBody.includes('mismatch') || 
                   searchBody.includes('failed') || 
                   searchBody.includes('tamper') ||
                   searchBody.includes('corrupt');
          });
          
          score = hasCritical ? 0 : Math.max(0, 100 - (25 * uniqueAlerts.length));
        }
        
        return {
          ...dpp,
          scid: dppScid,
          integrityScore: manuallyVerifiedOk ? 100 : score,
          lastVerified: new Date().toISOString(),
          alertCount: manuallyVerifiedOk ? 0 : uniqueAlerts.length,
        };
      });

      setMonitoredDPPs(monitored);
      setAlerts(allAlerts);

      // Auto-select first DPP if none selected - using functional update to avoid stale closure issues
      setSelectedDPPId(prevId => {
        if (!prevId && monitored.length > 0) {
          return monitored[0].id;
        }
        return prevId;
      });
    } catch (err) {
      console.error('Failed to load monitoring data:', err);
    }
  }

  async function loadDPPDetails(dpp: MonitoredDPP) {
    // Note: We don't clear rawLog/rawWitness here to prevent flickering during auto-refresh
    
    // Load DID history (operations)
    const historyResult = await getDIDOperationsHistory(dpp.id);
    const ops = historyResult.success ? historyResult.operations : [];
    setDidHistory(ops);
    
    // Fetch raw files with cache-buster to ensure real-time updates
    try {
      const scid = extractSCID(dpp.did);
      if (scid) {
        const timestamp = Date.now();
        // Use the relative path (proxied via Vite) for consistency
        const logRes = await fetch(`/.well-known/did/${scid}/did.jsonl?t=${timestamp}`);
        if (logRes.ok) setRawLog(await logRes.text());

        const witnessRes = await fetch(`/.well-known/did/${scid}/did-witness.json?t=${timestamp}`);
        if (witnessRes.ok) setRawWitness(await witnessRes.text());
      }
    } catch (err) {
      console.error('Failed to fetch raw files:', err);
    }
  }

  async function handleFlagEvent() {
    if (!flagTargetEvent || !selectedDPP) return;

    await api.watcher.createAlert({
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

  /**
   * Automatically create a system alert if a manual verification fails
   */
  async function handleVerificationComplete(result: any) {
    if (selectedDPP) {
      const dppScid = extractSCID(selectedDPP.did);
      console.log('[WatcherDashboard] Manual verification for', dppScid, 'result:', result.isValid);
      
      setManualVerificationResults(prev => ({
        ...prev,
        [dppScid]: result.isValid
      }));

      // SUCCESS CASE: If manual verification passes and the product was rejected,
      // clean up all persistent alerts for this DID in the backend
      if (result.isValid && selectedDPP.integrityScore < 100) {
        console.log('[WatcherDashboard] Manual verification PASSED. Cleaning up backend alerts for:', dppScid);
        try {
          await api.watcher.deleteAlerts(selectedDPP.did);
        } catch (err) {
          console.error('[WatcherDashboard] Failed to auto-delete alerts:', err);
        }
      }

      // Force refresh of the lists to reflect manual override immediately
      setTimeout(() => loadMonitoringData(), 50);
    }

    if (!result.isValid && selectedDPP && selectedOperationIndex !== null) {
      const dbOp = didHistory[selectedOperationIndex];
      const selectedScid = extractSCID(selectedDPP.did);

      // Extract numeric ID only
      const numericIdMatch = String(dbOp.id).match(/(\d+)$/);
      const numericEventId = numericIdMatch ? parseInt(numericIdMatch[1]) : null;

      // Check current alerts state for duplicates via robustness
      const isAlreadyAlerted = alerts.some(a => 
        extractSCID(a.did).toLowerCase() === selectedScid.toLowerCase() &&
        (a.event_id !== null && numericEventId !== null && Number(a.event_id) === Number(numericEventId))
      );
      
      if (!isAlreadyAlerted) {
        console.log('[WatcherDashboard] FORCING SYSTEM REJECTION for SCID:', selectedScid);
        
        try {
          // 1. Create the alert
          await api.watcher.createAlert({
            did: selectedDPP.did,
            event_id: numericEventId as any,
            reason: 'proof_mismatch',
            details: `CRITICAL AUDIT FAILURE: Root mismatch for event ${numericEventId}. Computed ${result.computedRoot.substring(0,10)} differs from DLT root ${result.expectedRoot.substring(0,10)}.`,
            reporter: 'Cryptographic-Audit-Engine'
          });
          
          // 2. Do NOT wait for interval, pull data now
          const freshAlerts = await api.watcher.getAlerts();
          setAlerts(freshAlerts);
          
          // 3. Force re-calculation of integrity scores
          await loadMonitoringData();
          
          // 4. Force a state refresh trigger
          setLastRefresh(Date.now());
          
          console.log('[WatcherDashboard] Rejection state propagated successfully.');
        } catch (err) {
          console.error('[WatcherDashboard] Failed to propagate rejection:', err);
        }
      }
    }
  }

  const filteredDPPs = monitoredDPPs.filter(dpp => 
    (dpp.model?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || 
    (dpp.did?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (dpp.scid?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  // Extract the actual proof and operation from the raw files (simulating trustless auditor)
  const fileBasedVerificationData = useMemo(() => {
    if (selectedOperationIndex === null || !didHistory[selectedOperationIndex]) return null;
    const dbOp = didHistory[selectedOperationIndex];
    
    let fileProof = undefined;
    let fileOp = undefined;

    // 1. Try to find the event in the raw .jsonl log
    if (rawLog) {
      const lines = rawLog.trim().split('\n');
      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          if (entry.versionId === dbOp.version_id) {
            fileOp = entry;
            break;
          }
        } catch (e) { /* ignore parse errors */ }
      }
    }

    // 2. Try to find the witness proof in the raw did-witness.json
    if (rawWitness) {
      try {
        const witnessData = JSON.parse(rawWitness);
        // Correctly handle if did-witness.json is a direct array or has a wrapper
        const proofs = Array.isArray(witnessData) 
          ? witnessData 
          : (witnessData.anchoringProofs || witnessData.witnessProofs || []);
          
        fileProof = proofs.find((p: any) => 
          String(p.versionId) === String(dbOp.version_id) || 
          String(p.version_id) === String(dbOp.version_id)
        );
      } catch (e) { 
        console.error('Error parsing raw witness:', e);
      }
    }

    // Fallback to database data if the file hasn't loaded yet or entry wasn't found
    // This prevents the "No Operation Selected" bug
    return { 
      fileProof: fileProof || dbOp.witness_proofs, 
      fileOp: fileOp || dbOp 
    };
  }, [selectedOperationIndex, didHistory, rawLog, rawWitness]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors pt-16 flex overflow-hidden h-screen">
      {/* Sidebar - Product Selection */}
      <div className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col shrink-0">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search DPPs..."
              className="w-full pl-9 pr-4 py-2 bg-gray-100 dark:bg-gray-700 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button 
            onClick={loadMonitoringData}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-500 transition-colors"
            title="Refresh Monitoring Data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredDPPs.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">No products found</div>
          ) : (
            filteredDPPs.map(dpp => (
              <button
                key={dpp.id}
                onClick={() => setSelectedDPPId(dpp.id)}
                className={`w-full flex items-center justify-between p-3 rounded-lg transition-all text-left group border ${
                  selectedDPPId === dpp.id
                    ? (dpp.alertCount > 0 
                        ? 'bg-red-50 dark:bg-red-900/40 border-red-500 ring-1 ring-red-500 shadow-lg' 
                        : 'bg-blue-50 dark:bg-blue-900/40 border-blue-200 dark:border-blue-800 shadow-sm')
                    : (dpp.alertCount > 0 
                        ? 'bg-red-50/30 dark:bg-red-900/10 border-red-200 dark:border-red-900/40' 
                        : 'hover:bg-gray-50 dark:hover:bg-gray-700 border-transparent')
                }`}
              >
                <div className="flex items-center gap-3">
                  {dpp.alertCount > 0 ? (
                    <AlertTriangle className="w-5 h-5 text-red-500 animate-pulse" />
                  ) : (
                    <Package className={`w-5 h-5 ${selectedDPPId === dpp.id ? 'text-blue-600' : 'text-gray-400'}`} />
                  )}
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white text-sm flex items-center gap-2">
                      {dpp.model}
                      {dpp.alertCount > 0 && <Flag className="w-3 h-3 text-red-600 fill-red-600" />}
                    </div>
                    <div className="text-[10px] uppercase font-mono text-gray-500 dark:text-gray-400">{dpp.scid}</div>
                  </div>
                </div>
                {dpp.alertCount > 0 && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white shadow-sm animate-bounce">
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
                      <span className={`text-sm font-normal px-2 py-0.5 rounded shadow-sm border ${
                        selectedDPP.integrityScore >= 90 
                        ? 'bg-green-100 text-green-700 border-green-200' 
                        : 'bg-red-100 text-red-700 border-red-200'
                      }`}>
                        Integrity: {selectedDPP.integrityScore}%
                      </span>
                      <span className={`text-xs uppercase font-extrabold px-3 py-1 rounded-full border-2 ${
                        selectedDPP.integrityScore < 90
                        ? 'bg-red-600 text-white border-red-700'
                        : 'bg-emerald-100 text-emerald-700 border-emerald-200'
                      }`}>
                        {selectedDPP.integrityScore < 90 ? 'STATUS: REJECTED / TAMPERED' : 'STATUS: ACTIVE (CERTIFIED)'}
                      </span>
                    </h1>
                    <div className="flex items-center gap-4 mt-1">
                      <p className="text-gray-500 text-xs font-mono">{selectedDPP.did}</p>
                      {alerts.filter(a => 
                        extractSCID(a.did).toLowerCase() === extractSCID(selectedDPP.did).toLowerCase() && !a.event_id
                      ).map((alert, idx) => (
                        <div key={idx} className="flex items-center gap-1.5 px-2 py-0.5 bg-red-600 text-white text-[10px] font-bold rounded animate-pulse uppercase">
                          <AlertTriangle className="w-3 h-3" />
                          {alert.reason.replace(/_/g, ' ')}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="text-right">
                    <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Status</div>
                    <div className={`flex items-center gap-2 font-bold ${
                      selectedDPP.alertCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
                    }`}>
                      {selectedDPP.alertCount > 0 ? (
                        <>
                          <AlertTriangle className="w-4 h-4" />
                          REJECTED
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          {selectedDPP.lifecycle_status}
                        </>
                      )}
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
                        selectedProof={fileBasedVerificationData?.fileProof}
                        localOperation={fileBasedVerificationData?.fileOp}
                        onVerificationComplete={handleVerificationComplete}
                        alerts={alerts.filter(a => a.did === selectedDPP.did)}
                      />
                    </div>
                  </section>

                  {/* Journal Feed */}
                  <section>
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-bold dark:text-white flex items-center gap-2">
                        <Activity className="w-5 h-5 text-emerald-500" />
                        Historical Events
                      </h2>
                      <div className="px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-lg text-[10px] font-mono text-gray-500">
                        {didHistory.length} EVENTS TOTAL
                      </div>
                    </div>

                    <div className="bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-xl p-4 mb-6">
                      <div className="flex items-start gap-4">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
                          <ShieldCheck className="w-5 h-5 text-blue-600" />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-sm font-bold text-blue-900 dark:text-blue-300">Automatic Integrity Audit</h3>
                          <p className="text-xs text-blue-800/70 dark:text-blue-400/70 mt-1 leading-relaxed">
                            The watcher service continuously verifies the hash-chain integrity and DLT anchors for all events in this product's lifecycle. 
                            Select an individual event below to inspect its specific Merkle proof and DLT signature.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {didHistory.length === 0 && (
                        <div className="p-8 text-center text-gray-500 bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300">
                          No operations found for this DID
                        </div>
                      )}
                      {didHistory.map((op, idx) => {
                        const selectedScid = extractSCID(selectedDPP.did);

                        // Safe numeric ID extraction
                        const numericIdMatch = String(op.id).match(/^([a-z-]+)?(\d+)/);
                        const opNumericId = numericIdMatch ? numericIdMatch[2] : op.id;

                        const isEventFlagged = alerts.some(a => 
                          extractSCID(a.did).toLowerCase() === selectedScid.toLowerCase() &&
                          (a.event_id !== null && String(a.event_id) === String(opNumericId))
                        );
                        const isGlobalFlagged = alerts.some(a => 
                          extractSCID(a.did).toLowerCase() === selectedScid.toLowerCase() && !a.event_id
                        );
                        const isFlagged = isEventFlagged || isGlobalFlagged;
                        const isAnchored = Boolean(op.witness_proofs);
                        return (
                          <div 
                            key={idx}
                            onClick={() => setSelectedOperationIndex(idx)}
                            className={`group relative bg-white dark:bg-gray-800 rounded-xl border p-4 transition-all cursor-pointer ${
                              selectedOperationIndex === idx 
                                ? 'border-blue-500 ring-1 ring-blue-500 shadow-md translate-x-1' 
                                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                            } ${isFlagged ? 'bg-red-50/50 dark:bg-red-900/10 border-red-200 shadow-sm shadow-red-500/10' : ''}`}
                          >
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <div className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                                  op.attestation_type.includes('creation') ? 'bg-purple-100 text-purple-700' : 
                                  op.attestation_type.includes('transfer') ? 'bg-orange-100 text-orange-700' :
                                  'bg-blue-100 text-blue-700'
                                }`}>
                                  {op.attestation_type.replace(/_/g, ' ')}
                                </div>
                                <span className="text-xs text-gray-400">{new Date(op.timestamp).toLocaleString()}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                {isAnchored && !isFlagged && (
                                  <div className="flex items-center gap-1 text-emerald-600 text-[10px] font-extrabold px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 rounded-full border border-emerald-200 dark:border-emerald-800/50">
                                    <ShieldCheck className="w-3 h-3" />
                                    VERIFIED
                                  </div>
                                )}
                                {isFlagged && (
                                  <div className="flex items-center gap-1 text-red-600 text-xs font-bold px-2 py-1 bg-red-100 dark:bg-red-900/20 rounded-full border border-red-300 animate-in fade-in zoom-in duration-300">
                                    <Flag className="w-3 h-3" />
                                    {isEventFlagged ? 'REJECTED' : 'INTEGRITY ALERT'}
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
                                <div className="text-[10px] uppercase text-gray-500 font-bold">Witness Node</div>
                                <div className="text-xs font-mono truncate text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900/50 px-2 py-1 rounded">{op.witness_did}</div>
                              </div>
                              <div className="space-y-1">
                                <div className="text-[10px] uppercase text-gray-500 font-bold">Cryptographic Anchor</div>
                                {(() => {
                                  const txHash = op.tx_hash || op.witness_proofs?.txHash;
                                  return txHash ? (
                                    <a 
                                      href={`https://sepolia.etherscan.io/tx/${txHash}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs font-mono truncate text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded hover:underline flex items-center gap-1"
                                    >
                                      <ExternalLink className="w-3 h-3" />
                                      {txHash.substring(0, 18)}...
                                    </a>
                                  ) : (
                                    <div className="text-xs font-mono truncate text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-900/50 px-2 py-1 rounded italic">
                                      Local (Pending Anchor)
                                    </div>
                                  );
                                })()}
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
                        <pre className="text-emerald-400 text-xs font-mono">
                          {rawLog ? (
                            rawLog.split('\n')
                              .filter(l => l.trim())
                              .map(line => {
                                try {
                                  return JSON.stringify(JSON.parse(line), null, 2);
                                } catch {
                                  return line;
                                }
                              })
                              .join('\n\n---\n\n')
                          ) : (
                            'Fetching log...'
                          )}
                        </pre>
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
                        <pre className="text-blue-400 text-xs font-mono">
                          {rawWitness ? (
                            (() => {
                              try {
                                return JSON.stringify(JSON.parse(rawWitness), null, 2);
                              } catch {
                                return rawWitness;
                              }
                            })()
                          ) : (
                            'Fetching proofs...'
                          )}
                        </pre>
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

