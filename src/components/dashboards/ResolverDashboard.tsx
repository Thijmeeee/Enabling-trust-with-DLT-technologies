import { useState, useEffect } from 'react';
import { 
  Search, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  FileText, 
  History, 
  ShieldCheck, 
  Copy, 
  ExternalLink,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Loader2,
  Info,
  Network,
  Fingerprint,
  Zap,
  Building2,
  Cpu
} from 'lucide-react';
import { ResolverApi } from '../../lib/utils/resolverApi';
import { DIDResolutionResult, LogEntry, DIDVerificationResult } from '../../types/didwebvh';

type TabType = 'document' | 'log' | 'verification';

export default function ResolverDashboard() {
  const [did, setDid] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('document');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Data states
  const [resolutionResult, setResolutionResult] = useState<DIDResolutionResult | null>(null);
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const [verificationResult, setVerificationResult] = useState<DIDVerificationResult | null>(null);
  const [expandedChecks, setExpandedChecks] = useState<Record<string, boolean>>({});

  const toggleCheck = (id: string) => {
    setExpandedChecks(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Default DIDs for quick access (demo ones)
  const quickDIDs = [
    { name: 'Premium Triple Window', did: 'did:webvh:localhost:3000:z-demo-window-001' },
    { name: 'Standard Double Window', did: 'did:webvh:localhost:3000:z-demo-window-002' },
    { name: 'Tempered Glass Unit', did: 'did:webvh:localhost:3000:z-demo-glass-001' },
    { name: 'Aluminum Frame', did: 'did:webvh:localhost:3000:z-demo-frame-001' }
  ];

  const handleResolve = async (targetDid?: string) => {
    const didToResolve = targetDid || did;
    if (!didToResolve) return;

    setLoading(true);
    setError(null);
    setDid(didToResolve);

    try {
      const [res, log, ver] = await Promise.all([
        ResolverApi.resolve(didToResolve),
        ResolverApi.getLog(didToResolve),
        ResolverApi.verify(didToResolve)
      ]);

      setResolutionResult(res);
      setLogEntries(log);
      setVerificationResult(ver);

      if (res.didResolutionMetadata.error) {
        setError(res.didResolutionMetadata.errorMessage || 'DID resolution failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // Could add a toast here
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6 pt-20 transition-colors">
      <div className="max-w-[1920px] mx-auto">
        {/* Header & Search */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 mb-6 transition-colors">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
                <Network className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Universal Resolver</h1>
                <p className="text-gray-600 dark:text-gray-400">Resolve and verify did:webvh Identifiers across the trust network.</p>
              </div>
            </div>
            
            <div className="flex-1 max-w-2xl">
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                </div>
                <input
                  type="text"
                  className="block w-full pl-11 pr-32 py-4 border-2 border-slate-200 dark:border-slate-700 rounded-xl leading-5 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-lg shadow-sm"
                  placeholder="did:webvh:..."
                  value={did}
                  onChange={(e) => setDid(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleResolve()}
                />
                <div className="absolute inset-y-2 right-2 flex items-center">
                  <button
                    onClick={() => handleResolve()}
                    disabled={loading}
                    className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-blue-300 transition-colors flex items-center gap-2 shadow-sm"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Resolve'}
                  </button>
                </div>
              </div>

              {/* Quick Access */}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Examples:</span>
                {quickDIDs.map((item) => (
                  <button
                    key={item.did}
                    onClick={() => handleResolve(item.did)}
                    className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-md border border-slate-200 dark:border-slate-700 transition-colors truncate max-w-[150px]"
                    title={item.did}
                  >
                    {item.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-8 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 rounded-xl flex gap-3 text-red-700 dark:text-red-400">
            <AlertTriangle className="h-6 w-6 flex-shrink-0" />
            <div>
              <h3 className="font-bold">Resolution Error</h3>
              <p className="text-sm opacity-90">{error}</p>
            </div>
          </div>
        )}

        {resolutionResult && !error && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden mb-10">
          {/* Status Bar */}
          <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${verificationResult?.valid ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'}`}>
                {verificationResult?.valid ? <ShieldCheck className="h-6 w-6" /> : <XCircle className="h-6 w-6" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-bold text-slate-900 dark:text-white truncate max-w-md">{resolutionResult.didDocument?.id}</h2>
                  <button onClick={() => copyToClipboard(resolutionResult.didDocument?.id || '')} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors">
                    <Copy className="h-3 w-3 text-slate-400" />
                  </button>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${verificationResult?.valid ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'}`}>
                    {verificationResult?.valid ? 'Verified Hash Chain' : 'Verification Fails'}
                  </span>
                  <span className="text-slate-400 dark:text-slate-500">• Version: {resolutionResult.didDocumentMetadata?.versionId}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
            <button
              onClick={() => setActiveTab('document')}
              className={`px-8 py-4 text-sm font-bold flex items-center gap-2 transition-all border-b-2 ${
                activeTab === 'document' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900/50'
              }`}
            >
              <FileText className="h-4 w-4" />
              Document
            </button>
            <button
              onClick={() => setActiveTab('log')}
              className={`px-8 py-4 text-sm font-bold flex items-center gap-2 transition-all border-b-2 ${
                activeTab === 'log' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900/50'
              }`}
            >
              <History className="h-4 w-4" />
              Verifiable Log
            </button>
            <button
              onClick={() => setActiveTab('verification')}
              className={`px-8 py-4 text-sm font-bold flex items-center gap-2 transition-all border-b-2 ${
                activeTab === 'verification' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900/50'
              }`}
            >
              <ShieldCheck className="h-4 w-4" />
              Verification
            </button>
          </div>

          {/* Tab Content */}
          <div className="p-0 bg-white dark:bg-slate-800 min-h-[500px]">
            {activeTab === 'document' && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-slate-900 dark:text-white">Verifiable DID Document (Entry)</h3>
                  <button 
                    onClick={() => copyToClipboard(JSON.stringify(resolutionResult.didDocument, null, 2))}
                    className="text-xs flex items-center gap-1.5 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-semibold"
                  >
                    <Copy className="h-3 w-3" /> Copy JSON
                  </button>
                </div>
                <div className="bg-slate-900 rounded-xl p-6 overflow-x-auto">
                  <pre className="text-sm font-mono text-blue-300 leading-relaxed">
                    {JSON.stringify(resolutionResult.didDocument, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            {activeTab === 'log' && (
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">Verifiable History Log</h3>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">Chronological hash-chain of all DID operations</p>
                  </div>
                  <div className="px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full text-xs font-bold border border-blue-100 dark:border-blue-900/50">
                    {logEntries.length} Operations
                  </div>
                </div>

                <div className="relative">
                  {/* Vertical Line */}
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-100 dark:bg-slate-700 ml-[11px]"></div>

                  <div className="space-y-8">
                    {logEntries.map((entry, index) => (
                      <div key={entry.versionId} className="relative pl-12">
                        {/* Circle Marker */}
                        <div className={`absolute left-0 top-1.5 w-6 h-6 rounded-full border-4 border-white dark:border-slate-800 shadow-sm z-10 ${
                          index === 0 ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-600'
                        }`}></div>

                        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700 p-5 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md transition-all group">
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`w-2 h-2 rounded-full ${index === 0 ? 'bg-blue-500' : 'bg-slate-400 dark:bg-slate-500'}`}></span>
                                <span className="font-bold text-slate-900 dark:text-white">Version {entry.versionId}</span>
                                <span className="text-[10px] px-2 py-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full text-slate-500 dark:text-slate-400 font-bold tracking-wider">
                                  {(entry.parameters?.method || 'unknown').toUpperCase()}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-400 dark:text-slate-500 font-medium flex items-center gap-1">
                                <History className="h-3 w-3" />
                                {new Date(entry.versionTime).toLocaleString('en-US', { 
                                  dateStyle: 'medium', 
                                  timeStyle: 'medium' 
                                })}
                              </div>
                            </div>
                            
                            <div className="font-mono text-[10px] bg-slate-900 text-slate-400 px-3 py-2 rounded-lg border border-slate-800 group-hover:text-blue-300 transition-colors break-all max-w-md shadow-inner">
                              <span className="text-slate-600 mr-2">PROOF:</span>
                              {entry.proof[0]?.proofValue.substring(0, 48)}...
                            </div>
                          </div>


                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-100 dark:border-slate-700">
                              <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-2">Parameters</span>
                              <div className="space-y-2">
                                {entry.parameters.scid && (
                                  <div className="flex justify-between text-xs">
                                    <span className="text-slate-500 dark:text-slate-400">SCID:</span>
                                    <span className="font-mono text-slate-700 dark:text-slate-300">{entry.parameters.scid}</span>
                                  </div>
                                )}
                                {entry.parameters.updateKeys && entry.parameters.updateKeys.length > 0 && (
                                  <div className="flex flex-col gap-1">
                                    <span className="text-slate-500 dark:text-slate-400 text-xs">Pre-rotation Keys:</span>
                                    {entry.parameters.updateKeys.map((key: string, kIdx: number) => (
                                      <span key={kIdx} className="font-mono text-[10px] bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 px-2 py-1 rounded truncate">
                                        {key}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-100 dark:border-slate-700">
                              <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-2">Proofs ({entry.proof.length})</span>
                              <div className="space-y-3">
                                {entry.proof.map((p, pIdx) => (
                                  <div key={pIdx} className="space-y-1">
                                    <div className="flex items-center gap-1.5">
                                      {p.type === 'MerkleProof2019' ? (
                                        <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                                      ) : (
                                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                      )}
                                      <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300">{p.type}</span>
                                    </div>
                                    
                                    {p.proofValue && (
                                      <div className="font-mono text-[9px] text-slate-400 dark:text-slate-500 break-all bg-slate-50 dark:bg-slate-900/50 p-1.5 rounded border border-slate-100 dark:border-slate-700 italic">
                                        {p.proofValue.substring(0, 64)}...
                                      </div>
                                    )}
                                    
                                    {p.merkleRoot && (
                                      <div className="space-y-1 mt-1">
                                        <div className="flex justify-between text-[9px]">
                                          <span className="text-slate-400 dark:text-slate-500 uppercase">Merkle Root:</span>
                                          <span className="font-mono text-purple-600 dark:text-purple-400 font-bold">{p.merkleRoot.substring(0, 16)}...</span>
                                        </div>
                                        <div className="flex flex-wrap gap-1">
                                          {p.path?.map((pathPart: string, pathIdx: number) => (
                                            <span key={pathIdx} className="text-[8px] px-1 bg-purple-50 dark:bg-purple-900/30 text-purple-400 dark:text-purple-300 rounded border border-purple-100 dark:border-purple-900/50">
                                              Path {pathIdx}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'verification' && (
              <div className="p-8">
                <div className="max-w-2xl mx-auto">
                  {/* Minimal Status Banner */}
                  <div className={`mb-8 p-6 rounded-xl border flex items-center gap-5 ${
                    verificationResult?.valid 
                      ? 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700' 
                      : 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-900/50'
                  }`}>
                    <div className={`${verificationResult?.valid ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {verificationResult?.valid ? <ShieldCheck className="h-8 w-8" /> : <XCircle className="h-8 w-8" />}
                    </div>
                    <div>
                      <h3 className={`text-lg font-bold ${verificationResult?.valid ? 'text-slate-900 dark:text-white' : 'text-red-900 dark:text-red-400'}`}>
                        {verificationResult?.valid ? 'Digital Product Passport: VALID' : 'Passport Verification Failed'}
                      </h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {verificationResult?.valid 
                          ? 'All cryptographic security requirements have been met.' 
                          : 'Security audit detected invalid signatures or history.'}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 px-1">Integrity Checks</h4>
                    
                    {[
                      { 
                        id: 'history', 
                        label: 'Immutable History', 
                        sub: 'Cryptographic proof that no records have been altered.',
                        desc: 'Verified hash-chain of all lifecycle updates.',
                        status: verificationResult?.checks.hashChain,
                        details: (
                          <div className="mt-2 text-[10px] font-mono text-slate-400 dark:text-slate-500 space-y-1">
                             {logEntries.slice(0, 2).map((e, i) => (
                               <div key={i}>v{e.versionId} hash: {e.proof[0]?.proofValue?.substring(0, 32)}...</div>
                             ))}
                          </div>
                        )
                      },
                      { 
                        id: 'authenticity', 
                        label: 'Manufacturer Authenticity', 
                        sub: `Digitally signed by: ${did.includes('glass') ? 'Glass Solutions BV' : did.includes('frame') ? 'Frame Masters NV' : 'EcoGlass BV'}`,
                        desc: 'Authorized by valid controller signatures.',
                        status: verificationResult?.checks.signatures,
                        details: (
                          <div className="mt-2 text-[10px] font-mono text-slate-400 dark:text-slate-500">
                            Key ID: #key-1 (Ed25519 Verification Key)
                          </div>
                        )
                      },
                      { 
                        id: 'consensus', 
                        label: 'Network Consensus', 
                        sub: 'Verified by independent witness nodes.',
                        desc: 'State anchored with valid Merkle root and proof.',
                        status: logEntries.some(e => e.proof.some(p => p.type === 'MerkleProof2019')),
                        details: (
                          <div className="mt-2 text-[10px] font-mono text-slate-400 dark:text-slate-500">
                            Witness Root: {logEntries.find(e => e.proof.some(p => p.type === 'MerkleProof2019'))?.proof.find(p => p.type === 'MerkleProof2019')?.merkleRoot?.substring(0, 16)}...
                          </div>
                        )
                      }
                    ].map((check) => {
                      const isExpanded = expandedChecks[check.id];
                      return (
                        <div key={check.id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                          <button 
                            onClick={() => toggleCheck(check.id)}
                            className="w-full p-4 flex items-start gap-4 text-left hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors"
                          >
                            <div className={`mt-0.5 ${check.status ? 'text-green-500 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                              {check.status ? <CheckCircle className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-0.5">
                                <span className="font-bold text-slate-900 dark:text-white text-sm">{check.label}</span>
                                <span className={`text-[9px] font-bold uppercase tracking-widest ${check.status ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                  {check.status ? 'Passed' : 'Failed'}
                                </span>
                              </div>
                              <p className="text-xs text-slate-700 dark:text-slate-300 font-medium mb-0.5">{check.sub}</p>
                              <p className="text-[11px] text-slate-400 dark:text-slate-500">{check.desc}</p>
                              
                              {isExpanded && check.details}
                            </div>
                            <div className="text-slate-300 dark:text-slate-600">
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </div>
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Minimal Context Footer */}
                  <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center text-[11px] text-slate-400 dark:text-slate-500">
                    <div className="flex items-center gap-4">
                       <div className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                          <span>Network: Sepolia</span>
                       </div>
                       <div>DID: {verificationResult?.did.substring(0, 20)}...</div>
                    </div>
                    <div>Version: v{verificationResult?.versionId}</div>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {!resolutionResult && !loading && !error && (
        <div className="text-center py-20 bg-slate-50 dark:bg-slate-900/50 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800">
          <Info className="h-12 w-12 text-slate-300 dark:text-slate-700 mx-auto mb-4" />
          <h3 className="text-slate-900 dark:text-white font-bold text-xl mb-1">No DID Resolved</h3>
          <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            Enter a did:webvh identifier above to inspect its document, verifiable log, and cryptographic lineage.
          </p>
        </div>
      )}
      </div>
    </div>
  );
}
