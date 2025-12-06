import { useState } from 'react';
import { 
  X, 
  ArrowRight, 
  ArrowLeft, 
  CheckCircle, 
  Package,
  Layers,
  Square,
  Info
} from 'lucide-react';
import { enhancedDB } from '../../lib/data/enhancedDataStore';
import { generateWitnessAttestations, generateAnchoringEvents } from '../../lib/operations/lifecycleHelpers';
import { useRole } from '../../lib/utils/roleContext';

interface WindowRegistrationWizardProps {
  onClose: () => void;
  onComplete: () => void;
}

type Step = 'intro' | 'window' | 'glass' | 'frame' | 'review' | 'creating' | 'success';

export default function WindowRegistrationWizard({ onClose, onComplete }: WindowRegistrationWizardProps) {
  const { currentRoleDID } = useRole();
  const [step, setStep] = useState<Step>('intro');
  
  // Form data
  const [windowName, setWindowName] = useState('');
  const [windowWidth, setWindowWidth] = useState(1200);
  const [windowHeight, setWindowHeight] = useState(1500);
  const [glassType, setGlassType] = useState('Double glazing');
  const [frameType, setFrameType] = useState('Aluminium');

  const steps: { id: Step; label: string }[] = [
    { id: 'window', label: 'Window' },
    { id: 'glass', label: 'Glass' },
    { id: 'frame', label: 'Frame' },
    { id: 'review', label: 'Review' },
  ];

  async function handleSubmit() {
    setStep('creating');
    
    try {
      const timestamp = Date.now();
      const uniqueId = `${timestamp}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Determine manufacturer domain based on role
      const manufacturerDomain = currentRoleDID.includes('glass-solutions') 
        ? 'glass-solutions.com' 
        : currentRoleDID.includes('frame-masters')
          ? 'frame-masters.com'
          : 'example.com';

      const windowDid = `did:webvh:${manufacturerDomain}:products:window-${uniqueId}`;
      const glassDid = `did:webvh:${manufacturerDomain}:products:glass-${uniqueId}`;
      const frameDid = `did:webvh:${manufacturerDomain}:products:frame-${uniqueId}`;

      // Create glass component
      const glassResult = await enhancedDB.insertDPP({
        did: glassDid,
        type: 'component',
        model: `${glassType} Panel`,
        parent_did: windowDid,
        lifecycle_status: 'active',
        owner: currentRoleDID,
        custodian: currentRoleDID,
        metadata: {
          productType: 'glass',
          glazing_type: glassType,
          thickness: glassType.includes('Triple') ? 36 : 24,
          description: `${glassType} for ${windowName}`,
        },
        version: 1,
        previous_version_id: null,
      });

      // Create frame component
      const frameResult = await enhancedDB.insertDPP({
        did: frameDid,
        type: 'component',
        model: `${frameType} Frame`,
        parent_did: windowDid,
        lifecycle_status: 'active',
        owner: currentRoleDID,
        custodian: currentRoleDID,
        metadata: {
          productType: 'frame',
          material: frameType,
          thermal_break: frameType === 'Aluminium',
          description: `${frameType} frame for ${windowName}`,
        },
        version: 1,
        previous_version_id: null,
      });

      // Create main window
      const windowResult = await enhancedDB.insertDPP({
        did: windowDid,
        type: 'main',
        model: windowName || `Window-${uniqueId.slice(0, 8)}`,
        parent_did: null,
        lifecycle_status: 'active',
        owner: currentRoleDID,
        custodian: null,
        metadata: {
          productType: 'window',
          dimensions: { width: windowWidth, height: windowHeight, unit: 'mm' },
          glazing_type: glassType,
          frame_material: frameType,
          description: `${windowName} - ${windowWidth}x${windowHeight}mm`,
        },
        version: 1,
        previous_version_id: null,
      });

      // Create relationships
      await enhancedDB.insertRelationship({
        parent_did: windowDid,
        child_did: glassDid,
        relationship_type: 'component',
        position: 1,
        metadata: { role: 'glazing', quantity: 1 },
      });

      await enhancedDB.insertRelationship({
        parent_did: windowDid,
        child_did: frameDid,
        relationship_type: 'component',
        position: 2,
        metadata: { role: 'frame', quantity: 1 },
      });

      // Create DID documents
      await enhancedDB.insertDIDDocument({
        dpp_id: windowResult.id,
        did: windowDid,
        controller: currentRoleDID,
        verification_method: [{
          id: `${windowDid}#key-1`,
          type: 'Ed25519VerificationKey2020',
          controller: currentRoleDID,
          publicKeyMultibase: `z6Mk${Math.random().toString(36).substring(2, 15)}`,
        }],
        service_endpoints: [{
          id: `${windowDid}#dpp-service`,
          type: 'DPPService',
          serviceEndpoint: `https://${manufacturerDomain}/dpp/${windowDid.split(':').pop()}`,
        }],
        proof: { type: 'Ed25519Signature2020', created: new Date().toISOString() },
        document_metadata: { created: true, productType: 'window' },
      });

      await enhancedDB.insertDIDDocument({
        dpp_id: glassResult.id,
        did: glassDid,
        controller: currentRoleDID,
        verification_method: [],
        service_endpoints: [],
        proof: { type: 'Ed25519Signature2020' },
        document_metadata: { created: true, productType: 'glass' },
      });

      await enhancedDB.insertDIDDocument({
        dpp_id: frameResult.id,
        did: frameDid,
        controller: currentRoleDID,
        verification_method: [],
        service_endpoints: [],
        proof: { type: 'Ed25519Signature2020' },
        document_metadata: { created: true, productType: 'frame' },
      });

      // Generate attestations and anchoring
      await generateWitnessAttestations(windowResult.id, windowDid, 'main');
      await generateWitnessAttestations(glassResult.id, glassDid, 'component');
      await generateWitnessAttestations(frameResult.id, frameDid, 'component');
      
      await generateAnchoringEvents(windowResult.id, windowDid, [glassDid, frameDid]);

      setStep('success');
      
      // Auto-close after success
      setTimeout(() => {
        onComplete();
      }, 2000);
    } catch (error) {
      console.error('Error creating DPP:', error);
      alert('Something went wrong. Please try again.');
      setStep('review');
    }
  }

  const currentStepIndex = steps.findIndex(s => s.id === step);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Register New Window</h2>
            <button
              onClick={onClose}
              disabled={step === 'creating'}
              className="p-1 hover:bg-white/20 rounded-lg transition-colors disabled:opacity-50"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {/* Progress Steps */}
          {step !== 'intro' && step !== 'creating' && step !== 'success' && (
            <div className="flex items-center justify-between">
              {steps.map((s, index) => (
                <div key={s.id} className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    currentStepIndex > index
                      ? 'bg-green-500 text-white'
                      : currentStepIndex === index
                        ? 'bg-white text-blue-600'
                        : 'bg-blue-500/50 text-blue-200'
                  }`}>
                    {currentStepIndex > index ? (
                      <CheckCircle className="w-5 h-5" />
                    ) : (
                      index + 1
                    )}
                  </div>
                  {index < steps.length - 1 && (
                    <div className={`w-12 h-0.5 mx-1 ${
                      currentStepIndex > index ? 'bg-green-500' : 'bg-blue-500/50'
                    }`} />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {/* Intro Step */}
          {step === 'intro' && (
            <div className="text-center py-8">
              <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Package className="w-10 h-10 text-blue-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">
                Add a new window
              </h3>
              <p className="text-gray-600 mb-8">
                In a few simple steps, register a new window with glass and frame.
              </p>
              <button
                onClick={() => setStep('window')}
                className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
              >
                Start Registration
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* Window Step */}
          {step === 'window' && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-xl">
                <Package className="w-8 h-8 text-blue-600" />
                <div>
                  <h3 className="font-semibold text-gray-900">Step 1: Window Details</h3>
                  <p className="text-sm text-gray-600">Enter the basic information</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Window Name *
                </label>
                <input
                  type="text"
                  value={windowName}
                  onChange={(e) => setWindowName(e.target.value)}
                  placeholder="e.g. Living Room Window Left"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Width (mm)
                  </label>
                  <input
                    type="number"
                    value={windowWidth}
                    onChange={(e) => setWindowWidth(Number(e.target.value))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Height (mm)
                  </label>
                  <input
                    type="number"
                    value={windowHeight}
                    onChange={(e) => setWindowHeight(Number(e.target.value))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Glass Step */}
          {step === 'glass' && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 p-4 bg-sky-50 rounded-xl">
                <Layers className="w-8 h-8 text-sky-600" />
                <div>
                  <h3 className="font-semibold text-gray-900">Step 2: Glass Type</h3>
                  <p className="text-sm text-gray-600">Select the glass type</p>
                </div>
              </div>

              <div className="space-y-3">
                {['Single glazing', 'Double glazing', 'Triple glazing', 'HR++ glazing'].map((type) => (
                  <button
                    key={type}
                    onClick={() => setGlassType(type)}
                    className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                      glassType === type
                        ? 'border-sky-500 bg-sky-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-900">{type}</span>
                      {glassType === type && (
                        <CheckCircle className="w-5 h-5 text-sky-600" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Frame Step */}
          {step === 'frame' && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 p-4 bg-purple-50 rounded-xl">
                <Square className="w-8 h-8 text-purple-600" />
                <div>
                  <h3 className="font-semibold text-gray-900">Step 3: Frame Type</h3>
                  <p className="text-sm text-gray-600">Select the frame material</p>
                </div>
              </div>

              <div className="space-y-3">
                {['Aluminium', 'Plastic (PVC)', 'Wood', 'Steel'].map((type) => (
                  <button
                    key={type}
                    onClick={() => setFrameType(type)}
                    className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                      frameType === type
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-900">{type}</span>
                      {frameType === type && (
                        <CheckCircle className="w-5 h-5 text-purple-600" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Review Step */}
          {step === 'review' && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 p-4 bg-green-50 rounded-xl">
                <Info className="w-8 h-8 text-green-600" />
                <div>
                  <h3 className="font-semibold text-gray-900">Review the details</h3>
                  <p className="text-sm text-gray-600">Is everything correct?</p>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 space-y-4">
                <div className="flex justify-between">
                  <span className="text-gray-600">Name</span>
                  <span className="font-medium text-gray-900">{windowName || '(not entered)'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Dimensions</span>
                  <span className="font-medium text-gray-900">{windowWidth} x {windowHeight} mm</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Glass</span>
                  <span className="font-medium text-gray-900">{glassType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Frame</span>
                  <span className="font-medium text-gray-900">{frameType}</span>
                </div>
              </div>
            </div>
          )}

          {/* Creating Step */}
          {step === 'creating' && (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-6"></div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Registering...</h3>
              <p className="text-gray-600">Please wait</p>
            </div>
          )}

          {/* Success Step */}
          {step === 'success' && (
            <div className="text-center py-12">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-12 h-12 text-green-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Success! ✓</h3>
              <p className="text-gray-600">The window has been successfully registered.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        {step !== 'intro' && step !== 'creating' && step !== 'success' && (
          <div className="border-t border-gray-100 p-4 flex justify-between">
            <button
              onClick={() => {
                const prevIndex = currentStepIndex - 1;
                if (prevIndex >= 0) {
                  setStep(steps[prevIndex].id);
                }
              }}
              disabled={currentStepIndex === 0}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowLeft className="w-4 h-4" />
              Previous
            </button>

            {step === 'review' ? (
              <button
                onClick={handleSubmit}
                className="flex items-center gap-2 px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
              >
                Register
                <CheckCircle className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => {
                  const nextIndex = currentStepIndex + 1;
                  if (nextIndex < steps.length) {
                    setStep(steps[nextIndex].id);
                  }
                }}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                Next
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
