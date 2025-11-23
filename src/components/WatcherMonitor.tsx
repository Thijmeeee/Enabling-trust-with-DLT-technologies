import { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, Info, X } from 'lucide-react';
import { localDB } from '../lib/localData';
import type { WatcherAlert } from '../lib/localData';

export default function WatcherMonitor({ onClose }: { onClose: () => void }) {
  const [alerts, setAlerts] = useState<WatcherAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unresolved'>('unresolved');

  useEffect(() => {
    loadAlerts();
  }, [filter]);

  async function loadAlerts() {
    setLoading(true);

    let alerts = await localDB.getAlerts();

    if (filter === 'unresolved') {
      alerts = alerts.filter(a => !a.resolved);
    }

    setAlerts(alerts.slice(0, 50));
    setLoading(false);
  }

  async function resolveAlert(alertId: string) {
    await localDB.updateAlert(alertId, { resolved: true });
    loadAlerts();
  }

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
            <div className="space-y-3">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-4 border rounded-lg ${
                    alert.severity === 'critical'
                      ? 'border-red-200 bg-red-50'
                      : alert.severity === 'warning'
                      ? 'border-yellow-200 bg-yellow-50'
                      : 'border-blue-200 bg-blue-50'
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
                        onClick={() => resolveAlert(alert.id)}
                        className="ml-4 px-3 py-1 bg-white border border-gray-300 rounded text-sm hover:bg-gray-50"
                      >
                        Resolve
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
