import { CheckCircle, AlertCircle, Package, Box, Link, Shield } from 'lucide-react';
import type { DPP } from '../../lib/data/localData';

export default function DPPListItem({ dpp, onSelect }: { dpp: DPP; onSelect: () => void }) {
  const isMain = dpp.type === 'main';
  const isActive = dpp.lifecycle_status === 'active';
  const hasAttestation = true; // Mock - would check actual attestations
  
  const getStatusColor = () => {
    if (isActive) return 'bg-green-100 text-green-700 border-green-300';
    if (dpp.lifecycle_status === 'replaced') return 'bg-orange-100 text-orange-700 border-orange-300';
    if (dpp.lifecycle_status === 'disposed' || dpp.lifecycle_status === 'end_of_life') return 'bg-red-100 text-red-700 border-red-300';
    return 'bg-gray-100 text-gray-700 border-gray-300';
  };

  return (
    <button
      onClick={onSelect}
      className="w-full bg-white border-2 border-gray-200 rounded-lg p-4 hover:border-blue-500 hover:shadow-lg transition-all text-left"
    >
      <div className="flex items-start gap-4">
        <div
          className={`p-3 rounded-lg ${
            isMain ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'
          }`}
        >
          {isMain ? <Package className="w-6 h-6" /> : <Box className="w-6 h-6" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-semibold text-gray-900 text-lg">{dpp.model}</h3>
                <span
                  className={`px-3 py-1 text-xs font-medium rounded-full ${
                    isMain
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-green-100 text-green-700'
                  }`}
                >
                  {isMain ? 'Main Product' : 'Component'}
                </span>
                <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${getStatusColor()}`}>
                  {isActive && '🟢 '}
                  {dpp.lifecycle_status.toUpperCase()}
                </span>
                {hasAttestation && (
                  <span className="flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 text-xs font-semibold rounded-full border border-blue-300">
                    <Shield className="w-3 h-3" />
                    Verified
                  </span>
                )}
              </div>

              {/* DID prominently displayed */}
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-l-4 border-blue-500 rounded px-3 py-2 mb-2">
                <div className="flex items-center gap-2 mb-1">
                  <Link className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-semibold text-blue-600">DID:webvh Identifier</span>
                </div>
                <p className="text-sm text-gray-900 font-mono break-all">{dpp.did}</p>
              </div>

              <div className="flex items-center gap-4 text-xs text-gray-600">
                <span className="font-medium">Version {dpp.version}</span>
                <span>{new Date(dpp.created_at).toLocaleDateString()}</span>
                {dpp.metadata?.batch && (
                  <span className="px-2 py-1 bg-purple-50 text-purple-700 rounded font-medium">
                    Batch: {dpp.metadata.batch}
                  </span>
                )}
              </div>
            </div>

            {dpp.parent_did && (
              <div className="text-xs bg-gray-50 rounded p-2 border border-gray-200">
                <span className="text-gray-500 font-medium">Parent DID:</span>
                <p className="font-mono text-gray-700 truncate max-w-xs mt-1">{dpp.parent_did}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}
