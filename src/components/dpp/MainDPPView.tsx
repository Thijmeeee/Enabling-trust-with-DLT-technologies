import { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Package,
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
  FileJson,
  FileEdit,
  ShieldCheck,
  Recycle,
  Clock,
} from 'lucide-react';
import { getDPPWithRelations, getAggregatedMetrics } from '../../lib/data/enhancedAdapter';
import { calculateTrustScore } from '../../lib/utils/verificationLocal';
import { getSchemaForType } from '../../lib/schemas/productSchema';
import { getDoP } from '../../lib/schemas/declarationOfPerformance';
import type { DeclarationOfPerformance } from '../../lib/schemas/declarationOfPerformance';
import { useRole } from '../../lib/utils/roleContext';
import { useUI } from '../../lib/utils/UIContext';
import QRCodeDisplay from '../visualizations/QRCodeDisplay';
import DIDEventsLog from '../DIDEventsLog';
import SimpleStoryTimeline from '../SimpleStoryTimeline';
import { ProtectedField, ProtectedMetadata } from '../ProtectedField';
import WindowLifecycleVisualization from '../visualizations/WindowLifecycleVisualization';
import DIDOperationsPanel from '../DIDOperationsPanel';
import TrustValidationTab from '../TrustValidationTab';
import ProtocolFilesTab from '../ProtocolFilesTab';
import DoPerformanceView from '../DoPerformanceView';
import DoPerformanceEditor from '../DoPerformanceEditor';
import AttestationDetailsModal from '../modals/AttestationDetailsModal';
import RawDataModal from '../modals/RawDataModal';
import DIDWebVHStatusPanel from '../DIDWebVHStatusPanel';
import TransferOwnershipModal from '../modals/TransferOwnershipModal';
import UpdateDIDModal from '../modals/UpdateDIDModal';
import DeactivateDIDModal from '../modals/DeactivateDIDModal';
import CertifyProductModal from '../modals/CertifyProductModal';
import { 
  transferOwnership, 
  deactivateDID, 
  updateDIDViaBackend,
  certifyProduct,
  getPendingAndRejectedOperations,
  getDIDOperationsHistory
} from '../../lib/operations/didOperationsLocal';

export default function MainDPPView({ did, onBack, onNavigate, backLabel }: {
  did: string;
  onBack: () => void;
  onNavigate: (did: string) => void;
  backLabel?: string;
}) {
  const { currentRole } = useRole();
  const { viewMode, t } = useUI();
  const [data, setData] = useState<any>(null);
  const [metrics, setMetrics] = useState<any>(null);
  const [trustScore, setTrustScore] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showQR, setShowQR] = useState(false);
  const [showRawData, setShowRawData] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'story' | 'specifications' | 'components' | 'lifecycle' | 'did-operations' | 'did-operations-simple' | 'trust-validation' | 'events' | 'protocol-files'>('overview');
  const [eventRefreshKey, setEventRefreshKey] = useState(0);
  const [editingDoP, setEditingDoP] = useState(false);
  const [selectedAttestation, setSelectedAttestation] = useState<any>(null);
  const [showTrustTooltip, setShowTrustTooltip] = useState(false);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
  const [recentEvents, setRecentEvents] = useState<any[]>([]);
  const [openEventId, setOpenEventId] = useState<string | null>(null);

  // DID Operation Modal states
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showCertifyModal, setShowCertifyModal] = useState(false);
  const [updateModalType, setUpdateModalType] = useState<'service' | 'metadata'>('metadata');
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [opLoading, setOpLoading] = useState(false);

  // Status states for decentralized operations
  const [currentPendingOp, setCurrentPendingOp] = useState<{ type: string; details: any } | null>(null);
  const [currentApprovedOp, setCurrentApprovedOp] = useState<{ type: string; details: any } | null>(null);
  const [currentRejectedOp, setCurrentRejectedOp] = useState<{ type: string; details: any } | null>(null);

  // Automatically switch tabs when view mode changes to make the impact obvious
  useEffect(() => {
    if (viewMode === 'simple') {
      setActiveTab('story');
    } else {
      setActiveTab('overview');
    }
  }, [viewMode]);

  // Polling logic for operation status (Sync with Technical Mode)
  useEffect(() => {
    if (!data?.dpp?.did) return;

    const did = data.dpp.did;

    // Load initial states from localStorage
    const pendingJson = localStorage.getItem(`pending_op_${did}`);
    const approvedJson = localStorage.getItem(`approved_op_${did}`);
    const rejectedJson = localStorage.getItem(`rejected_op_${did}`);

    if (pendingJson) setCurrentPendingOp(JSON.parse(pendingJson));
    if (approvedJson) setCurrentApprovedOp(JSON.parse(approvedJson));
    if (rejectedJson) setCurrentRejectedOp(JSON.parse(rejectedJson));

    const interval = setInterval(async () => {
      const currentPending = localStorage.getItem(`pending_op_${did}`);
      if (!currentPending) return;

      const pOp = JSON.parse(currentPending);
      const result = await getPendingAndRejectedOperations(data.dpp.id);
      
      if (result.success) {
        // Check if our operation is still pending or if it has been anchored
        const historyResult = await getDIDOperationsHistory(data.dpp.id);
        if (historyResult.success) {
          const wasApproved = historyResult.operations.some((op: any) => {
            const opTime = new Date(op.timestamp).getTime();
            const pTime = new Date(pOp.details.timestamp).getTime();
            return op.type === pOp.type && Math.abs(opTime - pTime) < 10000;
          });

          if (wasApproved) {
            localStorage.removeItem(`pending_op_${did}`);
            localStorage.setItem(`approved_op_${did}`, JSON.stringify(pOp));
            setCurrentPendingOp(null);
            setCurrentApprovedOp(pOp);
            setEventRefreshKey(prev => prev + 1);
            await loadData();
          }
        }
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [data?.dpp?.did, data?.dpp?.id]);

  const handleTransfer = async (newOwnerDID: string) => {
    if (!data?.dpp) return;
    setOpLoading(true);
    try {
      const result = await transferOwnership(data.dpp.id, data.dpp.owner, newOwnerDID);
      if (result.success) {
        // Manage operation status for persistent UI updates (matches Technical Mode)
        const opDetails = {
          type: 'ownership_change',
          details: {
            from: data.dpp.owner,
            to: newOwnerDID,
            timestamp: new Date().toISOString()
          }
        };

        // Clear existing op flags
        localStorage.removeItem(`pending_op_${data.dpp.did}`);
        localStorage.removeItem(`approved_op_${data.dpp.did}`);
        localStorage.removeItem(`rejected_op_${data.dpp.did}`);

        if (result.message.includes('via backend')) {
          localStorage.setItem(`approved_op_${data.dpp.did}`, JSON.stringify(opDetails));
          alert('✅ Ownership transferred and anchored to blockchain!');
        } else {
          localStorage.setItem(`pending_op_${data.dpp.did}`, JSON.stringify(opDetails));
          alert('⏳ Operation submitted. Waiting for witness approval...');
        }

        setShowTransferModal(false);
        await loadData();
        setEventRefreshKey(prev => prev + 1);
      } else {
        alert('Error during transfer: ' + result.message);
      }
    } catch (err) {
      alert('An unexpected error occurred.');
    } finally {
      setOpLoading(false);
    }
  };

  const handleUpdateDID = async (params: any) => {
    if (!data?.dpp) return;
    setOpLoading(true);
    try {
      const result = await updateDIDViaBackend(data.dpp.id, data.dpp.owner, {
        serviceEndpoints: params.updateType === 'service' ? [{
          id: `#${params.selectedServiceType.toLowerCase()}-service`,
          type: params.selectedServiceType,
          serviceEndpoint: params.serviceEndpoint
        }] : undefined,
        description: params.updateType === 'metadata' ? params.description : undefined
      });

      if (result.success) {
        const opDetails = {
          type: 'did_update',
          details: {
            updateType: params.updateType,
            timestamp: new Date().toISOString()
          }
        };

        localStorage.removeItem(`pending_op_${data.dpp.did}`);
        localStorage.removeItem(`approved_op_${data.dpp.did}`);

        if (result.message.includes('via backend')) {
          localStorage.setItem(`approved_op_${data.dpp.did}`, JSON.stringify(opDetails));
          alert('✅ Passport successfully updated and anchored!');
        } else {
          localStorage.setItem(`pending_op_${data.dpp.did}`, JSON.stringify(opDetails));
          alert('⏳ Update submitted. Waiting for blockchain confirmation...');
        }

        setShowUpdateModal(false);
        await loadData();
        setEventRefreshKey(prev => prev + 1);
      } else {
        alert('Error during update: ' + result.message);
      }
    } catch (err) {
      alert('An unexpected error occurred.');
    } finally {
      setOpLoading(false);
    }
  };

  const handleCertify = async (certData: any) => {
    if (!data?.dpp) return;
    setOpLoading(true);
    try {
      const result = await certifyProduct(data.dpp.id, data.dpp.owner, certData);
      if (result.success) {
        const opDetails = {
          type: 'certification',
          details: {
            ...certData,
            timestamp: new Date().toISOString()
          }
        };

        // For certification, we immediately record it as approved as it's an attestation
        localStorage.removeItem(`pending_op_${data.dpp.did}`);
        localStorage.setItem(`approved_op_${data.dpp.did}`, JSON.stringify(opDetails));

        alert('✅ Product successfully certified and anchored!');
        setShowCertifyModal(false);
        await loadData();
        setEventRefreshKey(prev => prev + 1);
      } else {
        alert('Error during certification: ' + result.message);
      }
    } catch (err) {
      alert('An unexpected error occurred.');
    } finally {
      setOpLoading(false);
    }
  };

  const handleDeactivate = async (reason: string) => {
    if (!data?.dpp) return;
    setOpLoading(true);
    try {
      const result = await deactivateDID(data.dpp.id, data.dpp.owner, reason);
      if (result.success) {
        const opDetails = {
          type: 'deactivation',
          details: {
            reason,
            timestamp: new Date().toISOString()
          }
        };

        localStorage.removeItem(`pending_op_${data.dpp.did}`);
        localStorage.setItem(`approved_op_${data.dpp.did}`, JSON.stringify(opDetails));

        alert('✅ Passport successfully deactivated.');
        setShowDeactivateModal(false);
        await loadData();
        setEventRefreshKey(prev => prev + 1);
      } else {
        alert('Error during deactivation: ' + result.message);
      }
    } catch (err) {
      alert('An unexpected error occurred.');
    } finally {
      setOpLoading(false);
    }
  };

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

      // Build combined recent events (creation, anchorings, attestations, verification)
      try {
        const { hybridDataStore } = await import('../../lib/data/hybridDataStore');
        const allEvents: any[] = [];
        // Creation
        if (dppData?.dpp) {
          allEvents.push({
            id: `creation-${dppData.dpp.id}`,
            timestamp: dppData.dpp.created_at,
            description: 'DPP Created',
            source: 'creation'
          });
        }

        // Anchorings
        const anchorings = await hybridDataStore.getAnchoringEventsByDID(did);
        anchorings.forEach((a: any) => {
          allEvents.push({
            id: `anchor-${a.id}`,
            timestamp: a.timestamp,
            description: `Anchored to DLT (${a.anchor_type})`,
            source: 'anchoring'
          });
        });

        // Attestations
        const attestations = await hybridDataStore.getAttestationsByDID(did);
        attestations.forEach((att: any) => {
          // Skip pending/rejected DID events similar to DIDEventsLog
          const didEventTypes = ['did_creation', 'key_rotation', 'ownership_change', 'did_update', 'did_lifecycle_update'];
          if (didEventTypes.includes(att.attestation_type) && (att.approval_status === 'pending' || att.approval_status === 'rejected')) return;
          const eventTimestamp = (att.attestation_data && (att.attestation_data as any).timestamp) || att.timestamp;
          const desc = didEventTypes.includes(att.attestation_type)
            ? ({ 'did_creation': 'DID Created & Registered', 'key_rotation': 'Cryptographic Key Rotated', 'ownership_change': 'Ownership Transferred', 'did_update': 'DID Document Updated', 'did_lifecycle_update': 'DID Lifecycle Stage Change' } as any)[att.attestation_type] || att.attestation_type
            : (['assembly', 'installation', 'maintenance', 'disposal', 'manufacturing'].includes(att.attestation_type) ? `Product Lifecycle: ${att.attestation_type}` : att.attestation_type.replace(/_/g, ' '));
          allEvents.push({
            id: `attestation-${att.id}`,
            timestamp: eventTimestamp,
            description: desc,
            source: 'attestation'
          });
        });

        // DID Document verification
        const didDoc = await hybridDataStore.getDIDDocumentByDID(did);
        if (didDoc) {
          allEvents.push({
            id: `verification-${didDoc.id}`,
            timestamp: didDoc.created_at,
            description: 'DID Document Verified',
            source: 'verification'
          });
        }

        // Sort descending (newest first) and take top 3
        const sorted = allEvents.slice().sort((a, b) => {
          const ta = a?.timestamp ? new Date(a.timestamp).getTime() : 0;
          const tb = b?.timestamp ? new Date(b.timestamp).getTime() : 0;
          return tb - ta;
        }).slice(0, 3);
        setRecentEvents(sorted);
      } catch (err) {
        console.error('Error building recentEvents:', err);
      }
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
      const { hybridDataStore } = await import('../../lib/data/hybridDataStore');
      const attestations = await hybridDataStore.getAttestationsByDID(didValue);

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

  async function handleExport() {
    const { exportHierarchyToJSON } = await import('../../lib/operations/bulkOperations');
    const json = await exportHierarchyToJSON(did);
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

    const { updateDPP } = await import('../../lib/data/enhancedAdapter');
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

  // Helper to check if current role can see advanced features
  const canSeeAdvancedFeatures = () => {
    return currentRole.includes('Manufacturer');
  };

  const dpp = data.dpp;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pt-20 transition-colors">
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 transition-colors">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-center mb-6">
            <button
              onClick={onBack}
              className="flex items-center gap-2 px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-full text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors shadow-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              {backLabel || 'Back to Dashboard'}
            </button>
          </div>

          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4 flex-1">
              <div className={`p-4 bg-gradient-to-br ${getIconColor(dpp.metadata?.productType || dpp.type).from} ${getIconColor(dpp.metadata?.productType || dpp.type).to} rounded-lg shadow-lg`}>
                <Package className="w-8 h-8 text-white" />
              </div>
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">{dpp.model}</h1>

                {/* Prominent DID Display */}
                <div className="bg-gradient-to-r from-blue-50 via-purple-50 to-blue-50 dark:from-blue-900/30 dark:via-purple-900/30 dark:to-blue-900/30 border-2 border-blue-500 dark:border-blue-600 rounded-lg p-4 mb-3 shadow-sm transition-colors">
                  <div className="flex items-center gap-2 mb-2">
                    <Link2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    <span className="text-sm font-bold text-blue-900 dark:text-blue-300 uppercase tracking-wide">{t('did_identifier')}</span>
                  </div>
                  <p className="text-base text-gray-900 dark:text-gray-100 font-mono break-all leading-relaxed">
                    {viewMode === 'simple' ? `${dpp.did.substring(0, 25)}...${dpp.did.substring(dpp.did.length - 15)}` : dpp.did}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <span className={`px-4 py-1.5 bg-gradient-to-r text-sm font-semibold rounded-full border ${dpp.type === 'main'
                    ? 'from-blue-100 to-blue-200 text-blue-800 border-blue-300'
                    : 'from-purple-100 to-purple-200 text-purple-800 border-purple-300'
                    }`}>
                    {dpp.type === 'main' ? 'Main Product' : 'Component'}
                  </span>
                  <span className="text-sm text-gray-700 dark:text-gray-300 font-medium capitalize px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-full transition-colors">{dpp.lifecycle_status}</span>
                  {viewMode === 'technical' && (
                    <span className="text-sm text-gray-700 dark:text-gray-300 font-medium px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-full transition-colors">Version {dpp.version}</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              {canSeeAdvancedFeatures() && (
                <button
                  onClick={() => setShowRawData(true)}
                  className="px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center gap-2 text-gray-900 dark:text-white transition-colors"
                >
                  <FileJson className="w-4 h-4" />
                  View Raw Data
                </button>
              )}
              <button
                onClick={() => setShowQR(true)}
                className="px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center gap-2 text-gray-900 dark:text-white transition-colors"
              >
                <QrCode className="w-4 h-4" />
                QR Code
              </button>
            </div>
          </div>

          <div className="flex gap-2 mt-6 border-b border-gray-200 dark:border-gray-700">
            {[
              { id: 'overview', label: t('Passport'), showFor: ['main', 'component'] },
              { id: 'story', label: t('Story'), showFor: ['main', 'component'], simpleOnly: true },
              { id: 'specifications', label: t('Specifications'), showFor: ['main', 'component'] },
              { id: 'components', label: t('Components'), showFor: ['main'] },
              { id: 'lifecycle', label: t('Lifecycle'), showFor: ['main', 'component'] },
              { id: 'did-operations', label: t('DID Operations'), showFor: ['main', 'component'], technicalOnly: true },
              { id: 'did-operations-simple', label: 'Management', showFor: ['main', 'component'], simpleOnly: true },
              { id: 'trust-validation', label: t('Trust & Validation'), showFor: ['main', 'component'] },
              { id: 'protocol-files', label: 'Protocol Files', showFor: ['main', 'component'], technicalOnly: true },
              { id: 'events', label: t('Events'), showFor: ['main', 'component'], technicalOnly: true },
            ].filter(tab => {
              if (tab.simpleOnly && viewMode !== 'simple') return false;
              if (tab.technicalOnly && viewMode !== 'technical') return false;
              return tab.showFor.includes(dpp.type);
            }).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2 border-b-2 transition-colors relative ${activeTab === tab.id
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-medium'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
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
              <div className="bg-white dark:bg-gray-800 rounded-lg border-2 border-blue-200 dark:border-blue-700 shadow-sm p-6 transition-colors">
                <div className="flex items-center gap-3 mb-6">
                  <Package className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Product Overview</h2>
                </div>

                {/* Basic Info Grid */}
                <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg transition-colors">
                  <div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Type</div>
                    <div className="font-semibold text-gray-900 dark:text-white">
                      {dpp.metadata?.productType || dpp.type}
                    </div>
                  </div>
                  {dpp.metadata?.dimensions && (
                    <div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Dimensions</div>
                      <div className="font-semibold text-gray-900 dark:text-white">
                        {dpp.metadata.dimensions.width}mm × {dpp.metadata.dimensions.height}mm (W × H)
                      </div>
                    </div>
                  )}
                  {dpp.metadata?.weight && (
                    <div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Weight</div>
                      <div className="font-semibold text-gray-900 dark:text-white">{dpp.metadata.weight} kg</div>
                    </div>
                  )}
                  <div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Suitable for</div>
                    <div className="font-semibold text-gray-900 dark:text-white">Residential & Commercial Buildings</div>
                  </div>
                </div>

                {/* Performance Section */}
                {dop && (
                  <>
                    <div className="flex items-center gap-3 mb-4 mt-6">
                      <Award className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white">Performance</h3>
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
                                  <Icon className={`w-5 h-5 text-${color}-600 dark:text-${color}-400 flex-shrink-0 mt-0.5`} />
                                  <div className="flex-1">
                                    <div className="font-semibold text-gray-900 dark:text-white mb-1">
                                      {perf.characteristic}
                                    </div>
                                    <div className="text-sm text-gray-700 dark:text-gray-300">
                                      {perf.performance} {perf.unit && `(${perf.unit})`}
                                    </div>
                                    {perf.classification && (
                                      <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
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
                        <FileCheck className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">Certifications</h3>
                      </div>
                      <div className="space-y-2 bg-green-50 dark:bg-green-900/30 p-4 rounded-lg transition-colors">
                        <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                          <CheckCircle className="w-5 h-5" />
                          <span className="font-medium">CE Marking {new Date(dop.ceMarking.year).getFullYear()}</span>
                        </div>
                        <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                          <CheckCircle className="w-5 h-5" />
                          <span className="font-medium">EU Construction Products Regulation (CPR 305/2011)</span>
                        </div>
                        {dop.notifiedBody && (
                          <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
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
              {viewMode === 'technical' && (
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 transition-colors">
                  <button
                    onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <FileCheck className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                      <span className="font-semibold text-gray-900 dark:text-white">Technical Specifications</span>
                    </div>
                    {showTechnicalDetails ? (
                      <ChevronUp className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                    )}
                  </button>

                  {showTechnicalDetails && (
                    <div className="border-t border-gray-200 dark:border-gray-700 p-6">
                      {dop ? (
                        <DoPerformanceView dop={dop} onEdit={canEdit ? () => setEditingDoP(true) : undefined} />
                      ) : (
                        <div className="text-center py-8">
                          <p className="text-gray-500 dark:text-gray-400 mb-4">No Declaration of Performance available for this product.</p>
                          {canEdit && (
                            <button
                              onClick={() => setEditingDoP(true)}
                              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                              Create DoP
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {activeTab === 'story' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 shadow-sm">
            <div className="max-w-3xl mx-auto">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-8 flex items-center gap-3">
                <Clock className="w-8 h-8 text-blue-600" />
                {t('Story')}
              </h2>
              <SimpleStoryTimeline did={did} />
            </div>
          </div>
        )}

        {activeTab === 'overview' && (
          <div className="grid grid-cols-3 gap-6">
            {/* Product Visual - Larger and more prominent */}
            <div className="col-span-3 mb-4">
              <div className="bg-white dark:bg-gray-800 rounded-xl border-2 border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden transition-colors">
                <div className="flex items-start gap-0">
                  {/* Product Image - Much larger */}
                  <div className="flex-shrink-0 relative group">
                    <div className="w-96 h-96 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-900/30 dark:via-indigo-900/30 dark:to-purple-900/30 flex items-center justify-center overflow-hidden">
                      {dpp.metadata?.image_url ? (
                        <img
                          src={dpp.metadata.image_url}
                          alt={dpp.model}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="text-center p-8">
                          <div className="relative inline-block">
                            <ImageIcon className="w-32 h-32 text-blue-300 dark:text-blue-600 mx-auto mb-4" />
                            <div className="absolute inset-0 bg-blue-400 dark:bg-blue-600 opacity-20 blur-2xl"></div>
                          </div>
                          <p className="text-lg font-semibold text-gray-600 dark:text-gray-300 mb-2">Product Visual</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{dpp.type}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Product Details - Enhanced */}
                  <div className="flex-1 p-8">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">{dpp.model}</h2>
                        <div className="flex items-center gap-3">
                          <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-sm font-semibold rounded-full">
                            {dpp.type}
                          </span>
                          <span className="px-3 py-1 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 text-sm font-semibold rounded-full capitalize">
                            {dpp.lifecycle_status}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Key Product Features */}
                    <div className="mb-6">
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-3">Key Features</h3>
                      <div className="space-y-2.5">
                        {getProductFeatures(dpp).map((feature, idx) => (
                          <div key={idx} className="flex items-start gap-3">
                            <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                            <span className="text-gray-700 dark:text-gray-300 leading-relaxed">{feature}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Technical Specs Grid */}
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                      {dpp.metadata?.dimensions && (
                        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                          <div className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-1">Dimensions</div>
                          <div className="text-sm font-semibold text-gray-900 dark:text-white">
                            {dpp.metadata.dimensions.width} × {dpp.metadata.dimensions.height} mm
                          </div>
                        </div>
                      )}
                      {dpp.metadata?.weight && (
                        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                          <div className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-1">Weight</div>
                          <div className="text-sm font-semibold text-gray-900 dark:text-white">{dpp.metadata.weight} kg</div>
                        </div>
                      )}
                      {dpp.metadata?.batch && viewMode === 'technical' && (
                        <ProtectedField field="operations" label="Batch Number" value={dpp.metadata.batch}>
                          <div className="bg-purple-50 dark:bg-purple-900/30 rounded-lg p-3">
                            <div className="text-xs text-purple-600 dark:text-purple-400 font-medium mb-1">Batch Number</div>
                            <div className="text-sm font-semibold text-purple-900 dark:text-purple-300">{dpp.metadata.batch}</div>
                          </div>
                        </ProtectedField>
                      )}
                      {dpp.created_at && (
                        <ProtectedField field="operations" label="Production Date" value={new Date(dpp.created_at).toLocaleDateString()}>
                          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                            <div className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-1">Production Date</div>
                            <div className="text-sm font-semibold text-gray-900 dark:text-white">
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
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 transition-colors">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    Verification Status
                  </h2>
                  <div className="relative">
                    <button
                      onMouseEnter={() => setShowTrustTooltip(true)}
                      onMouseLeave={() => setShowTrustTooltip(false)}
                      className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
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
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 border-2 border-blue-200 dark:border-blue-700 rounded-lg p-4 mb-4">
                      <div className="flex items-center gap-3 mb-3">
                        <CheckCircle className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                        <span className="text-lg font-semibold text-gray-900 dark:text-white">
                          {trustScore.score >= 80 ? 'Fully Verified Product' :
                            trustScore.score >= 60 ? 'Verified Product' :
                              'Partially Verified'}
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="mb-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Verification Completeness</span>
                          <span className="text-sm font-bold text-gray-900 dark:text-white">{trustScore.score}%</span>
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
                        {trustScore.breakdown.didResolution >= 15 ? (
                          <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                        ) : (
                          <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                        )}
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">DID Registered</div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">
                            {trustScore.breakdown.didResolution >= 25 ? 'Verified with cryptographic keys' :
                             trustScore.breakdown.didResolution >= 15 ? 'Document registered' : 'Pending registration'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        {(trustScore.breakdown.attestations || 0) >= 15 ? (
                          <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                        ) : (trustScore.breakdown.attestations || 0) > 0 ? (
                          <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                        ) : (
                          <AlertCircle className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                        )}
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">Witness Attestations</div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">
                            {(trustScore.breakdown.attestations || 0) >= 15 ? 'Events verified by witnesses' :
                             (trustScore.breakdown.attestations || 0) > 0 ? 'Pending witness verification' : 'No attestations yet'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        {trustScore.breakdown.anchoring >= 20 ? (
                          <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                        ) : (
                          <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                        )}
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">Blockchain Anchored</div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">
                            {trustScore.breakdown.anchoring >= 20 ? 'Data immutably recorded on blockchain' : 'Pending blockchain anchoring'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        {trustScore.breakdown.hierarchy >= 8 ? (
                          <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                        ) : (
                          <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                        )}
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">Component Structure</div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">
                            {trustScore.breakdown.hierarchy >= 8 ? 'Valid product hierarchy' : 'Hierarchy validation pending'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Product Information */}
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 transition-colors">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Product Information</h2>
                <div className="grid grid-cols-2 gap-4">
                  <ProtectedField field="basic" label="Owner" value={dpp.owner}>
                    <div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Owner</div>
                      <div className="text-sm font-mono text-gray-900 dark:text-white break-all">{dpp.owner}</div>
                    </div>
                  </ProtectedField>
                  {dpp.custodian && (
                    <ProtectedField field="operations" label="Custodian" value={dpp.custodian}>
                      <div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">Custodian</div>
                        <div className="text-sm font-mono text-gray-900 dark:text-white break-all">{dpp.custodian}</div>
                      </div>
                    </ProtectedField>
                  )}
                  <ProtectedField field="operations" label="Created" value={new Date(dpp.created_at).toLocaleString()}>
                    <div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Created</div>
                      <div className="text-sm text-gray-900 dark:text-white">
                        {new Date(dpp.created_at).toLocaleString()}
                      </div>
                    </div>
                  </ProtectedField>
                  <ProtectedField field="operations" label="Updated" value={new Date(dpp.updated_at).toLocaleString()}>
                    <div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Updated</div>
                      <div className="text-sm text-gray-900 dark:text-white">
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
                  <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 transition-colors">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Aggregated Sustainability</h2>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">Total CO₂ Footprint</div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-white">
                          {metrics.aggregatedSustainability.totalCO2Footprint.toFixed(1)}
                          <span className="text-sm text-gray-600 dark:text-gray-400 ml-1">kg</span>
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">Avg Recycled Content</div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-white">
                          {metrics.aggregatedSustainability.avgRecycledContent.toFixed(0)}
                          <span className="text-sm text-gray-600 dark:text-gray-400 ml-1">%</span>
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">Avg Recyclability</div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-white">
                          {metrics.aggregatedSustainability.avgRecyclability.toFixed(0)}
                          <span className="text-sm text-gray-600 dark:text-gray-400 ml-1">%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
            </div>

            {/* Right column: Components/Parent (top) + Recent Events (bottom) */}
            <div className="space-y-6">
              {/* Components or Parent */}
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 transition-colors">
                {dpp.type === 'main' ? (
                  <>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Components</h2>
                    <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-2">{data.children.length}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">Total components</div>

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
                            <div className="font-medium text-gray-900 dark:text-white text-sm mb-1">{childDpp.model}</div>
                            <div className="text-xs text-gray-600 dark:text-gray-400 font-mono truncate">{childDpp.did}</div>
                          </button>
                        );
                      })}
                    </div>
                  </>
                ) : data.parent ? (
                  <>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Parent Product</h2>
                    <button
                      onClick={() => onNavigate(data.parent.did)}
                      className="w-full p-4 rounded-lg transition-colors text-left border-2 border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 hover:border-blue-300 dark:hover:border-blue-600"
                    >
                      <div className="font-semibold text-gray-900 dark:text-white text-base mb-2">{data.parent.model}</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400 font-mono truncate mb-2">{data.parent.did}</div>
                      <div className="flex items-center gap-1 text-sm text-blue-700 dark:text-blue-400 font-medium">
                        <span>View parent product</span>
                        <ExternalLink className="w-4 h-4" />
                      </div>
                    </button>
                  </>
                ) : null}
              </div>

              {/* Recent Events */}
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 transition-colors">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  Recent Events
                </h2>
                <div className="space-y-2">
                  {recentEvents && recentEvents.length > 0 ? (
                    recentEvents.map((event: any) => (
                      <button
                        key={event.id}
                        onClick={() => {
                          setActiveTab('events');
                          setOpenEventId(event.id);
                        }}
                        className="w-full text-left text-sm border-l-2 border-blue-500 dark:border-blue-400 pl-3 py-2 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors rounded-r"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-blue-600 dark:text-blue-400 capitalize hover:underline">
                            {event.description ? String(event.description) : (event.attestation_type ? event.attestation_type.replace(/_/g, ' ') : 'Unknown Event')}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
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
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">No recent events</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'components' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 transition-colors">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Component Details</h2>
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
                      className="group border-2 rounded-xl overflow-hidden transition-all hover:shadow-lg bg-white dark:bg-gray-800"
                      style={{
                        borderColor: `${color}40`
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
                        <h3 className="font-bold text-gray-900 dark:text-white text-lg mb-2">{childDpp.model}</h3>

                        {/* Key Specs */}
                        {keySpecs.length > 0 && (
                          <div className="mb-3 space-y-1.5">
                            {keySpecs.map((spec, idx) => (
                              <div key={idx} className="flex items-center gap-2 text-sm">
                                <div
                                  className="w-1.5 h-1.5 rounded-full"
                                  style={{ backgroundColor: color }}
                                ></div>
                                <span className="text-gray-700 dark:text-gray-300 font-medium">{spec}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* DID */}
                        <div className="mb-3 p-2 bg-gray-50 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600">
                          <div className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">DID</div>
                          <p className="text-xs text-gray-700 dark:text-gray-300 font-mono truncate">{childDpp.did}</p>
                        </div>

                        {/* Meta Info */}
                        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-3">
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

        {activeTab === 'did-operations-simple' && (
          <div className="max-w-4xl mx-auto py-8">
            {/* Decentralized Status Feedback */}
            {currentPendingOp && (
              <div className="mb-6 p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-2xl flex items-center justify-between animate-pulse">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/40 rounded-full flex items-center justify-center text-orange-600 dark:text-orange-400">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-orange-900 dark:text-orange-200 uppercase text-xs tracking-wider">Awaiting Witness Approval</h4>
                    <p className="text-sm text-orange-700 dark:text-orange-300">
                      Processing <strong>{currentPendingOp.type.replace('_', ' ')}</strong>. This is being witnessed across the network.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 px-3 py-1 bg-white/50 dark:bg-black/20 rounded-full text-[10px] font-mono text-orange-600 dark:text-orange-400">
                  <Activity className="w-3 h-3" />
                  DLT-ANCHOR-PENDING
                </div>
              </div>
            )}

            {currentApprovedOp && (
              <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/40 rounded-full flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                    <CheckCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-emerald-900 dark:text-emerald-200 uppercase text-xs tracking-wider">Operation Anchored</h4>
                    <p className="text-sm text-emerald-700 dark:text-emerald-300">
                      Your recent <strong>{currentApprovedOp.type.replace('_', ' ')}</strong> has been successfully verified by multiple nodes.
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setCurrentApprovedOp(null)}
                  className="p-1 hover:bg-emerald-200 dark:hover:bg-emerald-800 rounded-lg transition-colors"
                >
                  <ArrowLeft className="w-4 h-4 text-emerald-600 dark:text-emerald-400 rotate-90" />
                </button>
              </div>
            )}

            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Product Operations</h2>
              <p className="text-gray-500 dark:text-gray-400">Perform critical updates to this product passport</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Evolution - Update Information */}
              <button
                onClick={() => {
                  setUpdateModalType('service');
                  setShowUpdateModal(true);
                }}
                className="flex flex-col items-center justify-center p-8 bg-emerald-50 dark:bg-emerald-900/20 border-2 border-emerald-100 dark:border-emerald-800 rounded-3xl hover:border-emerald-500 dark:hover:border-emerald-400 hover:shadow-xl transition-all group transform hover:scale-[1.02] active:scale-[0.98]"
              >
                <div className="w-20 h-20 bg-emerald-500 text-white rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-lg shadow-emerald-500/20">
                  <FileEdit className="w-10 h-10" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Update Information</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 text-center max-w-xs px-4">Modify product specifications and update information in the digital passport.</p>
                <div className="mt-4 px-3 py-1 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-xs font-bold rounded-full uppercase tracking-wider">DID:Update</div>
              </button>

              {/* Certification - Status & Inspection */}
              <button
                onClick={() => setShowCertifyModal(true)}
                className="flex flex-col items-center justify-center p-8 bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-100 dark:border-amber-800 rounded-3xl hover:border-amber-500 dark:hover:border-amber-400 hover:shadow-xl transition-all group transform hover:scale-[1.02] active:scale-[0.98]"
              >
                <div className="w-20 h-20 bg-amber-500 text-white rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-lg shadow-amber-500/20">
                  <ShieldCheck className="w-10 h-10" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Status & Inspection</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 text-center max-w-xs px-4">Record important milestones such as inspection reports or maintenance.</p>
                <div className="mt-4 px-3 py-1 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-xs font-bold rounded-full uppercase tracking-wider">DID:Attest</div>
              </button>

              {/* Ownership - Transfer */}
              <button
                onClick={() => setShowTransferModal(true)}
                className="flex flex-col items-center justify-center p-8 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-100 dark:border-blue-800 rounded-3xl hover:border-blue-500 dark:hover:border-blue-400 hover:shadow-xl transition-all group transform hover:scale-[1.02] active:scale-[0.98]"
              >
                <div className="w-20 h-20 bg-blue-500 text-white rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-lg shadow-blue-500/20">
                  <Link2 className="w-10 h-10" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Transfer Ownership</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 text-center max-w-xs px-4">Transfer the digital ownership of this product to a new owner.</p>
                <div className="mt-4 px-3 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-bold rounded-full uppercase tracking-wider">DID:Transfer</div>
              </button>

              {/* Termination - End of Life */}
              <button
                onClick={() => setShowDeactivateModal(true)}
                className="flex flex-col items-center justify-center p-8 bg-rose-50 dark:bg-rose-900/20 border-2 border-rose-100 dark:border-rose-800 rounded-3xl hover:border-rose-500 dark:hover:border-rose-400 hover:shadow-xl transition-all group transform hover:scale-[1.02] active:scale-[0.98]"
              >
                <div className="w-20 h-20 bg-rose-500 text-white rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-lg shadow-rose-500/20">
                  <Recycle className="w-10 h-10" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Recycling & End-of-Life</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 text-center max-w-xs px-4">Register the product for recycling and permanently deactivate the passport.</p>
                <div className="mt-4 px-3 py-1 bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 text-xs font-bold rounded-full uppercase tracking-wider">DID:Deactivate</div>
              </button>
            </div>
          </div>
        )}

        {activeTab === 'did-operations' && (
          <>
            {canSeeAdvancedFeatures() && (
              <DIDWebVHStatusPanel did={did} />
            )}
            <DIDOperationsPanel
              dpp={dpp}
              onUpdate={loadData}
            />
          </>
        )}

        <div className={activeTab === 'trust-validation' ? 'block' : 'hidden'}>
          <TrustValidationTab did={did} />
        </div>

        {activeTab === 'protocol-files' && (
          <ProtocolFilesTab did={did} />
        )}

        {activeTab === 'events' && (
          <DIDEventsLog key={`events-${eventRefreshKey}`} did={did} openEventId={openEventId} />
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

      {showRawData && (
        <RawDataModal
          data={data}
          onClose={() => setShowRawData(false)}
        />
      )}

      {showTransferModal && data?.dpp && (
        <TransferOwnershipModal
          currentOwnerDID={data.dpp.owner}
          onClose={() => setShowTransferModal(false)}
          onTransfer={handleTransfer}
          loading={opLoading}
        />
      )}

      {showCertifyModal && (
        <CertifyProductModal
          onClose={() => setShowCertifyModal(false)}
          onCertify={handleCertify}
          loading={opLoading}
        />
      )}

      {showUpdateModal && (
        <UpdateDIDModal
          initialType={updateModalType}
          onClose={() => setShowUpdateModal(false)}
          onUpdate={handleUpdateDID}
          loading={opLoading}
        />
      )}

      {showDeactivateModal && (
        <DeactivateDIDModal
          onClose={() => setShowDeactivateModal(false)}
          onDeactivate={handleDeactivate}
          loading={opLoading}
        />
      )}
    </div>
  );
}

