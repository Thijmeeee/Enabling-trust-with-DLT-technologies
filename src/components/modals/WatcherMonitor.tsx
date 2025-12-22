import { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, Info, X, ChevronDown, ChevronUp, Package, Shield } from 'lucide-react';
import { hybridDataStore } from '../../lib/data/hybridDataStore';

import type { WatcherAlert } from '../../lib/data/localData';

interface GroupedAlerts {
  dppId: string;
  dppName: string;
  dppType: 'main' | 'component';
  alerts: WatcherAlert[];
  components?: { name: string; alerts: WatcherAlert[] }[];
}

export default function WatcherMonitor({ onClose }: { onClose: () => void }) {
  const [alerts, setAlerts] = useState<WatcherAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unresolved'>('unresolved');
  const [expandedDPP, setExpandedDPP] = useState<string | null>(null);
  const [expandedComponents, setExpandedComponents] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadAlerts();
  }, [filter]);

  async function loadAlerts() {
    setLoading(true);

    let alerts = await hybridDataStore.getAlerts();

    if (filter === 'unresolved') {
      alerts = alerts.filter(a => !a.resolved);
    }

    setAlerts(alerts.slice(0, 50));
    setLoading(false);
  }

  // Group alerts by DPP with parent-child relationships
  const groupedAlerts = (): GroupedAlerts[] => {
    const groups = new Map<string, GroupedAlerts>();
    
    alerts.forEach((alert) => {
      if (!alert.dpp_id) {
        // Alert without DPP - skip or create "System" group
        return;
      }
      
      // Determine if this is a component alert by checking the alert details or DPP data
      const isComponent = alert.details?.isComponent || false;
      const parentDppId = alert.details?.parentDppId || alert.dpp_id;
      const componentName = alert.details?.componentName || 'Unknown Component';
      
      // Use parent DPP ID as group key
      const groupKey = parentDppId;
      
      // Create group if it doesn't exist
      if (!groups.has(groupKey)) {
        const groupName = alert.details?.groupModel || alert.details?.productModel || 'Unknown Product';
        groups.set(groupKey, {
          dppId: groupKey,
          dppName: groupName,
          dppType: 'main',
          alerts: [],
          components: [],
        });
      }
      
      const group = groups.get(groupKey)!;
      
      // Add to components or main alerts
      if (isComponent) {
        let componentGroup = group.components!.find(c => c.name === componentName);
        if (!componentGroup) {
          componentGroup = { name: componentName, alerts: [] };
          group.components!.push(componentGroup);
        }
        componentGroup.alerts.push(alert);
      } else {
        group.alerts.push(alert);
      }
    });
    
    return Array.from(groups.values());
  };

  async function resolveAlert(alertId: string) {
    await hybridDataStore.updateAlert(alertId, { resolved: true });
    loadAlerts();
  }

  // Helper component to render individual alerts
  const AlertCard = ({ alert, onResolve }: { alert: WatcherAlert; onResolve: (id: string) => void }) => (
    <div
      className={`border-b border-gray-200 p-4 transition-all ${
        alert.severity === 'critical'
          ? 'bg-red-50'
          : alert.severity === 'warning'
          ? 'bg-yellow-50'
          : 'bg-blue-50'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3 flex-1">
          <div className="mt-0.5">
            {alert.severity === 'critical' && (
              <AlertTriangle className="w-5 h-5 text-red-600" />
            )}
            {alert.severity === 'warning' && (
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
            )}
            {alert.severity === 'info' && <Info className="w-5 h-5 text-blue-600" />}
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`px-2 py-0.5 text-xs rounded-full capitalize ${
                  alert.severity === 'critical'
                    ? 'bg-red-200 text-red-800'
                    : alert.severity === 'warning'
                    ? 'bg-yellow-200 text-yellow-800'
                    : 'bg-blue-200 text-blue-800'
                }`}
              >
                {alert.severity}
              </span>
              <span className="text-xs text-gray-500 capitalize">
                {alert.alert_type.replace(/_/g, ' ')}
              </span>
              {alert.resolved && (
                <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700">
                  Resolved
                </span>
              )}
            </div>

            <p className="text-sm text-gray-900 font-medium mb-2">{alert.message}</p>

            {alert.did && (
              <p className="text-xs font-mono text-gray-600 mb-2">DID: {alert.did}</p>
            )}

            <p className="text-xs text-gray-500">
              {new Date(alert.created_at).toLocaleString()}
            </p>

            {alert.details && Object.keys(alert.details).length > 0 && (
              <div className="mt-2 p-2 bg-white rounded text-xs">
                <pre className="whitespace-pre-wrap">
                  {JSON.stringify(alert.details, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>

        {!alert.resolved && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onResolve(alert.id);
            }}
            className="ml-4 px-3 py-1 bg-white border border-gray-300 rounded text-sm hover:bg-gray-50"
          >
            Resolve
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Watcher Alerts</h2>
            <p className="text-sm text-gray-500 mt-1">Real-time monitoring and integrity checks</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 border-b border-gray-200">
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg ${
                filter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              All Alerts
            </button>
            <button
              onClick={() => setFilter('unresolved')}
              className={`px-4 py-2 rounded-lg ${
                filter === 'unresolved'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Unresolved
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : alerts.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
              <p className="text-gray-500 mt-4">No alerts found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {groupedAlerts().map((group) => {
                const isExpanded = expandedDPP === group.dppId;
                
                return (
                  <div key={group.dppId} className="border border-gray-200 rounded-lg overflow-hidden">
                    {/* Window/Main Product Header */}
                    <div 
                      className="bg-gradient-to-r from-blue-50 to-blue-100 px-4 py-3 cursor-pointer hover:from-blue-100 hover:to-blue-200 transition-colors"
                      onClick={() => setExpandedDPP(isExpanded ? null : group.dppId)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Package className="w-5 h-5 text-blue-600" />
                          <div>
                            <h4 className="font-semibold text-blue-900">{group.dppName}</h4>
                            <p className="text-xs text-blue-600">
                              Main Product • {group.alerts.length} alert{group.alerts.length !== 1 ? 's' : ''} • {group.components?.length || 0} component{(group.components?.length || 0) !== 1 ? 's' : ''}
                            </p>
                          </div>
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5 text-blue-600" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-blue-600" />
                        )}
                      </div>
                    </div>

                    {/* Window Content - Collapsible */}
                    {isExpanded && (
                      <>
                        {/* Main Product Alerts */}
                        {group.alerts.length > 0 && (
                          <div className="bg-white">
                            {group.alerts.map((alert) => (
                              <AlertCard key={alert.id} alert={alert} onResolve={resolveAlert} />
                            ))}
                          </div>
                        )}
                        
                        {/* Component Sub-DPPs */}
                        {group.components && group.components.map((component) => {
                          const componentKey = `${group.dppId}-${component.name}`;
                          const isComponentExpanded = expandedComponents.has(componentKey);
                          
                          return (
                            <div key={component.name} className="border-t border-gray-300">
                              {/* Component Sub-DPP Header */}
                              <div 
                                className="bg-gradient-to-r from-purple-50 to-purple-100 px-4 py-3 cursor-pointer hover:from-purple-100 hover:to-purple-200 transition-colors"
                                onClick={() => {
                                  const newExpanded = new Set(expandedComponents);
                                  if (isComponentExpanded) {
                                    newExpanded.delete(componentKey);
                                  } else {
                                    newExpanded.add(componentKey);
                                  }
                                  setExpandedComponents(newExpanded);
                                }}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <Shield className="w-5 h-5 text-purple-600" />
                                    <div>
                                      <h4 className="font-semibold text-purple-900">{component.name}</h4>
                                      <p className="text-xs text-purple-600">
                                        Component • {component.alerts.length} alert{component.alerts.length !== 1 ? 's' : ''}
                                      </p>
                                    </div>
                                  </div>
                                  {isComponentExpanded ? (
                                    <ChevronUp className="w-5 h-5 text-purple-600" />
                                  ) : (
                                    <ChevronDown className="w-5 h-5 text-purple-600" />
                                  )}
                                </div>
                              </div>
                              
                              {/* Component Alerts */}
                              {isComponentExpanded && (
                                <div className="bg-white">
                                  {component.alerts.map((alert) => (
                                    <AlertCard key={alert.id} alert={alert} onResolve={resolveAlert} />
                                  ))}
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
    </div>
  );
}

