import { useState, useEffect } from 'react';
import { Activity, AlertCircle, CheckCircle, TrendingUp, Shield, Eye, AlertTriangle, Info, ChevronDown, ChevronUp, Package, FileText, Hash, EyeOff, GitBranch } from 'lucide-react';
import { hybridDataStore as enhancedDB } from '../../lib/data/hybridDataStore';
import { localDB } from '../../lib/data/localData';
import { getDIDOperationsHistory } from '../../lib/operations/didOperationsLocal';
import { useRole } from '../../lib/utils/roleContext';
import { WatcherAlert, DPP } from '../../lib/data/localData';
import MerkleTreeVisualizer from '../visualizations/MerkleTreeVisualizer';

interface MonitoredDPP extends DPP {
  integrityScore: number;
  lastVerified: string;
  alertCount: number;
}

interface GroupedMonitoredDPPs {
  dppId: string;
  dppName: string;
  dppType: 'main' | 'component';
  dpp: MonitoredDPP;
  components?: { name: string; dpp: MonitoredDPP }[];
}

export default function WatcherDashboard() {
  const { currentRoleDID } = useRole();
  const [monitoredDPPs, setMonitoredDPPs] = useState<MonitoredDPP[]>([]);
  const [alerts, setAlerts] = useState<WatcherAlert[]>([]);
  const [filter, setFilter] = useState<'all' | 'selected' | 'critical' | 'warning' | 'info' | 'resolved'>('all');
  const [expandedDPP, setExpandedDPP] = useState<string | null>(null);
  const [expandedComponents, setExpandedComponents] = useState<Set<string>>(new Set());
  const [selectedDPPForDetails, setSelectedDPPForDetails] = useState<MonitoredDPP | null>(null);
  const [didHistory, setDidHistory] = useState<any[]>([]);
  const [attestations, setAttestations] = useState<any[]>([]);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [showMerkleTree, setShowMerkleTree] = useState(true);
  const [alertModalDPP, setAlertModalDPP] = useState<MonitoredDPP | null>(null);
  const [alertForm, setAlertForm] = useState({
    severity: 'warning' as 'critical' | 'warning' | 'info',
    type: 'signature_mismatch' as string,
    description: ''
  });
  const [stats, setStats] = useState({
    monitored: 0,
    criticalAlerts: 0,
    warningAlerts: 0,
    averageIntegrity: 0,
  });

  useEffect(() => {
    loadMonitoringData();
    const interval = setInterval(loadMonitoringData, 10000);
    return () => clearInterval(interval);
  }, []);

  async function loadMonitoringData() {
    const allDPPs = await enhancedDB.getAllDPPs();
    const allAlerts = await localDB.getAlerts();
    const watcherAlerts = allAlerts.filter(a => a.watcher_did === currentRoleDID);

    // CRITICAL: Limit the number of DPPs monitored to prevent browser freeze with huge datasets
    // In a real system this would be paginated or handled by a backend service
    const dppsToMonitor = allDPPs.slice(0, 50);

    // Calculate integrity scores for each DPP with verification
    const monitored: MonitoredDPP[] = await Promise.all(
      dppsToMonitor.map(async (dpp) => {
        const dppAlerts = watcherAlerts.filter(a => a.dpp_id === dpp.id);

        // Perform continuous verification (Watcher's core function)
        await performContinuousVerification(dpp, dppAlerts);

        const integrityScore = calculateIntegrityScore(dpp, dppAlerts);

        return {
          ...dpp,
          integrityScore,
          lastVerified: new Date().toISOString(),
          alertCount: dppAlerts.filter(a => a.severity === 'critical' || a.severity === 'warning').length,
        };
      })
    );

    setMonitoredDPPs(monitored);
    
    setAlerts(await localDB.getAlerts().then(alerts => alerts.filter(a => a.watcher_did === currentRoleDID)));

    // Calculate stats
    const updatedAlerts = await localDB.getAlerts().then(alerts => alerts.filter(a => a.watcher_did === currentRoleDID));
    const criticalCount = updatedAlerts.filter(a => a.severity === 'critical' && a.status === 'active').length;
    const warningCount = updatedAlerts.filter(a => a.severity === 'warning' && a.status === 'active').length;
    const avgIntegrity = monitored.length > 0
      ? monitored.reduce((sum, dpp) => sum + dpp.integrityScore, 0) / monitored.length
      : 100;

    setStats({
      monitored: monitored.length,
      criticalAlerts: criticalCount,
      warningAlerts: warningCount,
      averageIntegrity: avgIntegrity,
    });
  }

  async function performContinuousVerification(dpp: DPP, existingAlerts: WatcherAlert[]) {
    // Watchers continuously verify DID-log integrity
    const history = await getDIDOperationsHistory(dpp.id);
    if (!history.success) return;

    const attestations = await enhancedDB.getAttestationsByDID(dpp.did);

    // 1. Recompute hashes across all entries
    const hashChainValid = verifyHashChainContinuous(history.operations, existingAlerts, dpp);

    // 2. Validate controller signatures
    const controllerProofsValid = verifyControllerProofs(attestations, existingAlerts, dpp);

    // 3. Validate witness proofs
    const witnessProofsValid = verifyWitnessProofs(attestations, existingAlerts, dpp);

    // 4. Compare resulting state with expected (e.g., keys, owner)
    const stateConsistent = verifyStateConsistency(dpp, history.operations, existingAlerts);

    // Log any new inconsistencies as alerts
    if (!hashChainValid || !controllerProofsValid || !witnessProofsValid || !stateConsistent) {
      console.log(`Watcher detected inconsistencies in ${dpp.did}`);
    }
  }

  function verifyHashChainContinuous(operations: any[], existingAlerts: WatcherAlert[], dpp: DPP): boolean {
    // Check if hash chain is intact
    if (operations.length <= 1) return true;

    // Sort operations by timestamp ascending for chain verification
    // (getDIDOperationsHistory returns them descending)
    const sortedOps = [...operations].sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    for (let i = 1; i < sortedOps.length; i++) {
      const current = sortedOps[i];
      const previous = sortedOps[i - 1];

      // Check if timestamps are sequential (with 1s tolerance for clock drift)
      const currentTime = new Date(current.timestamp).getTime();
      const previousTime = new Date(previous.timestamp).getTime();

      if (currentTime < previousTime - 1000) {
        // Create alert if not already exists
        const alertExists = existingAlerts.some(a =>
          a.alert_type === 'hash_chain_broken' && a.status === 'active'
        );

        if (!alertExists) {
          localDB.insertAlert({
            watcher_id: currentRoleDID,
            watcher_did: currentRoleDID,
            dpp_id: dpp.id,
            did: dpp.did,
            alert_type: 'hash_chain_broken',
            severity: 'critical',
            description: 'Hash chain integrity compromised: timestamps out of order',
            message: 'Hash chain integrity compromised',
            details: { operation_index: i },
            status: 'active',
            resolved: false,
            detected_at: new Date().toISOString(),
          });
        }

        return false;
      }
    }

    return true;
  }

  function verifyControllerProofs(attestations: any[], existingAlerts: WatcherAlert[], dpp: DPP): boolean {
    // Validate all controller signatures
    const criticalOps = attestations.filter(a =>
      a.attestation_type === 'ownership_change' ||
      a.attestation_type === 'key_rotation' ||
      a.attestation_type === 'did_creation'
    );

    for (const attestation of criticalOps) {
      if (!attestation.signature || attestation.signature.startsWith('pending-')) {
        const alertExists = existingAlerts.some(a =>
          a.alert_type === 'missing_controller_signature' && a.status === 'active'
        );

        if (!alertExists && attestation.approval_status === 'approved') {
          localDB.insertAlert({
            watcher_id: currentRoleDID,
            watcher_did: currentRoleDID,
            dpp_id: dpp.id,
            did: dpp.did,
            alert_type: 'missing_controller_signature',
            severity: 'critical',
            description: `Missing or invalid controller signature on ${attestation.attestation_type}`,
            message: 'Missing controller signature',
            details: { attestation_id: attestation.id },
            status: 'active',
            resolved: false,
            detected_at: new Date().toISOString(),
          });
        }

        return false;
      }
    }

    return true;
  }

  function verifyWitnessProofs(attestations: any[], existingAlerts: WatcherAlert[], dpp: DPP): boolean {
    // Validate witness attestations
    const witnessRequired = attestations.filter(a =>
      a.attestation_type === 'ownership_change' ||
      a.attestation_type === 'key_rotation'
    );

    for (const attestation of witnessRequired) {
      if (attestation.approval_status === 'rejected') {
        const alertExists = existingAlerts.some(a =>
          a.alert_type === 'rejected_by_witness' && a.status === 'active'
        );

        if (!alertExists) {
          localDB.insertAlert({
            watcher_id: currentRoleDID,
            watcher_did: currentRoleDID,
            dpp_id: dpp.id,
            did: dpp.did,
            alert_type: 'rejected_by_witness',
            severity: 'warning',
            description: `Operation ${attestation.attestation_type} was rejected by witness`,
            message: 'Operation rejected by witness',
            details: { attestation_id: attestation.id },
            status: 'active',
            resolved: false,
            detected_at: new Date().toISOString(),
          });
        }
      }

      if (!attestation.witness_did && attestation.approval_status === 'approved') {
        const alertExists = existingAlerts.some(a =>
          a.alert_type === 'missing_witness_proof' && a.status === 'active'
        );

        if (!alertExists) {
          localDB.insertAlert({
            watcher_id: currentRoleDID,
            watcher_did: currentRoleDID,
            dpp_id: dpp.id,
            did: dpp.did,
            alert_type: 'missing_witness_proof',
            severity: 'critical',
            description: `Missing witness proof for ${attestation.attestation_type}`,
            message: 'Missing witness proof',
            details: { attestation_id: attestation.id },
            status: 'active',
            resolved: false,
            detected_at: new Date().toISOString(),
          });
        }

        return false;
      }
    }

    return true;
  }

  function verifyStateConsistency(dpp: DPP, operations: any[], existingAlerts: WatcherAlert[]): boolean {
    // Compare current state with expected state from history
    const ownershipChanges = operations.filter(op =>
      op.attestation_type === 'ownership_change' && op.approval_status === 'approved'
    );

    if (ownershipChanges.length > 0) {
      const lastOwnershipChange = ownershipChanges[ownershipChanges.length - 1];
      const expectedOwner = lastOwnershipChange.attestation_data?.newOwner;

      if (expectedOwner && dpp.owner !== expectedOwner) {
        const alertExists = existingAlerts.some(a =>
          a.alert_type === 'state_mismatch' && a.status === 'active'
        );

        if (!alertExists) {
          localDB.insertAlert({
            watcher_id: currentRoleDID,
            watcher_did: currentRoleDID,
            dpp_id: dpp.id,
            did: dpp.did,
            alert_type: 'state_mismatch',
            severity: 'critical',
            description: `Owner mismatch: DID document shows ${dpp.owner} but history indicates ${expectedOwner}`,
            message: 'State inconsistency detected',
            details: { expected_owner: expectedOwner, actual_owner: dpp.owner },
            status: 'active',
            resolved: false,
            detected_at: new Date().toISOString(),
          });
        }

        return false;
      }
    }

    return true;
  }
  function calculateIntegrityScore(dpp: DPP, alerts: WatcherAlert[]): number {
    let score = 100;

    // Reduce score based on active alerts
    const activeAlerts = alerts.filter(a => a.status === 'active');
    activeAlerts.forEach(alert => {
      if (alert.severity === 'critical') score -= 20;
      else if (alert.severity === 'warning') score -= 10;
      else if (alert.severity === 'info') score -= 2;
    });

    // Check lifecycle status
    if (dpp.lifecycle_status === 'disposed' || dpp.lifecycle_status === 'recycled' || dpp.lifecycle_status === 'end_of_life') {
      score -= 5;
    }

    return Math.max(0, Math.min(100, score));
  }

  async function createAlert() {
    if (!alertModalDPP || !alertForm.description.trim()) return;

    // Check if there's already an active alert of this type for this DPP
    const existingAlert = alerts.find(a =>
      a.dpp_id === alertModalDPP.id &&
      a.alert_type === alertForm.type &&
      a.status === 'active'
    );

    if (existingAlert) {
      alert('An active alert of this type already exists for this product.');
      return;
    }

    await localDB.insertAlert({
      watcher_id: currentRoleDID,
      watcher_did: currentRoleDID,
      dpp_id: alertModalDPP.id,
      did: alertModalDPP.did,
      alert_type: alertForm.type,
      severity: alertForm.severity,
      description: alertForm.description,
      message: alertForm.description,
      details: {},
      status: 'active',
      resolved: false,
      detected_at: new Date().toISOString(),
    });

    // Reset and close modal
    setShowAlertModal(false);
    setAlertModalDPP(null);
    setAlertForm({ severity: 'warning', type: 'signature_mismatch', description: '' });
    await loadMonitoringData();
  }

  async function resolveAlert(alertId: string) {
    // Update the alert in the database
    await localDB.updateAlert(alertId, {
      status: 'resolved',
      resolved: true
    });

    // Reload data to get fresh stats
    await loadMonitoringData();
  }

  const getFilteredAlerts = () => {
    if (filter === 'selected' && selectedDPPForDetails) {
      // Show alerts for selected product only
      return alerts.filter(a => a.dpp_id === selectedDPPForDetails.id && a.status === 'active');
    }
    if (filter === 'all') return alerts.filter(a => a.status === 'active');
    if (filter === 'resolved') return alerts.filter(a => a.status === 'resolved');
    return alerts.filter(a => a.severity === filter && a.status === 'active');
  };

  const filteredAlerts = getFilteredAlerts();

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      case 'info':
        return <Info className="w-5 h-5 text-blue-600" />;
      default:
        return <CheckCircle className="w-5 h-5 text-green-600" />;
    }
  };

  const getIntegrityColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  // Group monitored DPPs hierarchically
  const groupedMonitoredDPPs = (): GroupedMonitoredDPPs[] => {
    const groups = new Map<string, GroupedMonitoredDPPs>();

    // Build parent-child relationships
    const dppMap = new Map(monitoredDPPs.map(dpp => [dpp.id, dpp]));
    const didToDppMap = new Map(monitoredDPPs.map(dpp => [dpp.did, dpp]));
    const parentMap = new Map<string, string>();

    for (const dpp of monitoredDPPs) {
      if (dpp.type === 'component') {
        if (dpp.parent_did) {
          const parentDpp = didToDppMap.get(dpp.parent_did);
          if (parentDpp) {
            parentMap.set(dpp.id, parentDpp.id);
          }
        } else if (dpp.metadata?.parent_dpp_id) {
          parentMap.set(dpp.id, String(dpp.metadata.parent_dpp_id));
        }
      }
    }

    monitoredDPPs.forEach((dpp) => {
      // Determine grouping
      let groupDppId = dpp.id;
      let groupDppModel = dpp.model;
      let isComponent = false;

      if (dpp.type === 'component' && parentMap.has(dpp.id)) {
        const parentId = parentMap.get(dpp.id)!;
        const parentDpp = dppMap.get(parentId);
        if (parentDpp) {
          groupDppId = parentDpp.id;
          groupDppModel = parentDpp.model;
          isComponent = true;
        }
      }

      // Create group if doesn't exist
      if (!groups.has(groupDppId)) {
        const mainDpp = dppMap.get(groupDppId);
        groups.set(groupDppId, {
          dppId: groupDppId,
          dppName: groupDppModel,
          dppType: 'main',
          dpp: mainDpp || dpp,
          components: [],
        });
      }

      const group = groups.get(groupDppId)!;

      // Add to components or update main DPP
      if (isComponent) {
        group.components!.push({ name: dpp.model, dpp });
      } else if (dpp.id === groupDppId) {
        group.dpp = dpp;
      }
    });

    // Include all groups that are main products (type is 'main')
    const validGroups = Array.from(groups.values()).filter(group => {
      // Show all main product groups and groups that have a valid DPP
      const hasValidDpp = group.dpp && group.dpp.type === 'main';
      const hasComponents = group.components && group.components.length > 0;
      return hasValidDpp || hasComponents;
    });

    return validGroups;
  };

  async function loadDPPDetails(dpp: MonitoredDPP) {
    setSelectedDPPForDetails(dpp);
    setFilter('selected'); // Auto-switch to selected product tab

    // Load DID history (operations) - pass DPP ID not DID
    const historyResult = await getDIDOperationsHistory(dpp.id);
    setDidHistory(historyResult.success ? historyResult.operations : []);

    // Load attestations
    const atts = await enhancedDB.getAttestationsByDID(dpp.did);
    setAttestations(atts);
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6 pt-20 transition-colors">
      <div className="max-w-[1920px] mx-auto">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 mb-6 transition-colors">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-3 bg-rose-100 dark:bg-rose-900/50 rounded-lg">
                  <Activity className="w-8 h-8 text-rose-600 dark:text-rose-400" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Watcher Node Dashboard</h1>
                  <p className="text-gray-600 dark:text-gray-400">Monitor integrity and detect anomalies</p>
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500 dark:text-gray-400">Your Watcher DID</div>
              <div className="text-xs font-mono text-gray-900 dark:text-gray-200 mt-1">{currentRoleDID}</div>
            </div>
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 transition-colors">
            <div className="flex items-center gap-3">
              <Eye className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.monitored}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Monitored DPPs</div>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 transition-colors">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.criticalAlerts}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Critical Alerts</div>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 transition-colors">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-8 h-8 text-yellow-600 dark:text-yellow-400" />
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.warningAlerts}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Warnings</div>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 transition-colors">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-8 h-8 text-green-600 dark:text-green-400" />
              <div>
                <div className={`text-2xl font-bold ${getIntegrityColor(stats.averageIntegrity)}`}>
                  {stats.averageIntegrity.toFixed(1)}%
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Avg. Integrity</div>
              </div>
            </div>
          </div>
        </div>

        {/* Merkle Tree Integrity Visualization */}
        <div className="mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 transition-colors overflow-hidden">
            <div className="border-b border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <GitBranch className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                DID Event Integrity: Merkle Proof Visualizer
                {selectedDPPForDetails && (
                  <span className="text-sm font-normal text-gray-500 ml-2">
                    Monitoring: {selectedDPPForDetails.model}
                  </span>
                )}
              </h2>
              <button
                onClick={() => setShowMerkleTree(!showMerkleTree)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                {showMerkleTree ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                {showMerkleTree ? 'Hide Tree' : 'Show Tree'}
              </button>
            </div>
            {showMerkleTree ? (
              <div className="p-4 bg-gray-50 dark:bg-gray-900/40">
                {selectedDPPForDetails ? (
                  <MerkleTreeVisualizer 
                    selectedDPPDid={selectedDPPForDetails.did}
                    operations={didHistory}
                    alerts={alerts.filter(a => a.did === selectedDPPForDetails.did)}
                  />
                ) : (
                  <div className="py-12 text-center">
                    <div className="inline-flex items-center justify-center p-4 bg-gray-100 dark:bg-gray-800 rounded-full mb-4">
                      <Shield className="w-8 h-8 text-gray-400" />
                    </div>
                    <p className="text-gray-500 dark:text-gray-400">Select a product below to visualize its Merkle Integrity Tree</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 text-center text-sm text-gray-500">
                Visualizer is hidden. Click "Show Tree" to inspect cryptographic integrity.
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Monitored DPPs - Left Column */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 transition-colors">
            <div className="border-b border-gray-200 dark:border-gray-700 p-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                Monitored Products
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Click a product to view DID details</p>
            </div>
            <div className="p-4 max-h-[800px] overflow-y-auto">
              {monitoredDPPs.length === 0 ? (
                <div className="text-center py-8">
                  <Eye className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-500 dark:text-gray-400">No products monitored yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {groupedMonitoredDPPs().map((group) => {
                    const isExpanded = expandedDPP === group.dppId;
                    const dpp = group.dpp;

                    return (
                      <div key={group.dppId} className="border border-gray-200 rounded-lg overflow-hidden">
                        {/* Window/Main Product Header */}
                        <div
                          className={`bg-blue-100 dark:bg-gray-800 p-3 cursor-pointer hover:bg-blue-200 dark:hover:bg-gray-700 transition-colors ${selectedDPPForDetails?.id === dpp.id ? 'ring-2 ring-blue-500 dark:ring-blue-400' : ''
                            }`}
                          onClick={() => {
                            setExpandedDPP(isExpanded ? null : group.dppId);
                            loadDPPDetails(dpp);
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 flex-1">
                              <Package className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                              <div className="flex-1">
                                <h3 className="font-semibold text-blue-900 dark:text-white">{dpp.model}</h3>
                                <p className="text-xs text-blue-600 dark:text-blue-400">
                                  {dpp.type} • {group.components?.length || 0} component{(group.components?.length || 0) !== 1 ? 's' : ''}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="text-right">
                                <div className={`text-xl font-bold ${getIntegrityColor(dpp.integrityScore)}`}>
                                  {dpp.integrityScore}%
                                </div>
                                <div className="text-xs text-gray-500">Integrity</div>
                              </div>
                              {isExpanded ? (
                                <ChevronUp className="w-5 h-5 text-blue-600" />
                              ) : (
                                <ChevronDown className="w-5 h-5 text-blue-600" />
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Window Content - Collapsible */}
                        {isExpanded && (
                          <>
                            {/* Main Product Details */}
                            <div className="bg-white p-3 border-b border-gray-200">
                              {dpp.alertCount > 0 && (
                                <div className="flex items-center gap-2 text-sm text-red-600 mb-3">
                                  <AlertCircle className="w-4 h-4" />
                                  {dpp.alertCount} active alert{dpp.alertCount !== 1 ? 's' : ''}
                                </div>
                              )}

                              <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                                <div>
                                  <span className="text-gray-600">Status:</span>
                                  <span className="ml-2 text-gray-900">{dpp.lifecycle_status}</span>
                                </div>
                                <div>
                                  <span className="text-gray-600">Last Verified:</span>
                                  <span className="ml-2 text-gray-900">
                                    {new Date(dpp.lastVerified).toLocaleTimeString()}
                                  </span>
                                </div>
                              </div>

                              <div className="flex gap-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setAlertModalDPP(dpp);
                                    setAlertForm({ severity: 'warning', type: 'did_history_anomaly', description: '' });
                                    setShowAlertModal(true);
                                  }}
                                  className="px-3 py-1.5 text-sm bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200"
                                >
                                  Report Issue
                                </button>
                              </div>
                            </div>

                            {/* Component Sub-DPPs */}
                            {group.components && group.components.map((component) => {
                              const componentKey = `${group.dppId}-${component.name}`;
                              const isComponentExpanded = expandedComponents.has(componentKey);
                              const compDpp = component.dpp;

                              return (
                                <div key={component.name} className="border-t border-gray-300">
                                  {/* Component Header */}
                                  <div
                                    className={`bg-purple-100 px-4 py-2 cursor-pointer hover:bg-purple-200 transition-colors ${selectedDPPForDetails?.id === compDpp.id ? 'ring-2 ring-purple-500' : ''
                                      }`}
                                    onClick={() => {
                                      const newExpanded = new Set(expandedComponents);
                                      if (isComponentExpanded) {
                                        newExpanded.delete(componentKey);
                                      } else {
                                        newExpanded.add(componentKey);
                                      }
                                      setExpandedComponents(newExpanded);
                                      loadDPPDetails(compDpp);
                                    }}
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-3 flex-1">
                                        <Shield className="w-4 h-4 text-purple-600" />
                                        <div className="flex-1">
                                          <h4 className="font-semibold text-purple-900 text-sm">{component.name}</h4>
                                          <p className="text-xs text-purple-600">component</p>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-3">
                                        <div className="text-right">
                                          <div className={`text-lg font-bold ${getIntegrityColor(compDpp.integrityScore)}`}>
                                            {compDpp.integrityScore}%
                                          </div>
                                        </div>
                                        {isComponentExpanded ? (
                                          <ChevronUp className="w-4 h-4 text-purple-600" />
                                        ) : (
                                          <ChevronDown className="w-4 h-4 text-purple-600" />
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Component Details */}
                                  {isComponentExpanded && (
                                    <div className="bg-white p-3">
                                      {compDpp.alertCount > 0 && (
                                        <div className="flex items-center gap-2 text-sm text-red-600 mb-3">
                                          <AlertCircle className="w-4 h-4" />
                                          {compDpp.alertCount} active alert{compDpp.alertCount !== 1 ? 's' : ''}
                                        </div>
                                      )}

                                      <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                                        <div>
                                          <span className="text-gray-600">Status:</span>
                                          <span className="ml-2 text-gray-900">{compDpp.lifecycle_status}</span>
                                        </div>
                                        <div>
                                          <span className="text-gray-600">Last Verified:</span>
                                          <span className="ml-2 text-gray-900">
                                            {new Date(compDpp.lastVerified).toLocaleTimeString()}
                                          </span>
                                        </div>
                                      </div>

                                      <div className="flex gap-2">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setAlertModalDPP(compDpp);
                                            setAlertForm({ severity: 'warning', type: 'did_history_anomaly', description: '' });
                                            setShowAlertModal(true);
                                          }}
                                          className="px-3 py-1.5 text-xs bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200"
                                        >
                                          Report Issue
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* DID Details Panel - Middle Column */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 transition-colors">
            <div className="border-b border-gray-200 dark:border-gray-700 p-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-green-600 dark:text-green-400" />
                DID Verification Details
              </h2>
              {selectedDPPForDetails && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{selectedDPPForDetails.model}</p>
              )}
            </div>
            <div className="p-4 max-h-[800px] overflow-y-auto">
              {!selectedDPPForDetails ? (
                <div className="text-center py-12">
                  <Eye className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-500 dark:text-gray-400">Select a product to view DID details</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">Click on any product to inspect signatures and hashes</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* DID Information */}
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-2 text-sm">DID Information</h3>
                    <div className="space-y-2 text-xs">
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">DID:</span>
                        <p className="font-mono text-gray-900 dark:text-gray-200 break-all mt-1">{selectedDPPForDetails.did}</p>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Owner:</span>
                        <p className="font-mono text-gray-900 dark:text-gray-200 break-all mt-1">{selectedDPPForDetails.owner}</p>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Status:</span>
                        <span className="ml-2 px-2 py-0.5 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 rounded">{selectedDPPForDetails.lifecycle_status}</span>
                      </div>
                    </div>
                  </div>

                  {/* DID Operations History */}
                  <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-3">
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-2 text-sm flex items-center gap-2">
                      <Activity className="w-4 h-4" />
                      DID Operations History ({didHistory.length})
                    </h3>
                    {didHistory.length === 0 ? (
                      <p className="text-xs text-gray-500 dark:text-gray-400">No DID operations recorded</p>
                    ) : (
                      <div className="space-y-2">
                        {didHistory.map((op: any, idx: number) => (
                          <div key={idx} className="bg-white dark:bg-gray-800 rounded p-2 text-xs">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-semibold text-blue-900 dark:text-blue-300">{op.attestation_type.replace(/_/g, ' ').toUpperCase()}</span>
                              <span className="text-gray-500 dark:text-gray-400">{new Date(op.timestamp).toLocaleString()}</span>
                            </div>
                            <div className="space-y-1">
                              <div>
                                <span className="text-gray-600 dark:text-gray-400">Witness:</span>
                                <p className="font-mono text-gray-900 dark:text-gray-200 break-all">{op.witness_did}</p>
                              </div>
                              <div>
                                <span className="text-gray-600 dark:text-gray-400">Signature:</span>
                                <p className="font-mono text-gray-900 dark:text-gray-200 break-all">{op.signature}</p>
                              </div>
                              {op.approval_status && (
                                <div>
                                  <span className="text-gray-600 dark:text-gray-400">Status:</span>
                                  <span className={`ml-2 px-2 py-0.5 rounded ${op.approval_status === 'approved' ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300' :
                                    op.approval_status === 'pending' ? 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300' :
                                      'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300'
                                    }`}>{op.approval_status}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Attestations */}
                  <div className="bg-purple-50 dark:bg-purple-900/30 rounded-lg p-3">
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-2 text-sm flex items-center gap-2">
                      <Hash className="w-4 h-4" />
                      All Attestations ({attestations.length})
                    </h3>
                    {attestations.length === 0 ? (
                      <p className="text-xs text-gray-500 dark:text-gray-400">No attestations found</p>
                    ) : (
                      <div className="space-y-2">
                        {attestations.map((att: any, idx: number) => (
                          <div key={idx} className="bg-white dark:bg-gray-800 rounded p-2 text-xs">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-semibold text-purple-900 dark:text-purple-300">{att.attestation_type.replace(/_/g, ' ').toUpperCase()}</span>
                              <span className="text-gray-500 dark:text-gray-400">{new Date(att.timestamp).toLocaleString()}</span>
                            </div>
                            <div className="space-y-1">
                              <div>
                                <span className="text-gray-600 dark:text-gray-400">Witness DID:</span>
                                <p className="font-mono text-gray-900 dark:text-gray-200 break-all">{att.witness_did}</p>
                              </div>
                              <div>
                                <span className="text-gray-600 dark:text-gray-400">Signature:</span>
                                <p className="font-mono text-gray-900 dark:text-gray-200 break-all bg-gray-50 dark:bg-gray-700 p-1 rounded">{att.signature}</p>
                              </div>
                              {att.attestation_data && Object.keys(att.attestation_data).length > 0 && (
                                <div>
                                  <span className="text-gray-600 dark:text-gray-400">Data Hash:</span>
                                  <p className="font-mono text-gray-900 dark:text-gray-200 break-all bg-gray-50 dark:bg-gray-700 p-1 rounded">
                                    {JSON.stringify(att.attestation_data).substring(0, 64)}...
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Alerts - Right Column */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 transition-colors">
            <div className="border-b border-gray-200 dark:border-gray-700">
              <div className="flex">
                {[
                  { id: 'all', label: 'All Alerts', count: alerts.filter(a => a.status === 'active').length },
                  ...(selectedDPPForDetails ? [{
                    id: 'selected',
                    label: selectedDPPForDetails.model || 'Selected',
                    count: alerts.filter(a => a.dpp_id === selectedDPPForDetails.id && a.status === 'active').length
                  }] : []),
                  { id: 'critical', label: 'Critical', count: alerts.filter(a => a.severity === 'critical' && a.status === 'active').length },
                  { id: 'warning', label: 'Warning', count: alerts.filter(a => a.severity === 'warning').length },
                  { id: 'resolved', label: 'Resolved', count: alerts.filter(a => a.status === 'resolved').length },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setFilter(tab.id as any)}
                    className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${filter === tab.id
                      ? 'bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white border-b-2 border-blue-600'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                  >
                    {tab.label} ({tab.count})
                  </button>
                ))}
              </div>
            </div>

            <div className="p-4 min-h-[800px] max-h-[800px] overflow-y-auto">
              {filteredAlerts.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-500 dark:text-gray-400">No alerts to display</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredAlerts.map((alert) => {
                    const dpp = monitoredDPPs.find(d => d.id === alert.dpp_id);
                    return (
                      <div
                        key={alert.id}
                        className={`border rounded-lg p-4 ${alert.severity === 'critical'
                          ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/30'
                          : alert.severity === 'warning'
                            ? 'border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/30'
                            : 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/30'
                          }`}
                      >
                        <div className="flex items-start gap-3">
                          {getSeverityIcon(alert.severity)}
                          <div className="flex-1">
                            <div className="flex items-start justify-between mb-1">
                              <div>
                                <h3 className="font-semibold text-gray-900 dark:text-white">
                                  {alert.alert_type.replace(/_/g, ' ').toUpperCase()}
                                </h3>
                                <p className="font-semibold text-sm text-white">{dpp?.model || 'Unknown Product'}</p>
                              </div>
                              <span className={`px-2 py-1 text-xs rounded ${alert.status === 'active'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-green-100 text-green-700'
                                }`}>
                                {alert.status}
                              </span>
                            </div>
                            <p className="text-sm text-gray-700 dark:text-white mb-2">{alert.description}</p>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              Detected: {new Date(alert.detected_at).toLocaleString()}
                            </div>

                            {alert.status === 'active' && (
                              <button
                                onClick={() => resolveAlert(alert.id)}
                                className="mt-2 px-3 py-1 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-600"
                              >
                                Mark Resolved
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Alert Creation Modal */}
      {showAlertModal && alertModalDPP && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full mx-4 p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Report Issue for {alertModalDPP.model}</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Severity</label>
                <select
                  value={alertForm.severity}
                  onChange={(e) => setAlertForm({ ...alertForm, severity: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="info">Info</option>
                  <option value="warning">Warning</option>
                  <option value="critical">Critical</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Issue Type</label>
                <select
                  value={alertForm.type}
                  onChange={(e) => setAlertForm({ ...alertForm, type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="signature_mismatch">Signature Mismatch</option>
                  <option value="hash_mismatch">Hash Mismatch</option>
                  <option value="did_history_anomaly">DID History Anomaly</option>
                  <option value="missing_attestation">Missing Attestation</option>
                  <option value="integrity_failure">Integrity Failure</option>
                  <option value="unauthorized_change">Unauthorized Change</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description *</label>
                <textarea
                  value={alertForm.description}
                  onChange={(e) => setAlertForm({ ...alertForm, description: e.target.value })}
                  placeholder="Describe what you detected in the DID log, signatures, or hashes..."
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowAlertModal(false);
                  setAlertModalDPP(null);
                  setAlertForm({ severity: 'warning', type: 'signature_mismatch', description: '' });
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={createAlert}
                disabled={!alertForm.description.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create Alert
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
