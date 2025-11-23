import { CheckCircle, AlertCircle, Package, Box, Link } from 'lucide-react';
import type { DPP } from '../lib/localData';

export default function DPPListItem({ dpp, onSelect }: { dpp: DPP; onSelect: () => void }) {
  const isMain = dpp.type === 'main';
  const isActive = dpp.lifecycle_status === 'active';

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
                {isActive ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-orange-600" />
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
                <span className="capitalize px-2 py-1 bg-gray-100 rounded">{dpp.lifecycle_status}</span>
                <span>{new Date(dpp.created_at).toLocaleDateString()}</span>
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
