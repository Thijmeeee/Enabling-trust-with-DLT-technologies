import { useState, useEffect, useMemo } from 'react';
import {
  Activity, CheckCircle, Shield, Eye,
  Package, FileText, GitBranch,
  Search, LayoutDashboard, Database, Flag, FlagOff,
  ShieldCheck, AlertTriangle, RefreshCw,
  ExternalLink, Power
} from 'lucide-react';
import enhancedDB from '../../lib/data/hybridDataStore';
import { getDIDOperationsHistory } from '../../lib/operations/didOperationsLocal';
import { hashOperation } from '../../lib/utils/merkleTree';
import { useRole } from '../../lib/utils/roleContext';
import { DPP } from '../../lib/data/localData';
import { api } from '../../lib/api';
import { type WatcherAlert } from '../../lib/data/localData';

import MerkleTreeVisualizer from '../visualizations/MerkleTreeVisualizer';

/**
 * Robust helper to extract SCID from any DID format
 */
function extractSCID(did: string): string {
  if (!did) return '';
  try {
    const decoded = decodeURIComponent(did);
    const parts = decoded.split(':');
    const lastPart = parts[parts.length - 1];
    return lastPart.split('?')[0].split('#')[0].trim();
  } catch (e) {
    return (did || '').split(':').pop() || '';
  }
}

/**
 * Extract a consistent identifier for an operation/event
 */
function getEventId(op: any): string {
  if (!op) return '';
  const idStr = String(op.id || op.version_id || '');
  const match = idStr.match(/(\d+)$/);
  return match ? match[1] : idStr;
}

interface MonitoredDPP extends DPP {
  scid: string;
  integrityScore: number;
  lastVerified: string;
  alertCount: number;
}

export default function WatcherDashboard() {
  const { currentRoleDID } = useRole();
  const [allDPPs, setAllDPPs] = useState<DPP[]>([]);
  const [alerts, setAlerts] = useState<WatcherAlert[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Track manual verification results to override background alerts
  // Load from localStorage to share state between dashboards
  const [manualVerificationResults, setManualVerificationResults] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('dpp_manual_audit_results');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Persist manual results to localStorage
  useEffect(() => {
    localStorage.setItem('dpp_manual_audit_results', JSON.stringify(manualVerificationResults));
  }, [manualVerificationResults]);

  const monitoredDPPs = useMemo(() => {
    return allDPPs.map(dpp => {
      const dppScid = extractSCID(dpp.did);

      // Find ALL alerts that match this SCID
      const dppAlerts = alerts.filter(a => {
        const alertScid = extractSCID(a.did || '');
        return alertScid.toLowerCase() === dppScid.toLowerCase() && alertScid.length > 5;
      });

      // Deduplicate alerts
      const uniqueAlerts = dppAlerts.filter((v, i, a) =>
        a.findIndex(t => t.reason === v.reason && t.event_id === v.event_id) === i
      );

      // Filter manual verification results that match this specific DPP
      // Only count '-event-' keys to avoid triple-counting (we also store by hash/index)
      const manualFailuresForDPP = Object.keys(manualVerificationResults)
        .filter(key => {
          // Search for scid prefix precisely
          const isScidMatch = key.toLowerCase().startsWith(dppScid.toLowerCase());
          const isEventKey = key.includes('-event-');
          const isFailure = manualVerificationResults[key] === false;
          return isScidMatch && isEventKey && isFailure;
        });

      // Filter alerts that have been manually cleared (verified as OK)
      const activeAlerts = uniqueAlerts.filter(alert => {
        const scidKey = dppScid.toLowerCase();
        const eventId = String(alert.event_id || '');

        // 1. Skip if manually verified as OK (event-specific)
        if (eventId && manualVerificationResults[`${scidKey}-event-${eventId}`] === true) return false;

        // 2. Skip if already counted in manual failures (to avoid double counting)
        if (eventId && manualVerificationResults[`${scidKey}-event-${eventId}`] === false) return false;

        // 3. New: If any part of this DID has been manually audited as OK recently,
        // and it's a generic/global alert, we suppress it if we have at least one manual PASS
        const hasAnyManualPass = Object.keys(manualVerificationResults).some(k =>
          k.toLowerCase().startsWith(scidKey) && manualVerificationResults[k] === true
        );
        if (!eventId && hasAnyManualPass) return false;

        return true;
      });

      const totalAlertsCount = activeAlerts.length + manualFailuresForDPP.length;

      // A product is "REJECTED" in the UI if we have active alerts or manual audit failures.
      // This fulfills the requirement to flip status based on audit results.
      const hasCriticalIssues = totalAlertsCount > 0;
      let score = hasCriticalIssues ? 0 : 100;

      if (hasCriticalIssues) {
        const hasSevereAlert = activeAlerts.some(a => {
          const searchBody = `${a.reason} ${a.details}`.toLowerCase();
          return searchBody.includes('mismatch') ||
            searchBody.includes('failed') ||
            searchBody.includes('failure') ||
            searchBody.includes('broken') ||
            searchBody.includes('tamper') ||
            searchBody.includes('corrupt') ||
            searchBody.includes('invalid');
        });

        // If not severe, give a partial score, otherwise 0
        score = (hasSevereAlert || manualFailuresForDPP.length > 0) ? 0 : Math.max(25, 100 - (25 * totalAlertsCount));
      }

      return {
        ...dpp,
        scid: dppScid,
        integrityScore: score,
        lastVerified: new Date().toISOString(),
        alertCount: totalAlertsCount,
      } as MonitoredDPP;
    });
  }, [allDPPs, alerts, manualVerificationResults]);

  const [activeTab, setActiveTab] = useState<'audit' | 'resources'>('audit');
  const [selectedDPPId, setSelectedDPPId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [lastRefresh, setLastRefresh] = useState(Date.now());

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

  const handleReset = async () => {
    setIsRefreshing(true);
    const dppScid = selectedDPP?.scid?.toLowerCase() || (selectedDPP ? extractSCID(selectedDPP.did).toLowerCase() : '');
    const dppDid = selectedDPP?.did;

    console.log('[WatcherDashboard] Resetting audit state for', dppScid);

    // 1. Clear local flags for this product
    if (dppScid) {
      setManualVerificationResults(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(key => {
          if (key.toLowerCase().includes(dppScid)) {
            delete next[key];
          }
        });
        return next;
      });
    }

    // 2. Clear backend alerts for this DID
    if (dppDid) {
      try {
        await api.watcher.deleteAlerts(dppDid);
        // Refresh alerts list locally as well
        const refreshedAlerts = await api.watcher.getAlerts();
        setAlerts(refreshedAlerts);
      } catch (e) {
        console.error('[WatcherDashboard] Failed to clear backend alerts:', e);
      }
    }

    // Force re-fetch of underlying files
    setLastRefresh(Date.now());

    // Clear selection so the visualizer detects "new" data
    setSelectedOperationIndex(null);
    setRawLog(null);
    setRawWitness(null);

    // Brief delay for the animation
    setTimeout(() => {
      setIsRefreshing(false);
    }, 1000);
  };

  // Separate effect for auto-selection to prevent interval jumping
  useEffect(() => {
    if (!selectedDPPId && allDPPs.length > 0) {
      setSelectedDPPId(allDPPs[0].id);
    }
  }, [allDPPs]); // Only run when allDPPs list changes, AND remove dependency on selectedDPPId to avoid it triggering itself

  useEffect(() => {
    loadMonitoringData();
    const interval = setInterval(() => {
      loadMonitoringData();
      setLastRefresh(Date.now());
    }, 10000); // 10s for real-time feel
    return () => clearInterval(interval);
  }, []); // Truly only once on mount

  useEffect(() => {
    if (selectedDPP) {
      loadDPPDetails(selectedDPP);
    }
  }, [selectedDPPId, lastRefresh]);

  // Reset session state when switching DPPs to prevent state leakage
  useEffect(() => {
    setSelectedOperationIndex(null);
    setDidHistory([]);
    setRawLog(null);
    setRawWitness(null);
  }, [selectedDPPId]);

  /**
   * Proactive Integrity Check: Detect file-level tampering immediately 
   * when products or logs are loaded/refreshed.
   */
  useEffect(() => {
    // We only perform the deep proactive check for the currently selected product
    // as it requires knowing the raw witness data which is only fetched for the selection.
    if (didHistory.length > 0 && rawWitness && selectedDPP) {
      try {
        const witnessData = JSON.parse(rawWitness);
        const proofs = Array.isArray(witnessData)
          ? witnessData
          : (witnessData.anchoringProofs || witnessData.witnessProofs || []);

        const dppScid = extractSCID(selectedDPP.did).toLowerCase();

        // SAFETY CHECK: Ensure the witness data actually matches the current product's SCID
        // In some cases we can find the SCID in the log or witness metadata
        if (rawLog && !rawLog.toLowerCase().includes(dppScid)) {
          // Data mismatch (likely still loading new product), abort audit to prevent state leak
          return;
        }

        let foundAnyFailure = false;

        // Check ALL anchored operations for this DPP
        didHistory.forEach((op) => {
          const eventId = getEventId(op);
          const vNum = op.version || op.version_id || (op.uri?.includes('version=') ? op.uri.split('version=')[1] : null);
          const vId = vNum ? String(vNum) : '';

          const proof = proofs.find((p: any) =>
            String(p.versionId || p.version_id) === vId ||
            String(p.eventId || p.event_id) === eventId
          );

          if (proof && proof.merkleRoot) {
            // Bypass proactive check only for strictly empty/placeholder hashes
            const leafHash = proof.leafHash || '0x';
            const isPlaceholder = leafHash === '0x' ||
              leafHash.length < 10 ||
              leafHash.startsWith('0x0000');

            if (isPlaceholder) {
              // If it's a placeholder, consider it valid for the demo environment 
              // but don't overwrite if we already have a manual failure
              const key = `${dppScid}-event-${eventId}`;
              setManualVerificationResults(prev => {
                if (prev[key] === false) return prev;
                return { ...prev, [key]: true };
              });
              return;
            }

            if (proof.leafHash) {
              const key = `${dppScid}-event-${eventId}`;

              // NEVER overwrite an existing manual result (especially a 'true' from the visualizer)
              if (manualVerificationResults[key] !== undefined) return;

              // Basic sanity check: leafHash + proof must yield merkleRoot
              // For single-leaf tree (which we have here), leafHash should equal merkleRoot
              if (proof.merkleProof.length === 0) {
                const matches = proof.leafHash.toLowerCase() === proof.merkleRoot.toLowerCase();
                if (!matches) {
                  foundAnyFailure = true;
                  setManualVerificationResults(prev => ({
                    ...prev,
                    [key]: false,
                    [`${dppScid}-version-${vId}`]: false
                  }));
                } else {
                  setManualVerificationResults(prev => ({
                    ...prev,
                    [key]: true
                  }));
                }
              } else {
                setManualVerificationResults(prev => ({
                  ...prev,
                  [key]: true
                }));
              }
            }
          }
        });

        if (foundAnyFailure) {
          console.warn(`[WatcherDashboard] Proactive audit detected TAMPERING for ${dppScid}`);
        }
      } catch (err) {
        // Silently skip if JSON is invalid or incomplete
      }
    }
  }, [didHistory, rawWitness, selectedDPPId]);

  // Auto-select first anchored event once history is loaded
  useEffect(() => {
    if (didHistory.length > 0 && selectedOperationIndex === null) {
      const anchoredIndex = didHistory.findIndex(op => op.witness_proofs);
      setSelectedOperationIndex(anchoredIndex !== -1 ? anchoredIndex : 0);
    }
  }, [didHistory, selectedOperationIndex]);

  async function loadMonitoringData() {
    try {
      const allDPPsData = await enhancedDB.getAllDPPs();
      if (allDPPsData) setAllDPPs(allDPPsData);

      try {
        // Use enhancedDB.getAllAlerts which merges backend and local alerts
        const allAlerts = await enhancedDB.getAllAlerts();
        if (allAlerts) setAlerts(allAlerts);
      } catch (alertErr) {
        console.warn('Failed to load alerts, continuing with empty list:', alertErr);
      }
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

    // Use robust helper to extract integer ID from potentially string identifier
    const eventId = getEventId(flagTargetEvent);
    const numericEventId = parseInt(eventId);

    try {
      await api.watcher.createAlert({
        did: selectedDPP.did,
        event_id: isNaN(numericEventId) ? null : numericEventId,
        reason: flagForm.reason,
        details: flagForm.details || 'Manually flagged by operator',
        reporter: currentRoleDID
      });

      // Invalidate cache and reload
      await enhancedDB.clearAllAlerts();
      await loadMonitoringData();
      setShowFlagModal(false);
    } catch (err) {
      console.error('Failed to report flag:', err);
    }
  }

  async function handleUnflagEvent(eventOverride?: Record<string, unknown>) {
    const targetEvent = eventOverride || flagTargetEvent;
    if (!targetEvent || !selectedDPP) return;

    const dppDid = selectedDPP.did;
    const dppScid = extractSCID(dppDid).toLowerCase();
    const eventId = getEventId(targetEvent);

    try {
      // 1. Delete matching alerts from backend (either for whole DID or specific event)
      await api.watcher.deleteAlerts(dppDid, eventId);

      // 2. Clear manual verification results if any
      setManualVerificationResults(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(key => {
          if (key.toLowerCase().includes(dppScid) && key.includes(eventId)) {
            delete next[key];
          }
        });
        return next;
      });

      // 3. Reload data
      await loadMonitoringData();
      setShowFlagModal(false);
    } catch (err) {
      console.error('Failed to unflag event:', err);
    }
  }

  async function handleResolveAlerts() {
    if (!selectedDPP) return;

    try {
      await api.watcher.deleteAlerts(selectedDPP.did);
      // Invalidate cache and reload
      await enhancedDB.clearAlertsByDID(selectedDPP.did);
      await loadMonitoringData();
    } catch (err) {
      console.error('Failed to resolve alerts:', err);
    }
  }

  /**
   * Automatically create a system alert if a manual verification fails
   */
  async function handleVerificationComplete(result: any) {
    if (selectedDPP && selectedOperationIndex !== null) {
      const dppScid = extractSCID(selectedDPP.did).toLowerCase();
      const dbOp = didHistory[selectedOperationIndex];
      const eventId = getEventId(dbOp);
      const opHash = hashOperation(dbOp);
      const vId = dbOp.version_id || dbOp.version || '';

      console.log(`[WatcherDashboard] Manual audit: index=${selectedOperationIndex}, id=${eventId}, hash=${opHash.substring(0, 8)}, valid=${result.isValid}`);

      setManualVerificationResults(prev => ({
        ...prev,
        // Canonical keys for this specific event card
        [`${dppScid}-event-${eventId}`]: result.isValid,
        [`${dppScid}-hash-${opHash}`]: result.isValid,
        [`${dppScid}-index-${selectedOperationIndex}`]: result.isValid,
        ...(vId ? { [`${dppScid}-version-${vId}`]: result.isValid } : {})
      }));

      if (!result.isValid) {
        const isAlreadyAlerted = alerts.some(a =>
          extractSCID(a.did || '').toLowerCase() === dppScid &&
          String(a.event_id) === eventId
        );

        if (!isAlreadyAlerted) {
          console.log('[WatcherDashboard] Propagating failure to backend...');
          try {
            const numericEventId = parseInt(eventId);
            await api.watcher.createAlert({
              did: selectedDPP.did,
              event_id: isNaN(numericEventId) ? null : numericEventId,
              reason: 'proof_mismatch',
              details: `CRITICAL AUDIT FAILURE: Root mismatch for event ${eventId}. Computed ${result.computedRoot.substring(0, 10)} differs from DLT root ${result.expectedRoot.substring(0, 10)}.`,
              reporter: 'Cryptographic-Audit-Engine'
            });

            // 3. Force state refresh
            await enhancedDB.clearAllAlerts();
            await loadMonitoringData();
            setLastRefresh(Date.now()); // Trigger reload of DPP details
          } catch (err) {
            console.error('[WatcherDashboard] Failed to propagate rejection:', err);
          }
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

        fileProof = proofs.find((p: { versionId?: string; version_id?: string }) =>
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
            onClick={handleReset}
            className={`p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-500 transition-colors ${isRefreshing ? 'opacity-50' : ''}`}
            disabled={isRefreshing}
            title="Refresh Monitoring Data"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
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
                className={`w-full flex items-center justify-between p-3 rounded-lg transition-all text-left group border ${selectedDPPId === dpp.id
                  ? (dpp.integrityScore < 90
                    ? 'bg-red-50 dark:bg-red-900/40 border-red-500 ring-1 ring-red-500 shadow-lg'
                    : 'bg-blue-50 dark:bg-blue-900/40 border-blue-200 dark:border-blue-800 shadow-sm')
                  : (dpp.integrityScore < 90
                    ? 'bg-red-50/30 dark:bg-red-900/10 border-red-200 dark:border-red-900/40'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700 border-transparent')
                  }`}
              >
                <div className="flex items-center gap-3">
                  {dpp.integrityScore < 90 ? (
                    <AlertTriangle className="w-5 h-5 text-red-500 animate-pulse" />
                  ) : (
                    <Package className={`w-5 h-5 ${selectedDPPId === dpp.id ? 'text-blue-600' : 'text-gray-400'}`} />
                  )}
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white text-sm flex items-center gap-2">
                      {dpp.model}
                      {dpp.integrityScore < 90 && (
                        <Flag className="w-4 h-4 text-red-600 fill-red-600 animate-bounce" />
                      )}
                    </div>
                    <div className="text-[10px] uppercase font-mono text-gray-500 dark:text-gray-400">{dpp.scid}</div>
                  </div>
                </div>
                {dpp.integrityScore < 90 && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white shadow-sm animate-bounce">
                    {dpp.alertCount || '!'}
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
                      <span className={`text-sm font-normal px-2 py-0.5 rounded shadow-sm border ${selectedDPP.integrityScore >= 90
                        ? 'bg-green-100 text-green-700 border-green-200'
                        : 'bg-red-100 text-red-700 border-red-200'
                        }`}>
                        Integrity: {selectedDPP.integrityScore}%
                      </span>
                      <span className={`text-xs uppercase font-extrabold px-3 py-1 rounded-full border-2 ${selectedDPP.integrityScore < 90
                        ? 'bg-red-600 text-white border-red-700'
                        : (selectedDPP.lifecycle_status === 'deactivated'
                          ? 'bg-gray-100 text-gray-600 border-gray-300'
                          : 'bg-emerald-100 text-emerald-700 border-emerald-200')
                        }`}>
                        {selectedDPP.integrityScore < 90 ? 'STATUS: REJECTED / TAMPERED' : (selectedDPP.lifecycle_status === 'deactivated' ? 'STATUS: DEACTIVATED' : 'STATUS: ACTIVE (CERTIFIED)')}
                      </span>
                    </h1>
                    <div className="flex items-center gap-4 mt-1">
                      <p className="text-gray-500 text-xs font-mono">{selectedDPP.did}</p>
                      {alerts.filter(a =>
                        extractSCID(a.did || '').toLowerCase() === extractSCID(selectedDPP.did).toLowerCase() && !a.event_id
                      ).map((a, idx) => (
                        <div key={idx} className="flex items-center gap-1.5 px-2 py-0.5 bg-red-600 text-white text-[10px] font-bold rounded animate-pulse uppercase">
                          <AlertTriangle className="w-3 h-3" />
                          {a.reason?.replace(/_/g, ' ')}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="text-right">
                    <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Status</div>
                    <div className={`flex items-center gap-2 font-bold ${selectedDPP.integrityScore < 90
                      ? 'text-red-600 dark:text-red-400'
                      : (selectedDPP.lifecycle_status === 'deactivated' ? 'text-gray-500 dark:text-gray-400' : 'text-green-600 dark:text-green-400')
                      }`}>
                      {selectedDPP.integrityScore < 90 ? (
                        <div className="flex flex-col items-end gap-1">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4" />
                            REJECTED
                          </div>
                          <button
                            onClick={handleResolveAlerts}
                            className="text-[10px] bg-emerald-100 hover:bg-emerald-200 text-emerald-700 px-2 py-1 rounded border border-emerald-300 transition-colors flex items-center gap-1"
                          >
                            <Shield className="w-3 h-3" />
                            RESOLVE ALL
                          </button>
                        </div>
                      ) : (
                        selectedDPP.lifecycle_status === 'deactivated' ? (
                          <>
                            <Power className="w-4 h-4" />
                            DEACTIVATED
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-4 h-4" />
                            ACTIVE
                          </>
                        )
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Tier 2 Tabs */}
              <div className="flex gap-8">
                <button
                  onClick={() => setActiveTab('audit')}
                  className={`pb-4 text-sm font-medium transition-colors relative ${activeTab === 'audit' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 hover:text-gray-700'
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
                  className={`pb-4 text-sm font-medium transition-colors relative ${activeTab === 'resources' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 hover:text-gray-700'
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
                        scid={extractSCID(selectedDPP.did)}
                        history={didHistory}
                        selectedProof={fileBasedVerificationData?.fileProof}
                        localOperation={fileBasedVerificationData?.fileOp}
                        onVerificationComplete={handleVerificationComplete}
                        onReset={handleReset}
                        alerts={alerts.filter(a => extractSCID(a.did || '').toLowerCase() === extractSCID(selectedDPP.did).toLowerCase())}
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
                        const dppScid = extractSCID(selectedDPP.did).toLowerCase();
                        const eventId = getEventId(op);
                        const opHash = hashOperation(op);

                        // Canonical version ID extraction
                        let vNum = op.version || op.version_id || (op.uri?.includes('version=') ? op.uri.split('version=')[1] : null);
                        if (!vNum && op.uri?.includes('operation-')) {
                          vNum = op.uri.split('operation-')[1];
                        }
                        const vId = vNum ? String(vNum) : '';

                        // Check backend alerts
                        const isEventFlagged = alerts.some(a =>
                          extractSCID(a.did || '').toLowerCase() === dppScid &&
                          (a.event_id !== null && (String(a.event_id) === eventId || (vId && String(a.event_id) === vId)))
                        );

                        const isGlobalFlagged = alerts.some(a =>
                          extractSCID(a.did || '').toLowerCase() === dppScid && !a.event_id
                        );

                        // Check local results: Match by Event ID, Hash, Index, or Version
                        const manualResult =
                          manualVerificationResults[`${dppScid}-event-${eventId}`] ??
                          manualVerificationResults[`${dppScid}-hash-${opHash}`] ??
                          manualVerificationResults[`${dppScid}-index-${idx}`] ??
                          (vId ? manualVerificationResults[`${dppScid}-version-${vId}`] : undefined);

                        const isManualFailure = manualResult === false;
                        const isManualSuccess = manualResult === true;

                        // RE-CHECK: If the visualizer says it's invalid, we MUST show it here.
                        // If it says it's VALID, we should SUPPRESS global flags for this specific event view.
                        const isFlagged = (isEventFlagged || isGlobalFlagged || isManualFailure) && !isManualSuccess;

                        // IMPORTANT: An event is only "Verified" if it's anchored AND NO AUDIT HAS FAILED IT
                        const isAnchored = Boolean(op.witness_proofs?.batchId !== undefined && op.witness_proofs?.merkleRoot);
                        const showVerifiedBadge = isAnchored && !isFlagged;

                        return (
                          <div
                            key={idx}
                            onClick={() => setSelectedOperationIndex(idx)}
                            className={`group relative bg-white dark:bg-gray-800 rounded-xl border p-4 transition-all cursor-pointer ${selectedOperationIndex === idx
                              ? 'border-blue-500 ring-2 ring-blue-500 shadow-lg translate-x-1'
                              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                              } ${isFlagged ? 'bg-red-50 dark:bg-red-900/10 border-red-500 ring-2 ring-red-500 shadow-red-500/20' : ''}`}
                          >
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <div className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${op.attestation_type.includes('creation') ? 'bg-purple-100 text-purple-700' :
                                  op.attestation_type.includes('transfer') ? 'bg-orange-100 text-orange-700' :
                                    'bg-blue-100 text-blue-700'
                                  }`}>
                                  {op.attestation_type.replace(/_/g, ' ')}
                                </div>
                                <span className="text-xs text-gray-400">{new Date(op.timestamp).toLocaleString()}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                {showVerifiedBadge && (
                                  <div className="flex items-center gap-1 text-emerald-600 text-[10px] font-extrabold px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 rounded-full border border-emerald-200 dark:border-emerald-800/50">
                                    <ShieldCheck className="w-3 h-3" />
                                    VERIFIED
                                  </div>
                                )}
                                {isFlagged && (
                                  <div className="flex items-center gap-1 text-red-600 text-xs font-bold px-2 py-1 bg-red-100 dark:bg-red-900/20 rounded-full border border-red-300 animate-in fade-in zoom-in duration-300">
                                    <Flag className="w-3 h-3" />
                                    REJECTED
                                  </div>
                                )}

                                {(isEventFlagged || isGlobalFlagged) && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleUnflagEvent(op);
                                    }}
                                    className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-600 rounded-full border border-emerald-200 dark:border-emerald-800 transition-all shadow-sm group/btn z-10"
                                    title="Resolve / Unflag"
                                  >
                                    <FlagOff className="w-3.5 h-3.5 transition-transform group-hover/btn:scale-110" />
                                    <span className="text-[10px] font-extrabold uppercase tracking-tight">Unflag</span>
                                  </button>
                                )}

                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setFlagTargetEvent(op);
                                    setShowFlagModal(true);
                                  }}
                                  className={`p-2 rounded-full transition-all hover:bg-gray-100 opacity-0 group-hover:opacity-100 ${isFlagged ? 'text-red-500' : 'text-gray-400'
                                    }`}
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
                  onChange={(e) => setFlagForm({ ...flagForm, reason: e.target.value })}
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
                  onChange={(e) => setFlagForm({ ...flagForm, details: e.target.value })}
                  placeholder="Describe your findings..."
                  className="w-full bg-gray-100 dark:bg-gray-700 border-none rounded-lg p-3 text-sm focus:ring-2 focus:ring-red-500"
                />
              </div>
            </div>

            <div className="p-6 bg-gray-50 dark:bg-gray-900/50 flex gap-3">
              <button
                onClick={() => setShowFlagModal(false)}
                className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>

              <button
                onClick={handleFlagEvent}
                className="px-4 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors shadow-lg shadow-red-500/20 flex-1"
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

