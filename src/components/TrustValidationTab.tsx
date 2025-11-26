import { useState, useEffect } from 'react';
import { Shield, Eye, Anchor, ChevronDown, ChevronUp, CheckCircle2, AlertTriangle, Clock, Hash, Activity } from 'lucide-react';
import { localDB } from '../lib/data/localData';
import { useRole } from '../lib/utils/roleContext';
import type { WitnessAttestation, WatcherAlert, AnchoringEvent } from '../lib/data/localData';

interface TrustValidationTabProps {
  did: string;
}

export default function TrustValidationTab({ did }: TrustValidationTabProps) {
  const { currentRole } = useRole();
  const [attestations, setAttestations] = useState<WitnessAttestation[]>([]);
  const [alerts, setAlerts] = useState<WatcherAlert[]>([]);
  const [anchorings, setAnchorings] = useState<AnchoringEvent[]>([]);
  const [expandedSection, setExpandedSection] = useState<'witnesses' | 'watchers' | 'anchoring' | null>(null);
  const [expandedWitness, setExpandedWitness] = useState<string | null>(null);

  const isAdmin = currentRole === 'Supervisor';

  useEffect(() => {
    loadData();
    // Real-time updates every 5 seconds
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [did]);

  async function loadData() {
    const [attestationsData, alertsData, anchoringsData] = await Promise.all([
      localDB.getAttestationsByDID(did),
      localDB.getAlerts(),
      localDB.getAnchoringEventsByDID(did),
    ]);

    // Filter to only show DID-related witness attestations (not product lifecycle events)
    const didEventTypes = ['did_creation', 'key_rotation', 'ownership_change', 'did_update', 'did_lifecycle_update'];
    const filteredAttestations = attestationsData.filter(att => 
      didEventTypes.includes(att.attestation_type)
    );
    
    setAttestations(filteredAttestations);
    
    // Filter alerts related to this DID
    const dpp = await localDB.getDPPByDID(did);
    const filteredAlerts = dpp ? alertsData.filter(a => a.dpp_id === dpp.id) : [];
    setAlerts(filteredAlerts);
    
    setAnchorings(anchoringsData as AnchoringEvent[]);
  }

  const toggleSection = (section: 'witnesses' | 'watchers' | 'anchoring') => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  // Get unique witnesses
  const uniqueWitnesses = Array.from(new Set(attestations.map(a => a.witness_did)));
  const activeWatchers = 3; // Mock data - replace with actual API
  const totalAnchors = anchorings.length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h2 className="text-lg font-bold text-gray-900 mb-2">Trust & Validation Network</h2>
        <p className="text-sm text-gray-600">
          Three-layer validation: Witnesses cryptographically attest operations • Watchers monitor integrity • DLT anchors to blockchain
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border-2 border-green-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <Shield className="w-8 h-8 text-green-600" />
            <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded">ACTIVE</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{uniqueWitnesses.length}</p>
          <p className="text-sm text-gray-600 mt-1">Active Witnesses</p>
        </div>

        <div className="bg-white rounded-lg border-2 border-orange-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <Eye className="w-8 h-8 text-orange-600" />
            <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs font-semibold rounded">MONITORING</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{activeWatchers}</p>
          <p className="text-sm text-gray-600 mt-1">Active Watchers</p>
        </div>

        <div className="bg-white rounded-lg border-2 border-purple-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <Anchor className="w-8 h-8 text-purple-600" />
            <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs font-semibold rounded">ANCHORED</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{totalAnchors}</p>
          <p className="text-sm text-gray-600 mt-1">Blockchain Anchors</p>
        </div>
      </div>

      {/* Witnesses Section */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <button
          onClick={() => toggleSection('witnesses')}
          className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-green-600" />
            <h3 className="font-semibold text-gray-900">Witness Validators</h3>
            <span className="text-xs text-gray-500">Cryptographically attest each DID operation</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-700">{uniqueWitnesses.length} witnesses</span>
            {expandedSection === 'witnesses' ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </div>
        </button>

        {expandedSection === 'witnesses' && (
          <div className="border-t border-gray-200">
            {isAdmin && (
              <div className="p-4 bg-gray-50 border-b border-gray-200 flex gap-2">
                <button className="px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors">
                  + Add Witness
                </button>
                <button className="px-3 py-1.5 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors">
                  Remove Witness
                </button>
              </div>
            )}
            
            <div className="p-4">
              {uniqueWitnesses.length === 0 ? (
                <p className="text-gray-500 text-center py-4 text-sm">No witnesses found</p>
              ) : (
                <div className="space-y-2">
                  {uniqueWitnesses.map((witnessId, idx) => {
                    const witnessAttestations = attestations.filter(a => a.witness_did === witnessId);
                    const lastAttestation = witnessAttestations[0];
                    const witnessName = witnessId.split(':').pop()?.substring(0, 20) || 'Unknown';
                    
                    return (
                      <div key={idx} className="border border-gray-200 rounded overflow-hidden">
                        <div 
                          className="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 cursor-pointer"
                          onClick={() => setExpandedWitness(expandedWitness === witnessId ? null : witnessId)}
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm text-gray-900 truncate">{witnessName}</p>
                              <p className="text-xs text-gray-500 font-mono truncate">{witnessId}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 flex-shrink-0 ml-4">
                            <div className="text-right">
                              <p className="text-xs text-gray-500">Last Validation</p>
                              <p className="text-xs font-medium text-gray-700">
                                {lastAttestation ? new Date(lastAttestation.timestamp).toLocaleString() : 'N/A'}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-gray-500">Total Events</p>
                              <p className="text-xs font-bold text-blue-600">{witnessAttestations.length}</p>
                            </div>
                            {expandedWitness === witnessId ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </div>
                        </div>
                        
                        {expandedWitness === witnessId && (
                          <div className="p-3 bg-white border-t border-gray-200">
                            <h4 className="text-xs font-semibold text-gray-700 mb-2 uppercase">Recent Attestations</h4>
                            <div className="space-y-1.5 max-h-40 overflow-y-auto">
                              {witnessAttestations.slice(0, 5).map((att, i) => (
                                <div key={i} className="flex items-center justify-between text-xs p-2 bg-gray-50 rounded">
                                  <div className="flex items-center gap-2">
                                    <Activity className="w-3 h-3 text-green-600" />
                                    <span className="font-medium capitalize">{att.attestation_type.replace(/_/g, ' ')}</span>
                                  </div>
                                  <span className="text-gray-500">{new Date(att.timestamp).toLocaleString()}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Watchers Section */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <button
          onClick={() => toggleSection('watchers')}
          className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Eye className="w-5 h-5 text-orange-600" />
            <h3 className="font-semibold text-gray-900">Watcher Monitoring</h3>
            <span className="text-xs text-gray-500">Monitor integrity, detect anomalies</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-700">{activeWatchers} watchers</span>
            {expandedSection === 'watchers' ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </div>
        </button>

        {expandedSection === 'watchers' && (
          <div className="border-t border-gray-200">
            <div className="p-4">
              {/* Watcher Status Cards */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                {['Integrity Watcher', 'Anomaly Detector', 'Compliance Monitor'].map((name, idx) => (
                  <div key={idx} className="p-3 bg-gray-50 rounded border border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <Activity className="w-4 h-4 text-orange-600" />
                      <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs font-semibold rounded">HEALTHY</span>
                    </div>
                    <p className="text-xs font-medium text-gray-900 mb-1">{name}</p>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Clock className="w-3 h-3" />
                      <span>Last scan: 2m ago</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Alert Feed */}
              <div className="mb-3">
                <h4 className="text-sm font-semibold text-gray-900 mb-2">
                  Alert Feed ({alerts.filter(a => !a.resolved).length} active)
                </h4>
              </div>

              {alerts.length === 0 ? (
                <div className="p-4 bg-green-50 border border-green-200 rounded text-center">
                  <CheckCircle2 className="w-6 h-6 text-green-600 mx-auto mb-1" />
                  <p className="text-sm text-gray-600">No alerts - system healthy</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {alerts.slice(0, 5).map((alert, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-200 text-xs"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <AlertTriangle
                          className={`w-4 h-4 flex-shrink-0 ${
                            alert.severity === 'critical' ? 'text-red-600' :
                            alert.severity === 'warning' ? 'text-orange-600' : 'text-yellow-600'
                          }`}
                        />
                        <span className="font-medium text-gray-900 truncate">{alert.alert_type}</span>
                        {alert.resolved && (
                          <span className="px-1.5 py-0.5 bg-green-100 text-green-800 font-semibold rounded">OK</span>
                        )}
                      </div>
                      <span className="text-gray-500 ml-2 whitespace-nowrap">{new Date(alert.created_at).toLocaleTimeString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* DLT Anchoring Section */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <button
          onClick={() => toggleSection('anchoring')}
          className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Anchor className="w-5 h-5 text-purple-600" />
            <h3 className="font-semibold text-gray-900">DLT Anchoring</h3>
            <span className="text-xs text-gray-500">Anchor events to blockchain for immutability</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-700">{totalAnchors} anchors</span>
            {expandedSection === 'anchoring' ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </div>
        </button>

        {expandedSection === 'anchoring' && (
          <div className="border-t border-gray-200">
            <div className="p-4">
              {/* Latest Anchor Info */}
              {anchorings.length > 0 && (
                <div className="p-4 bg-purple-50 rounded border border-purple-200 mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-gray-700">LATEST ANCHOR</span>
                    <span className="px-2 py-0.5 bg-purple-600 text-white text-xs font-semibold rounded">CONFIRMED</span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Hash className="w-4 h-4 text-purple-600" />
                      <span className="text-xs font-mono text-gray-700 truncate">{anchorings[0].transaction_hash}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-purple-600" />
                      <span className="text-xs text-gray-600">{new Date(anchorings[0].timestamp).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Anchor List */}
              {anchorings.length === 0 ? (
                <p className="text-gray-500 text-center py-4 text-sm">No anchors found</p>
              ) : (
                <div className="space-y-1.5">
                  {anchorings.slice(0, 8).map((anchoring, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-200">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <Anchor className="w-4 h-4 text-purple-600 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-900">Block #{anchoring.block_number}</p>
                          <p className="text-xs text-gray-500 font-mono truncate">{anchoring.transaction_hash}</p>
                        </div>
                      </div>
                      <div className="text-right ml-4">
                        <span className="text-xs text-gray-500">{new Date(anchoring.timestamp).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                  {anchorings.length > 8 && (
                    <p className="text-xs text-gray-500 text-center pt-2">
                      +{anchorings.length - 8} more anchors
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
