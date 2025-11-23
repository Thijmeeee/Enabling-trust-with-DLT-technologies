import { useState } from 'react';
import { CheckCircle, Circle, Clock, ArrowRight, Info } from 'lucide-react';

interface DIDLifecycleStep {
  id: string;
  title: string;
  description: string;
  status: 'completed' | 'current' | 'pending';
  timestamp?: string;
  details?: Record<string, any>;
}

export default function DIDLifecycleVisualization({ did, didDocument, anchoringEvents }: {
  did: string;
  didDocument: any;
  anchoringEvents: any[];
}) {
  const [expandedStep, setExpandedStep] = useState<string | null>(null);

  // Build lifecycle steps based on actual data
  const lifecycleSteps: DIDLifecycleStep[] = [
    {
      id: 'creation',
      title: 'DID Creation',
      description: 'DID identifier generated following webvh method specification',
      status: 'completed',
      timestamp: didDocument?.created_at,
      details: {
        method: 'did:webvh',
        identifier: did,
        controller: didDocument?.controller,
      },
    },
    {
      id: 'registration',
      title: 'DID Document Registration',
      description: 'DID Document created with verification methods and service endpoints',
      status: didDocument ? 'completed' : 'pending',
      timestamp: didDocument?.created_at,
      details: didDocument ? {
        verificationMethods: didDocument.verification_method?.length || 0,
        serviceEndpoints: didDocument.service_endpoints?.length || 0,
        proof: didDocument.proof,
      } : undefined,
    },
    {
      id: 'verification',
      title: 'Verification Setup',
      description: 'Cryptographic verification methods established',
      status: didDocument ? 'completed' : 'pending',
      timestamp: didDocument?.created_at,
      details: didDocument ? {
        methods: didDocument.verification_method || [],
        verificationMethodCount: didDocument.verification_method?.length || 0,
      } : undefined,
    },
    {
      id: 'linkage',
      title: 'DPP Linkage',
      description: 'DID linked to Digital Product Passport',
      status: didDocument?.dpp_id ? 'completed' : 'pending',
      timestamp: didDocument?.created_at,
      details: didDocument?.dpp_id ? {
        dppId: didDocument.dpp_id,
        linkedAt: didDocument.created_at,
      } : undefined,
    },
    {
      id: 'anchoring',
      title: 'DLT Anchoring',
      description: 'DID anchored to distributed ledger for immutability',
      status: anchoringEvents && anchoringEvents.length > 0 ? 'completed' : 'pending',
      timestamp: anchoringEvents?.[0]?.timestamp,
      details: anchoringEvents?.[0] ? {
        ledger: anchoringEvents[0].ledger_name,
        transactionId: anchoringEvents[0].transaction_id,
        merkleRoot: anchoringEvents[0].merkle_root,
        blockNumber: anchoringEvents[0].block_number,
      } : undefined,
    },
    {
      id: 'active',
      title: 'Active State',
      description: 'DID is now active and fully operational',
      status: anchoringEvents && anchoringEvents.length > 0 ? 'completed' : 'current',
      timestamp: new Date().toISOString(),
    },
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-6 h-6 text-green-600" />;
      case 'current':
        return <Clock className="w-6 h-6 text-blue-600 animate-pulse" />;
      default:
        return <Circle className="w-6 h-6 text-gray-300" />;
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
        <Info className="w-5 h-5 text-blue-600" />
        DID Lifecycle
      </h2>

      <div className="space-y-4">
        {lifecycleSteps.map((step, index) => (
          <div key={step.id} className="relative">
            {/* Connecting line */}
            {index < lifecycleSteps.length - 1 && (
              <div
                className={`absolute left-3 top-12 bottom-0 w-0.5 ${
                  step.status === 'completed' ? 'bg-green-600' : 'bg-gray-200'
                }`}
              />
            )}

            <div
              className={`relative flex items-start gap-4 p-4 rounded-lg cursor-pointer transition-colors ${
                expandedStep === step.id
                  ? 'bg-blue-50 border border-blue-200'
                  : 'hover:bg-gray-50'
              }`}
              onClick={() => setExpandedStep(expandedStep === step.id ? null : step.id)}
            >
              <div className="relative z-10 bg-white rounded-full">
                {getStatusIcon(step.status)}
              </div>

              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">{step.title}</h3>
                  {step.timestamp && (
                    <span className="text-xs text-gray-500">
                      {new Date(step.timestamp).toLocaleString()}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600 mt-1">{step.description}</p>

                {expandedStep === step.id && step.details && (
                  <div className="mt-4 p-3 bg-white rounded border border-gray-200">
                    <div className="text-xs font-semibold text-gray-600 mb-2">Details:</div>
                    <div className="space-y-1">
                      {Object.entries(step.details).map(([key, value]) => (
                        <div key={key} className="flex justify-between text-xs">
                          <span className="text-gray-600 capitalize">
                            {key.replace(/([A-Z])/g, ' $1').trim()}:
                          </span>
                          <span className="font-mono text-gray-900 ml-2 break-all max-w-xs text-right">
                            {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <ArrowRight
                className={`w-4 h-4 text-gray-400 transition-transform ${
                  expandedStep === step.id ? 'rotate-90' : ''
                }`}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <p className="text-sm text-blue-800">
          <strong>DID Method:</strong> did:webvh (Web Verifiable History)
          <br />
          <strong>Status:</strong> {lifecycleSteps.filter(s => s.status === 'completed').length} of {lifecycleSteps.length} steps completed
        </p>
      </div>
    </div>
  );
}
