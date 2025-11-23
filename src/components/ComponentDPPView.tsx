import { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Box,
  Shield,
  Leaf,
  Award,
  ExternalLink,
  Download,
  QrCode,
  Link2,
  Activity,
} from 'lucide-react';
import { getDPPWithRelations, exportDPPHierarchyToJSON } from '../lib/enhancedAdapter';
import { calculateTrustScore } from '../lib/verificationLocal';
import { getSchemaForType } from '../lib/schemas/productSchema';
import { getDoP } from '../lib/schemas/declarationOfPerformance';
import type { DeclarationOfPerformance } from '../lib/schemas/declarationOfPerformance';
import { useRole } from '../lib/roleContext';
import QRCodeDisplay from './QRCodeDisplay';
import DIDEventsLog from './DIDEventsLog';
import WitnessFlowVisualization from './WitnessFlowVisualization';
import DLTTrustAnchor from './DLTTrustAnchor';
import DoPerformanceView from './DoPerformanceView';
import DoPerformanceEditor from './DoPerformanceEditor';

export default function ComponentDPPView({
  did,
  onBack,
  onNavigate,
}: {
  did: string;
  onBack: () => void;
  onNavigate: (did: string) => void;
}) {
  const { currentRole } = useRole();
  const [data, setData] = useState<any>(null);
  const [trustScore, setTrustScore] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showQR, setShowQR] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'specifications' | 'sustainability' | 'credentials' | 'witness' | 'anchoring' | 'events'>(
    'overview'
  );
  const [editingDoP, setEditingDoP] = useState(false);

  useEffect(() => {
    console.log('ComponentDPPView mounted with DID:', did);
    loadData();
  }, [did]);

  async function loadData() {
    console.log('ComponentDPPView loading data for:', did);
    setLoading(true);
    try {
      const dppData = await getDPPWithRelations(did);
      console.log('ComponentDPPView data loaded:', dppData);
      setData(dppData);

      if (dppData?.dpp) {
        const trust = await calculateTrustScore(dppData.dpp.id);
        setTrustScore(trust);
      }
    } catch (error) {
      console.error('Error loading component data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleExport() {
    const json = await exportDPPHierarchyToJSON(did);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dpp-component-${did.split(':').pop()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleSaveDoP(dop: DeclarationOfPerformance) {
    if (!data?.dpp) return;
    
    const { updateDPP } = await import('../lib/enhancedAdapter');
    const updatedDPP = await updateDPP(data.dpp.id, {
      metadata: {
        ...data.dpp.metadata,
        declarationOfPerformance: dop,
      },
    });
    
    console.log('DoP saved successfully:', updatedDPP);
    setEditingDoP(false);
    await loadData();
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
          <p className="text-gray-500 mt-4">Loading Component DPP...</p>
        </div>
      </div>
    );
  }

  if (!data || !data.dpp) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600">Component DPP not found</p>
          <button onClick={onBack} className="mt-4 text-blue-600 hover:underline">
            Go back
          </button>
        </div>
      </div>
    );
  }

  const dpp = data.dpp;
  const sustainabilitySpecs = data.specifications.find((s: any) => s.spec_type === 'sustainability');
  
  const productType = dpp.metadata.productType as string || 'unknown';
  const schema = getSchemaForType(productType);
  const color = schema?.color || '#10B981';

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            Back
          </button>

          {data.parent && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="text-xs text-blue-600 mb-1">Parent Product</div>
              <button
                onClick={() => onNavigate(data.parent.did)}
                className="text-sm font-medium text-blue-700 hover:underline flex items-center gap-1"
              >
                {data.parent.model}
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          )}

          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4 flex-1">
              <div className="p-4 rounded-lg shadow-lg" style={{ backgroundColor: color }}>
                <Box className="w-8 h-8 text-white" />
              </div>
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-gray-900 mb-3">{dpp.model}</h1>
                
                {/* Prominent DID Display */}
                <div className="rounded-lg p-4 mb-3 shadow-sm border-2" style={{ 
                  backgroundColor: `${color}10`,
                  borderColor: color
                }}>
                  <div className="flex items-center gap-2 mb-2">
                    <Link2 className="w-5 h-5" style={{ color }} />
                    <span className="text-sm font-bold uppercase tracking-wide" style={{ color }}>DID:webvh Identifier</span>
                  </div>
                  <p className="text-base text-gray-900 font-mono break-all leading-relaxed">{dpp.did}</p>
                </div>

                <div className="flex items-center gap-3">
                  <span className="px-4 py-1.5 text-sm font-semibold rounded-full border" style={{
                    backgroundColor: `${color}20`,
                    color: color,
                    borderColor: `${color}50`
                  }}>
                    Component
                  </span>
                  <span className="text-sm text-gray-700 font-medium capitalize px-3 py-1 bg-gray-100 rounded-full">{dpp.lifecycle_status}</span>
                  <span className="text-sm text-gray-700 font-medium px-3 py-1 bg-gray-100 rounded-full">Version {dpp.version}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowQR(true)}
                className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
              >
                <QrCode className="w-4 h-4" />
                QR Code
              </button>
              <button
                onClick={handleExport}
                className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Export JSON
              </button>
            </div>
          </div>

          <div className="flex gap-2 mt-6 border-b border-gray-200">
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'specifications', label: 'Specifications' },
              { id: 'sustainability', label: 'Sustainability' },
              { id: 'credentials', label: 'Credentials' },
              { id: 'witness', label: 'Witness Flow' },
              { id: 'anchoring', label: 'DLT Anchor' },
              { id: 'events', label: 'Event Log' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2 border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'font-medium'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
                style={activeTab === tab.id ? {
                  borderColor: color,
                  color: color
                } : {}}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-2 space-y-6">
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Shield className="w-5 h-5" style={{ color }} />
                  Trust Score
                </h2>
                {trustScore && (
                  <>
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-3xl font-bold" style={{ color }}>{trustScore.score}/100</span>
                        <span
                          className={`px-3 py-1 rounded-full text-sm font-medium ${
                            trustScore.score >= 80
                              ? 'bg-green-100 text-green-700'
                              : trustScore.score >= 60
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {trustScore.score >= 80 ? 'Excellent' : trustScore.score >= 60 ? 'Good' : 'Fair'}
                        </span>
                      </div>
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full transition-all"
                          style={{ width: `${trustScore.score}%`, backgroundColor: color }}
                        ></div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm text-gray-600">DID Resolution</div>
                        <div className="text-xl font-semibold text-gray-900">
                          {trustScore.breakdown.didResolution}/25
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-600">DLT Anchoring</div>
                        <div className="text-xl font-semibold text-gray-900">
                          {trustScore.breakdown.anchoring}/25
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-600">Credentials</div>
                        <div className="text-xl font-semibold text-gray-900">
                          {trustScore.breakdown.credentials}/25
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-600">Hierarchy</div>
                        <div className="text-xl font-semibold text-gray-900">
                          {trustScore.breakdown.hierarchy}/25
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Product Information</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-gray-600">Owner</div>
                    <div className="text-sm font-mono text-gray-900 break-words">{dpp.owner}</div>
                  </div>
                  {dpp.custodian && (
                    <div>
                      <div className="text-sm text-gray-600">Custodian</div>
                      <div className="text-sm font-mono text-gray-900 break-words">{dpp.custodian}</div>
                    </div>
                  )}
                  <div>
                    <div className="text-sm text-gray-600">Created</div>
                    <div className="text-sm text-gray-900">
                      {new Date(dpp.created_at).toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Updated</div>
                    <div className="text-sm text-gray-900">
                      {new Date(dpp.updated_at).toLocaleString()}
                    </div>
                  </div>
                </div>

                {dpp.metadata && Object.keys(dpp.metadata).length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="text-sm font-medium text-gray-700 mb-2">Metadata</div>
                    <button
                      className="text-sm text-blue-600 hover:text-blue-700"
                      onClick={() => {
                        const el = document.getElementById('metadata-' + dpp.id);
                        if (el) el.classList.toggle('hidden');
                      }}
                    >
                      View Metadata
                    </button>
                    <div id={`metadata-${dpp.id}`} className="hidden mt-2 p-3 bg-gray-50 rounded text-xs font-mono overflow-auto max-h-48">
                      {(() => {
                        const { declarationOfPerformance, ...restMetadata } = dpp.metadata;
                        const displayMetadata = Object.keys(restMetadata).length > 0 ? restMetadata : dpp.metadata;
                        return Object.entries(displayMetadata).map(([key, value]) => (
                          <div key={key} className="mb-1">
                            <span className="text-gray-600">{key}:</span>{' '}
                            <span className="text-gray-900">
                              {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                            </span>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                )}
              </div>

              {sustainabilitySpecs && (
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Aggregated Sustainability</h2>
                  <div className="grid grid-cols-3 gap-4">
                    {(sustainabilitySpecs.spec_data as any).co2Footprint !== undefined && (
                      <div>
                        <div className="text-sm text-gray-600">Total CO₂ Footprint</div>
                        <div className="text-2xl font-bold text-gray-900">
                          {(sustainabilitySpecs.spec_data as any).co2Footprint}
                          <span className="text-sm text-gray-600 ml-1">kg</span>
                        </div>
                      </div>
                    )}
                    {(sustainabilitySpecs.spec_data as any).recycledContent !== undefined && (
                      <div>
                        <div className="text-sm text-gray-600">Avg Recycled Content</div>
                        <div className="text-2xl font-bold text-gray-900">
                          {(sustainabilitySpecs.spec_data as any).recycledContent}
                          <span className="text-sm text-gray-600 ml-1">%</span>
                        </div>
                      </div>
                    )}
                    {(sustainabilitySpecs.spec_data as any).recyclability !== undefined && (
                      <div>
                        <div className="text-sm text-gray-600">Avg Recyclability</div>
                        <div className="text-2xl font-bold text-gray-900">
                          {(sustainabilitySpecs.spec_data as any).recyclability}
                          <span className="text-sm text-gray-600 ml-1">%</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-6">
              {data.parent && (
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Parent Product</h2>
                  <button
                    onClick={() => onNavigate(data.parent.did)}
                    className="w-full p-3 rounded-lg transition-colors text-left border border-blue-200 bg-blue-50 hover:bg-blue-100"
                  >
                    <div className="font-medium text-gray-900 text-sm mb-1">{data.parent.model}</div>
                    <div className="text-xs text-gray-600 font-mono truncate">{data.parent.did}</div>
                  </button>
                </div>
              )}

              {data.attestations && data.attestations.length > 0 && (
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Activity className="w-5 h-5" style={{ color }} />
                    Recent Attestations
                  </h2>
                  <div className="space-y-3">
                    {data.attestations.slice(0, 3).map((att: any) => (
                      <div key={att.id} className="text-sm">
                        <div className="font-medium text-gray-900 capitalize">
                          {att.attestation_type.replace(/_/g, ' ')}
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(att.timestamp).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'specifications' && (() => {
          const dop = getDoP(dpp);
          const canEdit = currentRole === 'Manufacturer';
          return (
            <div className="space-y-6">
              {dop ? (
                <DoPerformanceView dop={dop} onEdit={canEdit ? () => setEditingDoP(true) : undefined} />
              ) : (
                <div className="bg-white rounded-lg border border-gray-200 p-6 text-center">
                  <p className="text-gray-500 mb-4">No Declaration of Performance available.</p>
                  {canEdit && (
                    <button
                      onClick={() => setEditingDoP(true)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Create DoP
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {activeTab === 'sustainability' && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Leaf className="w-5 h-5" style={{ color }} />
              Sustainability Data
            </h2>

            {sustainabilitySpecs ? (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  {(sustainabilitySpecs.spec_data as any).co2Footprint !== undefined && (
                        <div className="p-4 border border-gray-200 rounded-lg">
                          <div className="text-sm text-gray-600">CO₂ Footprint</div>
                          <div className="text-2xl font-bold text-gray-900">
                            {(sustainabilitySpecs.spec_data as any).co2Footprint}
                            <span className="text-sm text-gray-600 ml-1">kg</span>
                          </div>
                        </div>
                      )}

                      {(sustainabilitySpecs.spec_data as any).recycledContent !== undefined && (
                        <div className="p-4 border border-gray-200 rounded-lg">
                          <div className="text-sm text-gray-600">Recycled Content</div>
                          <div className="text-2xl font-bold text-gray-900">
                            {(sustainabilitySpecs.spec_data as any).recycledContent}
                            <span className="text-sm text-gray-600 ml-1">%</span>
                          </div>
                        </div>
                      )}

                      {(sustainabilitySpecs.spec_data as any).recyclability && (
                        <div className="p-4 border border-gray-200 rounded-lg">
                          <div className="text-sm text-gray-600">Recyclability</div>
                          <div className="text-2xl font-bold text-gray-900">
                            {(sustainabilitySpecs.spec_data as any).recyclability}
                            <span className="text-sm text-gray-600 ml-1">%</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {(sustainabilitySpecs.spec_data as any).certifications && (
                      <div className="mt-4">
                        <div className="text-sm text-gray-600 mb-2">Certifications</div>
                        <div className="flex flex-wrap gap-2">
                          {(sustainabilitySpecs.spec_data as any).certifications.map((cert: string) => (
                            <span
                              key={cert}
                              className="px-3 py-1 rounded-full text-sm"
                              style={{
                                backgroundColor: `${color}20`,
                                color: color
                              }}
                            >
                              {cert}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-500">No sustainability data available</p>
                )}
              </div>
            )}

            {activeTab === 'credentials' && (
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Award className="w-5 h-5" style={{ color }} />
                  Verifiable Credentials
                </h2>

                {data.credentials.length > 0 ? (
                  <div className="space-y-4">
                    {data.credentials.map((cred: any) => (
                      <div key={cred.id} className="p-4 border border-gray-200 rounded-lg">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="font-semibold text-gray-900 capitalize">
                              {cred.credential_type.replace(/([A-Z])/g, ' $1').trim()}
                            </h3>
                            <p className="text-sm text-gray-600 mt-1">
                              Issued: {new Date(cred.issued_date).toLocaleDateString()}
                            </p>
                            {cred.expiry_date && (
                              <p className="text-sm text-gray-600">
                                Expires: {new Date(cred.expiry_date).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                          <span
                            className={`px-2 py-1 rounded-full text-xs ${
                              cred.verification_status === 'valid'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {cred.verification_status}
                          </span>
                        </div>

                        <div className="text-sm space-y-2">
                          <div>
                            <span className="text-gray-600">Issuer: </span>
                            <span className="font-mono text-xs">{cred.issuer.split(':').pop()}</span>
                          </div>

                          {cred.credential_data && (
                            <div className="mt-3 p-3 bg-gray-50 rounded">
                              <div className="text-xs text-gray-600 mb-2">Credential Data</div>
                              <div className="space-y-1">
                                {Object.entries(cred.credential_data).map(([key, value]) => (
                                  <div key={key} className="flex justify-between text-sm">
                                    <span className="text-gray-600 capitalize">
                                      {key.replace(/([A-Z])/g, ' $1').trim()}:
                                    </span>
                                    <span className="font-medium">
                                      {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500">No verifiable credentials available</p>
                )}
              </div>
            )}

            {activeTab === 'witness' && (
              <WitnessFlowVisualization did={did} />
            )}

            {activeTab === 'anchoring' && (
              <DLTTrustAnchor did={did} />
            )}

            {activeTab === 'events' && (
              <DIDEventsLog key={`events-${data?.dpp?.updated_at}`} did={did} />
            )}
      </div>

      {showQR && <QRCodeDisplay did={did} onClose={() => setShowQR(false)} />}
      
      {editingDoP && data?.dpp && (
        <DoPerformanceEditor
          initialData={getDoP(data.dpp)}
          productType={data.dpp.type}
          onSave={handleSaveDoP}
          onCancel={() => setEditingDoP(false)}
        />
      )}
    </div>
  );
}
