import { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Package,
  Download,
  QrCode,
  Shield,
  Activity,
  Link2,
} from 'lucide-react';
import { getDPPWithRelations, getAggregatedMetrics, exportDPPHierarchyToJSON } from '../lib/enhancedAdapter';
import { calculateTrustScore } from '../lib/verificationLocal';
import { getSchemaForType } from '../lib/schemas/productSchema';
import { getDoP } from '../lib/schemas/declarationOfPerformance';
import type { DeclarationOfPerformance } from '../lib/schemas/declarationOfPerformance';
import { useRole } from '../lib/roleContext';
import QRCodeDisplay from './QRCodeDisplay';
import DIDEventsLog from './DIDEventsLog';
import WitnessFlowVisualization from './WitnessFlowVisualization';
import DLTTrustAnchor from './DLTTrustAnchor';
import { ProtectedField, ProtectedMetadata } from './ProtectedField';
import DIDLifecycleVisualization from './DIDLifecycleVisualization';
import WindowLifecycleVisualization from './WindowLifecycleVisualization';
import { LifecycleControls } from './LifecycleControls';
import DoPerformanceView from './DoPerformanceView';
import DoPerformanceEditor from './DoPerformanceEditor';
import AttestationDetailsModal from './AttestationDetailsModal';

export default function MainDPPView({ did, onBack, onNavigate }: {
  did: string;
  onBack: () => void;
  onNavigate: (did: string) => void;
}) {
  const { currentRole } = useRole();
  const [data, setData] = useState<any>(null);
  const [metrics, setMetrics] = useState<any>(null);
  const [trustScore, setTrustScore] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showQR, setShowQR] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'specifications' | 'components' | 'lifecycle' | 'witness' | 'anchoring' | 'events'>('overview');
  const [eventRefreshKey, setEventRefreshKey] = useState(0);
  const [editingDoP, setEditingDoP] = useState(false);
  const [selectedAttestation, setSelectedAttestation] = useState<any>(null);

  useEffect(() => {
    console.log('MainDPPView mounted with DID:', did);
    loadData();
  }, [did]);

  async function loadData() {
    console.log('MainDPPView loading data for:', did);
    setLoading(true);
    try {
      const dppData = await getDPPWithRelations(did);
      console.log('MainDPPView data loaded:', dppData);
      setData(dppData);

      if (dppData?.dpp) {
        const metricsData = await getAggregatedMetrics(dppData.dpp.id);
        setMetrics(metricsData);

        const trust = await calculateTrustScore(dppData.dpp.id);
        setTrustScore(trust);
      }
    } catch (error) {
      console.error('Error loading main DPP data:', error);
    } finally {
      setLoading(false);
    }
  }

  function handleEventCreated() {
    console.log('MainDPPView: handleEventCreated called, incrementing refresh key');
    // Increment the refresh key to force DIDEventsLog to re-render
    setEventRefreshKey(prev => {
      const newKey = prev + 1;
      console.log('MainDPPView: eventRefreshKey updated from', prev, 'to', newKey);
      return newKey;
    });
    // Also reload data to update metrics if needed
    loadData();
  }

  async function handleExport() {
    const json = await exportDPPHierarchyToJSON(did);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dpp-${did.split(':').pop()}.json`;
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
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-gray-500 mt-4">Loading DPP...</p>
        </div>
      </div>
    );
  }

  if (!data || !data.dpp) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600">DPP not found</p>
          <button onClick={onBack} className="mt-4 text-blue-600 hover:underline">
            Go back
          </button>
        </div>
      </div>
    );
  }

  const dpp = data.dpp;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Dashboard
          </button>

          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4 flex-1">
              <div className="p-4 bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg shadow-lg">
                <Package className="w-8 h-8 text-white" />
              </div>
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-gray-900 mb-3">{dpp.model}</h1>
                
                {/* Prominent DID Display */}
                <div className="bg-gradient-to-r from-blue-50 via-purple-50 to-blue-50 border-2 border-blue-500 rounded-lg p-4 mb-3 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <Link2 className="w-5 h-5 text-blue-600" />
                    <span className="text-sm font-bold text-blue-900 uppercase tracking-wide">DID:webvh Identifier</span>
                  </div>
                  <p className="text-base text-gray-900 font-mono break-all leading-relaxed">{dpp.did}</p>
                </div>

                <div className="flex items-center gap-3">
                  <span className="px-4 py-1.5 bg-gradient-to-r from-blue-100 to-blue-200 text-blue-800 text-sm font-semibold rounded-full border border-blue-300">
                    Main Product
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
              { id: 'components', label: 'Components' },
              { id: 'lifecycle', label: 'Lifecycle' },
              { id: 'witness', label: 'Witness Flow' },
              { id: 'anchoring', label: 'DLT Anchor' },
              { id: 'events', label: 'Event Log' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2 border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600 font-medium'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === 'specifications' && (() => {
          const dop = getDoP(dpp);
          const canEdit = currentRole === 'Manufacturer';
          return (
            <div className="space-y-6">
              {dop ? (
                <DoPerformanceView dop={dop} onEdit={canEdit ? () => setEditingDoP(true) : undefined} />
              ) : (
                <div className="bg-white rounded-lg border border-gray-200 p-6 text-center">
                  <p className="text-gray-500 mb-4">No Declaration of Performance available for this product.</p>
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

        {activeTab === 'overview' && (
          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-2 space-y-6">
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-blue-600" />
                  Trust Score
                </h2>
                {trustScore && (
                  <>
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-3xl font-bold text-blue-600">{trustScore.score}/100</span>
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
                          className="h-full bg-blue-600 transition-all"
                          style={{ width: `${trustScore.score}%` }}
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
                  <ProtectedField field="basic" label="Owner" value={dpp.owner}>
                    <div>
                      <div className="text-sm text-gray-600">Owner</div>
                      <div className="text-sm font-mono text-gray-900 break-all">{dpp.owner}</div>
                    </div>
                  </ProtectedField>
                  {dpp.custodian && (
                    <ProtectedField field="operations" label="Custodian" value={dpp.custodian}>
                      <div>
                        <div className="text-sm text-gray-600">Custodian</div>
                        <div className="text-sm font-mono text-gray-900 break-all">{dpp.custodian}</div>
                      </div>
                    </ProtectedField>
                  )}
                  <ProtectedField field="operations" label="Created" value={new Date(dpp.created_at).toLocaleString()}>
                    <div>
                      <div className="text-sm text-gray-600">Created</div>
                      <div className="text-sm text-gray-900">
                        {new Date(dpp.created_at).toLocaleString()}
                      </div>
                    </div>
                  </ProtectedField>
                  <ProtectedField field="operations" label="Updated" value={new Date(dpp.updated_at).toLocaleString()}>
                    <div>
                      <div className="text-sm text-gray-600">Updated</div>
                      <div className="text-sm text-gray-900">
                        {new Date(dpp.updated_at).toLocaleString()}
                      </div>
                    </div>
                  </ProtectedField>
                </div>

                {dpp.metadata && Object.keys(dpp.metadata).length > 0 && (
                  <ProtectedMetadata metadata={dpp.metadata} />
                )}
              </div>

              {metrics && (
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Aggregated Sustainability</h2>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <div className="text-sm text-gray-600">Total CO₂ Footprint</div>
                      <div className="text-2xl font-bold text-gray-900">
                        {metrics.aggregatedSustainability.totalCO2Footprint.toFixed(1)}
                        <span className="text-sm text-gray-600 ml-1">kg</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Avg Recycled Content</div>
                      <div className="text-2xl font-bold text-gray-900">
                        {metrics.aggregatedSustainability.avgRecycledContent.toFixed(0)}
                        <span className="text-sm text-gray-600 ml-1">%</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Avg Recyclability</div>
                      <div className="text-2xl font-bold text-gray-900">
                        {metrics.aggregatedSustainability.avgRecyclability.toFixed(0)}
                        <span className="text-sm text-gray-600 ml-1">%</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-6">
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Components</h2>
                <div className="text-3xl font-bold text-blue-600 mb-2">{data.children.length}</div>
                <div className="text-sm text-gray-600 mb-4">Total components</div>

                <div className="space-y-2">
                  {data.children.map((child: any) => {
                    const childDpp = child.dpp || child;
                    const productType = childDpp.metadata?.productType || 'unknown';
                    const schema = getSchemaForType(productType);
                    const color = schema?.color || '#10B981';
                    
                    console.log('Rendering child button:', childDpp.did, childDpp.model);
                    return (
                      <button
                        key={childDpp.id}
                        onClick={() => {
                          console.log('Child component clicked:', childDpp.did);
                          onNavigate(childDpp.did);
                        }}
                        className="w-full p-3 rounded-lg transition-colors text-left border"
                        style={{
                          backgroundColor: `${color}10`,
                          borderColor: `${color}40`
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = `${color}20`;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = `${color}10`;
                        }}
                      >
                        <div className="font-medium text-gray-900 text-sm mb-1">{childDpp.model}</div>
                        <div className="text-xs text-gray-600 font-mono truncate">{childDpp.did}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-blue-600" />
                  Recent Attestations
                </h2>
                <div className="space-y-3">
                  {data.attestations.slice(0, 3).map((att: any) => (
                    <div key={att.id} className="text-sm">
                      <button
                        onClick={() => setSelectedAttestation(att)}
                        className="font-medium text-blue-600 hover:text-blue-700 hover:underline capitalize text-left"
                      >
                        {att.attestation_type.replace(/_/g, ' ')}
                      </button>
                      <div className="text-xs text-gray-500">
                        {new Date(att.timestamp).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'components' && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Component Details</h2>
            <div className="space-y-4">
              {data.children.map((child: any) => {
                const childDpp = child.dpp || child;
                const productType = childDpp.metadata?.productType || 'unknown';
                const schema = getSchemaForType(productType);
                const color = schema?.color || '#10B981';
                
                return (
                  <div key={childDpp.id} className="p-4 border rounded-lg" style={{ 
                    borderColor: `${color}40`,
                    backgroundColor: `${color}05`
                  }}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }}></div>
                          <h3 className="font-semibold text-gray-900">{childDpp.model}</h3>
                        </div>
                        <p className="text-sm text-gray-600 font-mono mt-1">{childDpp.did}</p>
                        <div className="flex gap-4 mt-2 text-sm text-gray-600">
                          <span>Owner: {childDpp.owner?.split(':').pop() || 'Unknown'}</span>
                          <span className="capitalize">{childDpp.lifecycle_status}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => onNavigate(childDpp.did)}
                        className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors hover:opacity-80"
                        style={{
                          backgroundColor: color,
                          color: 'white'
                        }}
                      >
                        View Details →
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'lifecycle' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <DIDLifecycleVisualization 
                did={did} 
                didDocument={data.didDocument} 
                anchoringEvents={data.anchoringEvents || []} 
              />
              <WindowLifecycleVisualization 
                dpp={dpp} 
                events={data.events || []} 
              />
            </div>
          </div>
        )}

        {activeTab === 'witness' && (
          <WitnessFlowVisualization did={did} />
        )}

        {activeTab === 'anchoring' && (
          <DLTTrustAnchor did={did} />
        )}

        {activeTab === 'events' && (
          <>
            <LifecycleControls 
              dppId={dpp.id}
              did={did}
              onEventCreated={handleEventCreated}
            />
            <DIDEventsLog key={`events-${eventRefreshKey}`} did={did} />
          </>
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

      {selectedAttestation && (
        <AttestationDetailsModal
          attestation={selectedAttestation}
          onClose={() => setSelectedAttestation(null)}
        />
      )}
    </div>
  );
}
