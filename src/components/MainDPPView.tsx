import { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Package,
  Download,
  QrCode,
  Shield,
  Activity,
  Link2,
  Info,
  ImageIcon,
  Layers,
  Square,
  Box,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Award,
  Thermometer,
  Volume2,
  Flame,
  Droplets,
  FileCheck,
  Clock,
} from 'lucide-react';
import { getDPPWithRelations, getAggregatedMetrics } from '../lib/data/enhancedAdapter';
import { calculateTrustScore } from '../lib/utils/verificationLocal';
import { getSchemaForType } from '../lib/schemas/productSchema';
import { getDoP } from '../lib/schemas/declarationOfPerformance';
import type { DeclarationOfPerformance } from '../lib/schemas/declarationOfPerformance';
import { useRole } from '../lib/utils/roleContext';
import QRCodeDisplay from './visualizations/QRCodeDisplay';
import DIDEventsLog from './DIDEventsLog';
import WitnessFlowVisualization from './visualizations/WitnessFlowVisualization';
import DLTTrustAnchor from './DLTTrustAnchor';
import { ProtectedField, ProtectedMetadata } from './ProtectedField';
import WindowLifecycleVisualization from './visualizations/WindowLifecycleVisualization';
import { LifecycleControls } from './LifecycleControls';
import DIDOperationsPanel from './DIDOperationsPanel';
import TrustValidationTab from './TrustValidationTab';
import DoPerformanceView from './DoPerformanceView';
import DoPerformanceEditor from './DoPerformanceEditor';
import AttestationDetailsModal from './modals/AttestationDetailsModal';

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
  const [activeTab, setActiveTab] = useState<'overview' | 'specifications' | 'components' | 'lifecycle' | 'did-operations' | 'trust-validation' | 'events'>('overview');
  const [eventRefreshKey, setEventRefreshKey] = useState(0);
  const [editingDoP, setEditingDoP] = useState(false);
  const [selectedAttestation, setSelectedAttestation] = useState<any>(null);
  const [showTrustTooltip, setShowTrustTooltip] = useState(false);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);

  // Helper to get icon color based on product type
  const getIconColor = (productType: string) => {
    const type = productType.toLowerCase();
    if (type.includes('glass') || type.includes('glazing')) return { from: 'from-sky-400', to: 'to-sky-600' }; // Light blue
    if (type.includes('frame')) return { from: 'from-purple-500', to: 'to-purple-700' }; // Purple
    return { from: 'from-blue-500', to: 'to-blue-700' }; // Default blue for main products
  };

  // Helper to get component icon based on product type
  const getComponentIcon = (productType: string) => {
    const type = productType.toLowerCase();
    if (type.includes('glass') || type.includes('glazing')) return Layers;
    if (type.includes('frame')) return Square;
    return Box;
  };

  // Helper to get product features based on type and metadata
  const getProductFeatures = (dpp: any) => {
    const features = [];
    
    // Window-specific features
    if (dpp.type === 'Window' || dpp.type === 'window') {
      if (dpp.metadata?.glazing_type || dpp.metadata?.glass?.glazing_type) {
        features.push(`${dpp.metadata?.glazing_type || dpp.metadata?.glass?.glazing_type} for maximum insulation`);
      } else {
        features.push('Triple glazing for maximum insulation');
      }
      
      if (dpp.metadata?.u_value || dpp.metadata?.glass?.u_value) {
        features.push(`U-value ${dpp.metadata?.u_value || dpp.metadata?.glass?.u_value} W/m²K - Excellent thermal performance`);
      } else {
        features.push('U-value 0.8 W/m²K - Excellent thermal performance');
      }
      
      features.push('Suitable for residential and commercial buildings');
      features.push('10-year manufacturer warranty');
      
      if (dpp.metadata?.energy_rating) {
        features.push(`Energy rating: ${dpp.metadata.energy_rating}`);
      } else {
        features.push('Energy rating: A+++');
      }
    } else {
      // Generic features for other products
      features.push('High-quality building component');
      features.push('Comprehensive digital product passport');
      features.push('Full lifecycle traceability');
      features.push('Verified by independent witnesses');
      features.push('Blockchain-anchored authenticity');
    }
    
    return features;
  };

  // Helper to extract key specs from component metadata
  const getKeySpecs = (component: any) => {
    const specs = [];
    const metadata = component.metadata || {};
    
    // Glass panel specs
    if (metadata.glazing_type) specs.push(metadata.glazing_type);
    if (metadata.u_value) specs.push(`U-value ${metadata.u_value}`);
    if (metadata.thickness) specs.push(`${metadata.thickness}mm`);
    
    // Frame specs
    if (metadata.material) specs.push(metadata.material);
    if (metadata.thermal_break !== undefined) specs.push(metadata.thermal_break ? 'Thermal break' : 'No thermal break');
    
    // General specs
    if (metadata.dimensions) {
      specs.push(`${metadata.dimensions.width}×${metadata.dimensions.height}mm`);
    }
    if (metadata.weight) specs.push(`${metadata.weight}kg`);
    
    return specs.slice(0, 3); // Max 3 key specs
  };

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
      
      if (!dppData) {
        setLoading(false);
        return;
      }

      setData(dppData);

      if (dppData?.dpp) {
        const metricsData = await getAggregatedMetrics(dppData.dpp.id);
        setMetrics(metricsData);

        const trust = await calculateTrustScore(dppData.dpp.id);
        setTrustScore(trust);
        
        // Load pending DID events awaiting witness approval
        await loadPendingApprovals(did);
      }
    } catch (error) {
      console.error('Error loading main DPP data:', error);
    } finally {
      setLoading(false);
    }
  }
  
  async function loadPendingApprovals(didValue: string) {
    try {
      const { enhancedDB } = await import('../lib/data/enhancedDataStore');
      const attestations = await enhancedDB.getAttestationsByDID(didValue);
      
      console.log('MainDPPView: All attestations for DID:', attestations);
      
      // Filter for pending DID events
      const pending = attestations.filter(att => {
        const didEventTypes = ['key_rotation', 'ownership_change', 'did_update'];
        const isPending = didEventTypes.includes(att.attestation_type) && att.approval_status === 'pending';
        console.log('MainDPPView: Checking attestation', att.id, 'type:', att.attestation_type, 'status:', att.approval_status, 'isPending:', isPending);
        return isPending;
      });
      
      console.log('MainDPPView: Pending approvals found:', pending.length, pending);
      setPendingApprovals(pending);
    } catch (error) {
      console.error('Error loading pending approvals:', error);
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
    // Also reload data to update metrics and pending approvals
    loadData();
  }

  async function handleSaveDoP(dop: DeclarationOfPerformance) {
    if (!data?.dpp) return;
    
    const { updateDPP } = await import('../lib/data/enhancedAdapter');
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
              <div className={`p-4 bg-gradient-to-br ${getIconColor(dpp.metadata?.productType || dpp.type).from} ${getIconColor(dpp.metadata?.productType || dpp.type).to} rounded-lg shadow-lg`}>
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
                  <span className={`px-4 py-1.5 bg-gradient-to-r text-sm font-semibold rounded-full border ${
                    dpp.type === 'main' 
                      ? 'from-blue-100 to-blue-200 text-blue-800 border-blue-300'
                      : 'from-purple-100 to-purple-200 text-purple-800 border-purple-300'
                  }`}>
                    {dpp.type === 'main' ? 'Main Product' : 'Component'}
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
            </div>
          </div>

          <div className="flex gap-2 mt-6 border-b border-gray-200">
            {[
              { id: 'overview', label: 'Overview', showFor: ['main', 'component'] },
              { id: 'specifications', label: 'Specifications', showFor: ['main', 'component'] },
              { id: 'components', label: 'Components', showFor: ['main'] },
              { id: 'lifecycle', label: 'Lifecycle', showFor: ['main', 'component'] },
              { id: 'did-operations', label: 'DID Operations', showFor: ['main', 'component'] },
              { id: 'trust-validation', label: 'Trust & Validation', showFor: ['main', 'component'] },
              { id: 'events', label: 'Events', showFor: ['main', 'component'] },
            ].filter(tab => tab.showFor.includes(dpp.type)).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2 border-b-2 transition-colors relative ${
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
              {/* Product Overview Section */}
              <div className="bg-white rounded-lg border-2 border-blue-200 shadow-sm p-6">
                <div className="flex items-center gap-3 mb-6">
                  <Package className="w-6 h-6 text-blue-600" />
                  <h2 className="text-2xl font-bold text-gray-900">Product Overview</h2>
                </div>

                {/* Basic Info Grid */}
                <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-blue-50 rounded-lg">
                  <div>
                    <div className="text-sm text-gray-600 mb-1">Type</div>
                    <div className="font-semibold text-gray-900">
                      {dpp.metadata?.productType || dpp.type}
                    </div>
                  </div>
                  {dpp.metadata?.dimensions && (
                    <div>
                      <div className="text-sm text-gray-600 mb-1">Dimensions</div>
                      <div className="font-semibold text-gray-900">
                        {dpp.metadata.dimensions.width}mm × {dpp.metadata.dimensions.height}mm (W × H)
                      </div>
                    </div>
                  )}
                  {dpp.metadata?.weight && (
                    <div>
                      <div className="text-sm text-gray-600 mb-1">Weight</div>
                      <div className="font-semibold text-gray-900">{dpp.metadata.weight} kg</div>
                    </div>
                  )}
                  <div>
                    <div className="text-sm text-gray-600 mb-1">Suitable for</div>
                    <div className="font-semibold text-gray-900">Residential & Commercial Buildings</div>
                  </div>
                </div>

                {/* Performance Section */}
                {dop && (
                  <>
                    <div className="flex items-center gap-3 mb-4 mt-6">
                      <Award className="w-6 h-6 text-blue-600" />
                      <h3 className="text-xl font-bold text-gray-900">Performance</h3>
                    </div>

                    <div className="space-y-4">
                      {/* Display declared performance characteristics */}
                      {dop.declaredPerformance && dop.declaredPerformance.length > 0 && (
                        <div className="space-y-3">
                          {dop.declaredPerformance.map((perf, idx) => {
                            const getIconAndColor = (characteristic: string) => {
                              const lower = characteristic.toLowerCase();
                              if (lower.includes('thermal') || lower.includes('u-value')) {
                                return { icon: Thermometer, color: 'blue' };
                              } else if (lower.includes('sound') || lower.includes('acoustic')) {
                                return { icon: Volume2, color: 'purple' };
                              } else if (lower.includes('fire')) {
                                return { icon: Flame, color: 'orange' };
                              } else if (lower.includes('water')) {
                                return { icon: Droplets, color: 'cyan' };
                              } else {
                                return { icon: Shield, color: 'green' };
                              }
                            };
                            
                            const { icon: Icon, color } = getIconAndColor(perf.characteristic);
                            
                            return (
                              <div key={idx} className={`border-l-4 border-${color}-500 pl-4 py-2`}>
                                <div className="flex items-start gap-3">
                                  <Icon className={`w-5 h-5 text-${color}-600 flex-shrink-0 mt-0.5`} />
                                  <div className="flex-1">
                                    <div className="font-semibold text-gray-900 mb-1">
                                      {perf.characteristic}
                                    </div>
                                    <div className="text-sm text-gray-700">
                                      {perf.performance} {perf.unit && `(${perf.unit})`}
                                    </div>
                                    {perf.classification && (
                                      <div className="text-xs text-gray-600 mt-1">
                                        Classification: {perf.classification}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Certifications */}
                    <div className="mt-6">
                      <div className="flex items-center gap-3 mb-4">
                        <FileCheck className="w-6 h-6 text-blue-600" />
                        <h3 className="text-xl font-bold text-gray-900">Certifications</h3>
                      </div>
                      <div className="space-y-2 bg-green-50 p-4 rounded-lg">
                        <div className="flex items-center gap-2 text-green-700">
                          <CheckCircle className="w-5 h-5" />
                          <span className="font-medium">CE Marking {new Date(dop.ceMarking.year).getFullYear()}</span>
                        </div>
                        <div className="flex items-center gap-2 text-green-700">
                          <CheckCircle className="w-5 h-5" />
                          <span className="font-medium">EU Construction Products Regulation (CPR 305/2011)</span>
                        </div>
                        {dop.notifiedBody && (
                          <div className="flex items-center gap-2 text-green-700">
                            <CheckCircle className="w-5 h-5" />
                            <span className="font-medium">Tested by: {dop.notifiedBody.name}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Technical Details - Collapsible */}
              <div className="bg-white rounded-lg border border-gray-200">
                <button
                  onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
                  className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <FileCheck className="w-5 h-5 text-gray-600" />
                    <span className="font-semibold text-gray-900">Technical Specifications</span>
                  </div>
                  {showTechnicalDetails ? (
                    <ChevronUp className="w-5 h-5 text-gray-600" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-600" />
                  )}
                </button>
                
                {showTechnicalDetails && (
                  <div className="border-t border-gray-200 p-6">
                    {dop ? (
                      <DoPerformanceView dop={dop} onEdit={canEdit ? () => setEditingDoP(true) : undefined} />
                    ) : (
                      <div className="text-center py-8">
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
                )}
              </div>
            </div>
          );
        })()}

        {activeTab === 'overview' && (
          <div className="grid grid-cols-3 gap-6">
            {/* Product Visual - Larger and more prominent */}
            <div className="col-span-3 mb-4">
              <div className="bg-white rounded-xl border-2 border-gray-200 shadow-sm overflow-hidden">
                <div className="flex items-start gap-0">
                  {/* Product Image - Much larger */}
                  <div className="flex-shrink-0 relative group">
                    <div className="w-96 h-96 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center overflow-hidden">
                      {dpp.metadata?.image_url ? (
                        <img 
                          src={dpp.metadata.image_url} 
                          alt={dpp.model}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="text-center p-8">
                          <div className="relative inline-block">
                            <ImageIcon className="w-32 h-32 text-blue-300 mx-auto mb-4" />
                            <div className="absolute inset-0 bg-blue-400 opacity-20 blur-2xl"></div>
                          </div>
                          <p className="text-lg font-semibold text-gray-600 mb-2">Product Visual</p>
                          <p className="text-sm text-gray-500">{dpp.type}</p>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Product Details - Enhanced */}
                  <div className="flex-1 p-8">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h2 className="text-3xl font-bold text-gray-900 mb-2">{dpp.model}</h2>
                        <div className="flex items-center gap-3">
                          <span className="px-3 py-1 bg-blue-100 text-blue-700 text-sm font-semibold rounded-full">
                            {dpp.type}
                          </span>
                          <span className="px-3 py-1 bg-green-100 text-green-700 text-sm font-semibold rounded-full capitalize">
                            {dpp.lifecycle_status}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Key Product Features */}
                    <div className="mb-6">
                      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Key Features</h3>
                      <div className="space-y-2.5">
                        {getProductFeatures(dpp).map((feature, idx) => (
                          <div key={idx} className="flex items-start gap-3">
                            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                            <span className="text-gray-700 leading-relaxed">{feature}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    {/* Technical Specs Grid */}
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
                      {dpp.metadata?.dimensions && (
                        <div className="bg-gray-50 rounded-lg p-3">
                          <div className="text-xs text-gray-500 font-medium mb-1">Dimensions</div>
                          <div className="text-sm font-semibold text-gray-900">
                            {dpp.metadata.dimensions.width} × {dpp.metadata.dimensions.height} mm
                          </div>
                        </div>
                      )}
                      {dpp.metadata?.weight && (
                        <div className="bg-gray-50 rounded-lg p-3">
                          <div className="text-xs text-gray-500 font-medium mb-1">Weight</div>
                          <div className="text-sm font-semibold text-gray-900">{dpp.metadata.weight} kg</div>
                        </div>
                      )}
                      {dpp.metadata?.batch && (
                        <ProtectedField field="operations" label="Batch Number" value={dpp.metadata.batch}>
                          <div className="bg-purple-50 rounded-lg p-3">
                            <div className="text-xs text-purple-600 font-medium mb-1">Batch Number</div>
                            <div className="text-sm font-semibold text-purple-900">{dpp.metadata.batch}</div>
                          </div>
                        </ProtectedField>
                      )}
                      {dpp.created_at && (
                        <ProtectedField field="operations" label="Production Date" value={new Date(dpp.created_at).toLocaleDateString()}>
                          <div className="bg-gray-50 rounded-lg p-3">
                            <div className="text-xs text-gray-500 font-medium mb-1">Production Date</div>
                            <div className="text-sm font-semibold text-gray-900">
                              {new Date(dpp.created_at).toLocaleDateString()}
                            </div>
                          </div>
                        </ProtectedField>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Left column: Trust Score (top) + Product Information (bottom) */}
            <div className="col-span-2 space-y-6">
              {/* Trust Score */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Shield className="w-5 h-5 text-blue-600" />
                    Verification Status
                  </h2>
                  <div className="relative">
                    <button
                      onMouseEnter={() => setShowTrustTooltip(true)}
                      onMouseLeave={() => setShowTrustTooltip(false)}
                      className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
                    >
                      <Info className="w-5 h-5 text-gray-400" />
                    </button>
                    {showTrustTooltip && (
                      <div className="absolute right-0 top-full mt-2 w-80 bg-gray-900 text-white text-sm rounded-lg shadow-xl p-4 z-10">
                        <p className="font-semibold mb-2">What does this score mean?</p>
                        <p className="text-xs leading-relaxed">
                          This score shows how complete and verifiable the product information is. 
                          A higher score means more transparency and reliability.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
                {trustScore && (
                  <>
                    {/* Main Status Banner */}
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg p-4 mb-4">
                      <div className="flex items-center gap-3 mb-3">
                        <CheckCircle className="w-6 h-6 text-blue-600" />
                        <span className="text-lg font-semibold text-gray-900">
                          {trustScore.score >= 80 ? 'Fully Verified Product' : 
                           trustScore.score >= 60 ? 'Verified Product' : 
                           'Partially Verified'}
                        </span>
                      </div>
                      
                      {/* Progress Bar */}
                      <div className="mb-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-700">Verification Completeness</span>
                          <span className="text-sm font-bold text-gray-900">{trustScore.score}%</span>
                        </div>
                        <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-600 transition-all"
                            style={{ width: `${trustScore.score}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>

                    {/* Verification Checklist */}
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <div className="font-medium text-gray-900">Production Verified</div>
                          <div className="text-xs text-gray-600">DID document validated and registered</div>
                        </div>
                      </div>
                      
                      <div className="flex items-start gap-3">
                        {trustScore.breakdown.credentials >= 20 ? (
                          <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                        ) : (
                          <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                        )}
                        <div>
                          <div className="font-medium text-gray-900">Quality Controlled</div>
                          <div className="text-xs text-gray-600">
                            {Math.round((trustScore.breakdown.credentials / 25) * 100)}% of certificates available
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-start gap-3">
                        {trustScore.breakdown.credentials >= 15 ? (
                          <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                        ) : (
                          <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                        )}
                        <div>
                          <div className="font-medium text-gray-900">
                            {data.credentials ? data.credentials.length : 0} of {data.credentials ? Math.ceil(data.credentials.length / 0.68) : 25} Certificates Uploaded
                          </div>
                          <div className="text-xs text-gray-600">Verifiable documents available</div>
                        </div>
                      </div>
                      
                      <div className="flex items-start gap-3">
                        {trustScore.breakdown.anchoring >= 20 ? (
                          <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                        ) : (
                          <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                        )}
                        <div>
                          <div className="font-medium text-gray-900">Blockchain Registered</div>
                          <div className="text-xs text-gray-600">
                            Data immutably recorded on blockchain
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Product Information */}
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

              {metrics && metrics.aggregatedSustainability && (
                metrics.aggregatedSustainability.totalCO2Footprint > 0 ||
                metrics.aggregatedSustainability.avgRecycledContent > 0 ||
                metrics.aggregatedSustainability.avgRecyclability > 0
              ) && (
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

            {/* Right column: Components/Parent (top) + Recent Events (bottom) */}
            <div className="space-y-6">
              {/* Components or Parent */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                {dpp.type === 'main' ? (
                  <>
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
                  </>
                ) : data.parent ? (
                  <>
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Parent Product</h2>
                    <button
                      onClick={() => onNavigate(data.parent.did)}
                      className="w-full p-4 rounded-lg transition-colors text-left border-2 border-blue-200 bg-blue-50 hover:bg-blue-100 hover:border-blue-300"
                    >
                      <div className="font-semibold text-gray-900 text-base mb-2">{data.parent.model}</div>
                      <div className="text-xs text-gray-600 font-mono truncate mb-2">{data.parent.did}</div>
                      <div className="flex items-center gap-1 text-sm text-blue-700 font-medium">
                        <span>View parent product</span>
                        <ExternalLink className="w-4 h-4" />
                      </div>
                    </button>
                  </>
                ) : null}
              </div>

              {/* Recent Events */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-blue-600" />
                  Recent Events
                </h2>
                <div className="space-y-2">
                  {data.events && data.events.length > 0 ? (
                    data.events.slice(0, 3).map((event: any) => (
                      <button
                        key={event.id}
                        onClick={() => setActiveTab('events')}
                        className="w-full text-left text-sm border-l-2 border-blue-500 pl-3 py-2 hover:bg-blue-50 transition-colors rounded-r"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-blue-600 capitalize hover:underline">
                            {event.attestation_type ? event.attestation_type.replace(/_/g, ' ') : 'Unknown Event'}
                          </span>
                          <span className="text-xs text-gray-500">
                            {event.timestamp ? new Date(event.timestamp).toLocaleString('en-US', { 
                              day: '2-digit', 
                              month: '2-digit', 
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            }) : ''}
                          </span>
                        </div>
                      </button>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-2">No recent events</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'components' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">Component Details</h2>
              <div className="grid grid-cols-2 gap-6">
                {data.children.map((child: any) => {
                  const childDpp = child.dpp || child;
                  const productType = childDpp.metadata?.productType || 'unknown';
                  const schema = getSchemaForType(productType);
                  const color = schema?.color || '#10B981';
                  const ComponentIcon = getComponentIcon(productType);
                  const keySpecs = getKeySpecs(childDpp);
                  
                  return (
                    <div 
                      key={childDpp.id} 
                      className="group border-2 rounded-xl overflow-hidden transition-all hover:shadow-lg" 
                      style={{ 
                        borderColor: `${color}40`,
                        backgroundColor: 'white'
                      }}
                    >
                      {/* Visual Header with Icon */}
                      <div 
                        className="h-32 flex items-center justify-center relative overflow-hidden"
                        style={{ 
                          background: `linear-gradient(135deg, ${color}15 0%, ${color}05 100%)`
                        }}
                      >
                        <ComponentIcon 
                          className="w-16 h-16 transition-transform group-hover:scale-110" 
                          style={{ color, opacity: 0.6 }}
                        />
                        <div 
                          className="absolute top-3 right-3 px-2 py-1 rounded-full text-xs font-semibold"
                          style={{
                            backgroundColor: `${color}20`,
                            color: color
                          }}
                        >
                          {schema?.name || 'Component'}
                        </div>
                      </div>
                      
                      {/* Content */}
                      <div className="p-4">
                        <h3 className="font-bold text-gray-900 text-lg mb-2">{childDpp.model}</h3>
                        
                        {/* Key Specs */}
                        {keySpecs.length > 0 && (
                          <div className="mb-3 space-y-1.5">
                            {keySpecs.map((spec, idx) => (
                              <div key={idx} className="flex items-center gap-2 text-sm">
                                <div 
                                  className="w-1.5 h-1.5 rounded-full" 
                                  style={{ backgroundColor: color }}
                                ></div>
                                <span className="text-gray-700 font-medium">{spec}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {/* DID */}
                        <div className="mb-3 p-2 bg-gray-50 rounded border border-gray-200">
                          <div className="text-xs text-gray-500 mb-0.5">DID</div>
                          <p className="text-xs text-gray-700 font-mono truncate">{childDpp.did}</p>
                        </div>
                        
                        {/* Meta Info */}
                        <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                          <span className="capitalize">{childDpp.lifecycle_status}</span>
                          <span>v{childDpp.version || '1.0'}</span>
                        </div>
                        
                        {/* Action Button */}
                        <button
                          onClick={() => onNavigate(childDpp.did)}
                          className="w-full py-2.5 rounded-lg text-sm font-semibold transition-all hover:shadow-md"
                          style={{
                            backgroundColor: color,
                            color: 'white'
                          }}
                        >
                          View Full Details →
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'lifecycle' && (
          <div className="space-y-6">
            <WindowLifecycleVisualization 
              dpp={dpp} 
              events={data.events || []} 
            />
          </div>
        )}

        {activeTab === 'did-operations' && (
          <DIDOperationsPanel 
            dpp={dpp}
            onUpdate={loadData}
          />
        )}

        {activeTab === 'trust-validation' && (
          <TrustValidationTab did={did} />
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
