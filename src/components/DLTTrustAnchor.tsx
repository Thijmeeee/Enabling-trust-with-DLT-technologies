import { useEffect, useState } from 'react';
import { Link2, Database, Hash, CheckCircle2, ExternalLink, Blocks, Clock } from 'lucide-react';
import { hybridDataStore } from '../lib/data/hybridDataStore';
import { useUI } from '../lib/utils/UIContext';
import type { AnchoringEvent } from '../lib/data/localData';
import { etherscanTxUrl, etherscanBlockUrl } from '../lib/api';

export default function DLTTrustAnchor({ did }: { did: string }) {
  const { t } = useUI();
  const [anchorings, setAnchorings] = useState<AnchoringEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnchorings();
  }, [did]);

  async function loadAnchorings() {
    setLoading(true);
    const data = await hybridDataStore.getAnchoringEventsByDID(did);
    setAnchorings(data as AnchoringEvent[]);
    setLoading(false);
  }

  const renderBlockInfo = (blockNumber: number, merkleRoot: string | null) => {
    const blockUrl = etherscanBlockUrl(blockNumber);
    return (
      <>
        <p className="font-mono text-xs text-gray-900">
          Block:{' '}
          {blockUrl ? (
            <a 
              href={blockUrl} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-blue-600 hover:text-blue-800 hover:underline"
            >
              {String(blockNumber)}
            </a>
          ) : (
            String(blockNumber)
          )}
        </p>
        <p className="font-mono text-xs text-purple-600 break-all">
          Root: {merkleRoot || 'N/A'}
        </p>
      </>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-6">
        <Link2 className="w-5 h-5 text-purple-600" />
        <h3 className="text-lg font-semibold text-gray-900">DLT Trust Anchor</h3>
        <span className="ml-auto text-sm text-gray-500">{anchorings.length} anchoring events</span>
      </div>

      {/* Blockchain Visualization */}
      <div className="mb-6 p-4 bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg border-2 border-purple-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center">
              <Database className="w-6 h-6 text-white" />
            </div>
            <div>
              <h4 className="font-semibold text-gray-900">Ethereum Blockchain</h4>
              <p className="text-xs text-gray-600">Decentralized immutable ledger</p>
            </div>
          </div>
          <div className={`px-4 py-2 rounded-full text-sm font-medium ${anchorings.length > 0 ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700'}`}>
            {anchorings.length > 0 ? (
              <>
                <CheckCircle2 className="w-4 h-4 inline mr-1" />
                Anchored
              </>
            ) : (
              <>
                <Clock className="w-4 h-4 inline mr-1" />
                Pending Anchor
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="bg-white rounded-lg p-3 border border-purple-200">
            <Database className="w-5 h-5 mx-auto mb-1 text-purple-600" />
            <p className="text-xs text-gray-500">Network</p>
            <p className="text-sm font-semibold text-gray-900">
              {String(anchorings[0]?.metadata?.network) || 'Ethereum'}
            </p>
          </div>
          <div className="bg-white rounded-lg p-3 border border-purple-200">
            <Blocks className="w-5 h-5 mx-auto mb-1 text-blue-600" />
            <p className="text-xs text-gray-500">Blocks</p>
            <p className="text-sm font-semibold text-gray-900">{anchorings.length}</p>
          </div>
          <div className="bg-white rounded-lg p-3 border border-purple-200">
            <Hash className="w-5 h-5 mx-auto mb-1 text-green-600" />
            <p className="text-xs text-gray-500">Type</p>
            <p className="text-sm font-semibold text-gray-900">Merkle Proof</p>
          </div>
        </div>
      </div>

      {/* Anchoring Events */}
      <div className="space-y-4">
        {anchorings.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Link2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
            No anchoring events found
          </div>
        ) : (
          anchorings.map((anchor: AnchoringEvent, index: number) => {
            const compHashes = anchor.component_hashes as any[] | null | undefined;
            const explorerUrl = etherscanTxUrl(anchor.transaction_hash);
            
            return (
              <div key={anchor.id} className="border-l-4 border-purple-500 bg-gradient-to-r from-purple-50 to-white p-4 rounded-r-lg hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 font-bold text-sm">
                      {index + 1}
                    </div>
                    <h4 className="font-medium text-gray-900">
                      {anchor.anchor_type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                    </h4>
                  </div>
                  <p className="text-xs text-gray-500">{new Date(anchor.timestamp).toLocaleString()}</p>
                </div>
                {explorerUrl ? (
                  <a 
                    href={explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200 transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                    View on Etherscan
                  </a>
                ) : (
                  <span className="flex items-center gap-1 px-3 py-1 text-xs bg-gray-100 text-gray-500 rounded-full">
                    <Database className="w-3 h-3" />
                    Local Network
                  </span>
                )}
              </div>

              <div className="space-y-3">
                {/* Transaction Hash */}
                <div className="bg-white rounded-lg p-3 border border-gray-200">
                  <div className="flex items-center gap-2 mb-1">
                    <Hash className="w-4 h-4 text-gray-500" />
                    <p className="text-xs font-medium text-gray-600">{t('transactionHash')}</p>
                  </div>
                  {explorerUrl ? (
                    <a 
                      href={explorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-xs break-all text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      {anchor.transaction_hash}
                    </a>
                  ) : (
                    <p className="font-mono text-xs break-all text-gray-600">
                      {anchor.transaction_hash}
                    </p>
                  )}
                </div>

                <div className="bg-white rounded-lg p-3 border border-gray-200">
                  <p className="text-xs font-medium text-gray-600 mb-1">{t('Block & Merkle')}</p>
                  {renderBlockInfo(anchor.block_number, anchor.merkle_root)}
                </div>

                {/* Component Hashes */}
                {compHashes && Array.isArray(compHashes) && compHashes.length > 0 && (
                  <div className="bg-white rounded-lg p-3 border border-gray-200">
                    <p className="text-xs font-medium text-gray-600 mb-2">Component Hashes</p>
                    <div className="space-y-1">
                      {compHashes.map((comp: any, i: number) => (
                        <div key={i} className="text-xs">
                          <span className="text-gray-500">DID:</span>{' '}
                          <span className="font-mono text-gray-700">{comp.did}</span>
                          <br />
                          <span className="text-gray-500">Hash:</span>{' '}
                          <span className="font-mono text-purple-600">{comp.hash}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Metadata */}
                {anchor.metadata && typeof anchor.metadata === 'object' && Object.keys(anchor.metadata).length > 0 && (
                  <div className="bg-white rounded-lg p-3 border border-gray-200">
                    <p className="text-xs font-medium text-gray-600 mb-2">Additional Details</p>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(anchor.metadata as Record<string, any>).map(([key, value]) => (
                        <div key={key} className="text-xs">
                          <span className="text-gray-500">{key}:</span>{' '}
                          <span className="font-medium text-gray-700">
                            {typeof value === 'object' && value !== null 
                              ? JSON.stringify(value) 
                              : value !== null && value !== undefined
                              ? String(value)
                              : 'N/A'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Trust Indicator */}
              <div className="mt-3 flex items-center gap-2 text-sm">
                <div className="flex-1 bg-green-50 text-green-700 p-2 rounded flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="text-xs font-medium">Immutably recorded on blockchain</span>
                </div>
              </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
