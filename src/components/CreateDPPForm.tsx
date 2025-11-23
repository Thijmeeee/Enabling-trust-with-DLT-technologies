import { useState } from 'react';
import { X, Plus, CheckCircle, ArrowRight, ArrowLeft, Package } from 'lucide-react';
import { localDB } from '../lib/localData';

interface WindowData {
  model: string;
  description: string;
  dimensions: { width: number; height: number };
  weight: number;
}

interface ComponentData {
  type: 'glass' | 'frame';
  model: string;
  description: string;
  material: string;
  metadata: Record<string, any>;
}

export default function CreateDPPForm({ onClose, onComplete }: {
  onClose: () => void;
  onComplete: () => void;
}) {
  const [step, setStep] = useState<'window' | 'glass' | 'frame' | 'review' | 'creating'>('window');
  const [windowData, setWindowData] = useState<WindowData>({
    model: '',
    description: '',
    dimensions: { width: 1200, height: 1500 },
    weight: 45,
  });
  const [glassData, setGlassData] = useState<ComponentData>({
    type: 'glass',
    model: '',
    description: '',
    material: 'Glass',
    metadata: { thickness: 24, uValue: 1.1 },
  });
  const [frameData, setFrameData] = useState<ComponentData>({
    type: 'frame',
    model: '',
    description: '',
    material: 'Aluminum',
    metadata: { finish: 'Powder coated' },
  });

  const handleCreateDPP = async () => {
    setStep('creating');
    
    try {
      const timestamp = Date.now();
      const uniqueId = `${timestamp}-${Math.random().toString(36).substr(2, 9)}`;
      
      const windowDid = `did:webvh:example.com:products:window-${uniqueId}`;
      const glassDid = `did:webvh:example.com:products:glass-${uniqueId}`;
      const frameDid = `did:webvh:example.com:products:frame-${uniqueId}`;

      // Create glass component
      const glassResult = await localDB.insertDPP({
        did: glassDid,
        type: 'component',
        model: glassData.model,
        parent_did: windowDid,
        lifecycle_status: 'active',
        owner: 'did:webvh:example.com:organizations:glass-supplier',
        custodian: 'did:webvh:example.com:organizations:window-manufacturer',
        metadata: {
          description: glassData.description,
          material: glassData.material,
          ...glassData.metadata,
          productionDate: new Date().toISOString(),
        },
        version: 1,
        previous_version_id: null,
      });

      // Create frame component
      const frameResult = await localDB.insertDPP({
        did: frameDid,
        type: 'component',
        model: frameData.model,
        parent_did: windowDid,
        lifecycle_status: 'active',
        owner: 'did:webvh:example.com:organizations:frame-supplier',
        custodian: 'did:webvh:example.com:organizations:window-manufacturer',
        metadata: {
          description: frameData.description,
          material: frameData.material,
          ...frameData.metadata,
          productionDate: new Date().toISOString(),
        },
        version: 1,
        previous_version_id: null,
      });

      // Create main window
      const windowResult = await localDB.insertDPP({
        did: windowDid,
        type: 'main',
        model: windowData.model,
        parent_did: null,
        lifecycle_status: 'active',
        owner: 'did:webvh:example.com:organizations:window-manufacturer',
        custodian: null,
        metadata: {
          description: windowData.description,
          dimensions: { ...windowData.dimensions, unit: 'mm' },
          weight: windowData.weight,
          productionDate: new Date().toISOString(),
        },
        version: 1,
        previous_version_id: null,
      });

      // Create relationships
      await localDB.insertRelationship({
        parent_did: windowDid,
        child_did: glassDid,
        relationship_type: 'component',
        position: 1,
        metadata: { role: 'glazing', quantity: 1 },
      });

      await localDB.insertRelationship({
        parent_did: windowDid,
        child_did: frameDid,
        relationship_type: 'component',
        position: 2,
        metadata: { role: 'frame', quantity: 1 },
      });

      // Create DID documents
      await localDB.insertDIDDocument({
        dpp_id: windowResult.id,
        did: windowDid,
        controller: windowResult.owner,
        verification_method: [],
        service_endpoints: [],
        proof: { type: 'Ed25519Signature2020' },
        document_metadata: { created: true },
      });

      await localDB.insertDIDDocument({
        dpp_id: glassResult.id,
        did: glassDid,
        controller: glassResult.owner,
        verification_method: [],
        service_endpoints: [],
        proof: { type: 'Ed25519Signature2020' },
        document_metadata: { created: true },
      });

      await localDB.insertDIDDocument({
        dpp_id: frameResult.id,
        did: frameDid,
        controller: frameResult.owner,
        verification_method: [],
        service_endpoints: [],
        proof: { type: 'Ed25519Signature2020' },
        document_metadata: { created: true },
      });

      // Success!
      setTimeout(() => {
        onComplete();
      }, 1500);
    } catch (error) {
      console.error('Error creating DPP:', error);
      alert('Failed to create DPP. Please try again.');
      setStep('review');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Create New Window DPP</h2>
            <p className="text-sm text-gray-600 mt-1">Add a new window product with components</p>
          </div>
          <button
            onClick={onClose}
            disabled={step === 'creating'}
            className="p-2 hover:bg-gray-100 rounded disabled:opacity-50"
          >
            <X size={24} />
          </button>
        </div>

        {/* Progress Steps */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center justify-between max-w-2xl mx-auto">
            {[
              { id: 'window', label: 'Window' },
              { id: 'glass', label: 'Glass' },
              { id: 'frame', label: 'Frame' },
              { id: 'review', label: 'Review' },
            ].map((s, index) => (
              <div key={s.id} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                      step === s.id
                        ? 'bg-blue-600 text-white'
                        : ['window', 'glass', 'frame', 'review'].indexOf(step) >
                          ['window', 'glass', 'frame', 'review'].indexOf(s.id)
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {['window', 'glass', 'frame', 'review'].indexOf(step) >
                    ['window', 'glass', 'frame', 'review'].indexOf(s.id) ? (
                      <CheckCircle size={20} />
                    ) : (
                      index + 1
                    )}
                  </div>
                  <span className="text-xs mt-1 font-medium">{s.label}</span>
                </div>
                {index < 3 && (
                  <div
                    className={`w-20 h-0.5 mx-2 ${
                      ['window', 'glass', 'frame', 'review'].indexOf(step) >
                      ['window', 'glass', 'frame', 'review'].indexOf(s.id)
                        ? 'bg-green-600'
                        : 'bg-gray-200'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="p-6">
          {step === 'window' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Window Information</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Model Name *</label>
                <input
                  type="text"
                  value={windowData.model}
                  onChange={(e) => setWindowData({ ...windowData, model: e.target.value })}
                  placeholder="e.g., Window-Premium-2025"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
                <textarea
                  value={windowData.description}
                  onChange={(e) => setWindowData({ ...windowData, description: e.target.value })}
                  placeholder="e.g., Premium double-glazed window"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Width (mm) *</label>
                  <input
                    type="number"
                    value={windowData.dimensions.width}
                    onChange={(e) =>
                      setWindowData({
                        ...windowData,
                        dimensions: { ...windowData.dimensions, width: Number(e.target.value) },
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Height (mm) *</label>
                  <input
                    type="number"
                    value={windowData.dimensions.height}
                    onChange={(e) =>
                      setWindowData({
                        ...windowData,
                        dimensions: { ...windowData.dimensions, height: Number(e.target.value) },
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Weight (kg) *</label>
                <input
                  type="number"
                  step="0.1"
                  value={windowData.weight}
                  onChange={(e) => setWindowData({ ...windowData, weight: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
            </div>
          )}

          {step === 'glass' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Glass Component</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Model Name *</label>
                <input
                  type="text"
                  value={glassData.model}
                  onChange={(e) => setGlassData({ ...glassData, model: e.target.value })}
                  placeholder="e.g., Glass-DoubleGlazed-Low-E"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
                <textarea
                  value={glassData.description}
                  onChange={(e) => setGlassData({ ...glassData, description: e.target.value })}
                  placeholder="e.g., Low-E double-glazed glass panel"
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Material *</label>
                <input
                  type="text"
                  value={glassData.material}
                  onChange={(e) => setGlassData({ ...glassData, material: e.target.value })}
                  placeholder="e.g., Glass"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Thickness (mm)</label>
                  <input
                    type="number"
                    value={glassData.metadata.thickness}
                    onChange={(e) =>
                      setGlassData({
                        ...glassData,
                        metadata: { ...glassData.metadata, thickness: Number(e.target.value) },
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">U-Value</label>
                  <input
                    type="number"
                    step="0.1"
                    value={glassData.metadata.uValue}
                    onChange={(e) =>
                      setGlassData({
                        ...glassData,
                        metadata: { ...glassData.metadata, uValue: Number(e.target.value) },
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 'frame' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Frame Component</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Model Name *</label>
                <input
                  type="text"
                  value={frameData.model}
                  onChange={(e) => setFrameData({ ...frameData, model: e.target.value })}
                  placeholder="e.g., Frame-Aluminum-Thermal-Break"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
                <textarea
                  value={frameData.description}
                  onChange={(e) => setFrameData({ ...frameData, description: e.target.value })}
                  placeholder="e.g., Aluminum frame with thermal break technology"
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Material *</label>
                <input
                  type="text"
                  value={frameData.material}
                  onChange={(e) => setFrameData({ ...frameData, material: e.target.value })}
                  placeholder="e.g., Aluminum"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Finish</label>
                <input
                  type="text"
                  value={frameData.metadata.finish}
                  onChange={(e) =>
                    setFrameData({
                      ...frameData,
                      metadata: { ...frameData.metadata, finish: e.target.value },
                    })
                  }
                  placeholder="e.g., Powder coated"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          )}

          {step === 'review' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold">Review & Confirm</h3>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Package className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900">{windowData.model}</h4>
                    <p className="text-sm text-gray-600 mt-1">{windowData.description}</p>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <span className="text-gray-600">Width:</span>{' '}
                        <span className="font-medium">{windowData.dimensions.width}mm</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Height:</span>{' '}
                        <span className="font-medium">{windowData.dimensions.height}mm</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Weight:</span>{' '}
                        <span className="font-medium">{windowData.weight}kg</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-2">Glass Component</h4>
                  <p className="text-sm font-medium text-gray-900">{glassData.model}</p>
                  <p className="text-sm text-gray-600 mt-1">{glassData.description}</p>
                  <div className="mt-2 text-sm">
                    <div className="text-gray-600">Material: <span className="font-medium">{glassData.material}</span></div>
                  </div>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-2">Frame Component</h4>
                  <p className="text-sm font-medium text-gray-900">{frameData.model}</p>
                  <p className="text-sm text-gray-600 mt-1">{frameData.description}</p>
                  <div className="mt-2 text-sm">
                    <div className="text-gray-600">Material: <span className="font-medium">{frameData.material}</span></div>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                  <strong>Note:</strong> This will create a new window DPP with DIDs for the window and both components,
                  establish relationships, and register all DID documents.
                </p>
              </div>
            </div>
          )}

          {step === 'creating' && (
            <div className="py-12 text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
              <p className="text-gray-600 font-medium">Creating DPP and registering DIDs...</p>
              <p className="text-sm text-gray-500 mt-2">This may take a few moments</p>
            </div>
          )}
        </div>

        {step !== 'creating' && (
          <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 p-6 flex justify-between">
            <button
              onClick={() => {
                if (step === 'window') onClose();
                else if (step === 'glass') setStep('window');
                else if (step === 'frame') setStep('glass');
                else if (step === 'review') setStep('frame');
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 flex items-center gap-2"
            >
              <ArrowLeft size={18} />
              {step === 'window' ? 'Cancel' : 'Back'}
            </button>

            <button
              onClick={() => {
                if (step === 'window') setStep('glass');
                else if (step === 'glass') setStep('frame');
                else if (step === 'frame') setStep('review');
                else if (step === 'review') handleCreateDPP();
              }}
              disabled={
                (step === 'window' && (!windowData.model || !windowData.description)) ||
                (step === 'glass' && (!glassData.model || !glassData.description)) ||
                (step === 'frame' && (!frameData.model || !frameData.description))
              }
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {step === 'review' ? (
                <>
                  <Plus size={18} />
                  Create DPP
                </>
              ) : (
                <>
                  Next
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
