import { X, FileCheck, Calendar, User, Hash, CheckCircle, ExternalLink, AlertCircle } from 'lucide-react';
import type { WitnessAttestation } from '../../lib/data/localData';

interface AttestationDetailsModalProps {
  attestation: WitnessAttestation;
  onClose: () => void;
}

export default function AttestationDetailsModal({ attestation, onClose }: AttestationDetailsModalProps) {
  const attestationData = attestation.attestation_data as Record<string, any>;
  const hasEvidence = attestationData?.evidence || attestationData?.proofDocument || attestationData?.verificationDetails;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white px-6 py-4 rounded-t-lg flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <FileCheck className="w-6 h-6" />
            <h2 className="text-xl font-bold">Attestation Details</h2>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-200 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Basic Information */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-600 mb-1">Attestation Type</div>
                <div className="font-semibold text-lg text-blue-900 capitalize">
                  {attestation.attestation_type.replace(/_/g, ' ')}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">Timestamp</div>
                <div className="flex items-center gap-2 text-gray-900">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  <span className="font-medium">
                    {new Date(attestation.timestamp).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Witness & DID Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <User className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-gray-600">Witness DID</span>
              </div>
              <div className="font-mono text-xs text-gray-900 break-all bg-gray-50 p-2 rounded">
                {attestation.witness_did}
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Hash className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-gray-600">Product DID</span>
              </div>
              <div className="font-mono text-xs text-gray-900 break-all bg-gray-50 p-2 rounded">
                {attestation.did}
              </div>
            </div>
          </div>

          {/* Signature */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium text-gray-600">Digital Signature</span>
            </div>
            <div className="font-mono text-xs text-gray-700 break-all bg-gray-50 p-3 rounded">
              {attestation.signature}
            </div>
            <div className="mt-2 flex items-center gap-2 text-xs text-green-700">
              <CheckCircle className="w-3 h-3" />
              <span>Signature verified</span>
            </div>
          </div>

          {/* Attestation Data */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Attestation Data</h3>
            <div className="space-y-3">
              {Object.entries(attestationData).map(([key, value]) => {
                if (key === 'evidence' || key === 'proofDocument' || key === 'verificationDetails') {
                  return null; // Skip these, we'll show them separately
                }
                return (
                  <div key={key} className="flex items-start gap-3 pb-2 border-b border-gray-100 last:border-0">
                    <span className="text-sm font-medium text-gray-600 capitalize min-w-[120px]">
                      {key.replace(/([A-Z])/g, ' $1').trim()}:
                    </span>
                    <span className="text-sm text-gray-900 flex-1">
                      {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Evidence Section */}
          {hasEvidence ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <FileCheck className="w-5 h-5 text-green-600" />
                <h3 className="font-semibold text-green-900">Evidence & Proof</h3>
              </div>

              {attestationData.evidence && (
                <div className="mb-3">
                  <div className="text-sm font-medium text-gray-700 mb-1">Evidence</div>
                  <div className="bg-white p-3 rounded text-sm text-gray-900">
                    {typeof attestationData.evidence === 'object' 
                      ? JSON.stringify(attestationData.evidence, null, 2)
                      : attestationData.evidence}
                  </div>
                </div>
              )}

              {attestationData.proofDocument && (
                <div className="mb-3">
                  <div className="text-sm font-medium text-gray-700 mb-1">Proof Document</div>
                  <div className="bg-white p-3 rounded">
                    {typeof attestationData.proofDocument === 'string' && 
                     attestationData.proofDocument.startsWith('http') ? (
                      <a
                        href={attestationData.proofDocument}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm"
                      >
                        <ExternalLink className="w-4 h-4" />
                        View Document
                      </a>
                    ) : (
                      <div className="text-sm text-gray-900">
                        {typeof attestationData.proofDocument === 'object'
                          ? JSON.stringify(attestationData.proofDocument, null, 2)
                          : attestationData.proofDocument}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {attestationData.verificationDetails && (
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-1">Verification Details</div>
                  <div className="bg-white p-3 rounded text-sm text-gray-900">
                    {typeof attestationData.verificationDetails === 'object'
                      ? Object.entries(attestationData.verificationDetails).map(([k, v]) => (
                          <div key={k} className="flex gap-2 mb-1">
                            <span className="font-medium">{k}:</span>
                            <span>{String(v)}</span>
                          </div>
                        ))
                      : attestationData.verificationDetails}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-yellow-900 mb-1">No Detailed Evidence Available</h3>
                  <p className="text-sm text-yellow-800 mb-3">
                    This attestation has been recorded but does not include additional evidence documents or verification details.
                  </p>
                  <div className="text-xs text-yellow-700 bg-yellow-100 p-3 rounded">
                    <strong>What this means:</strong> The attestation has been cryptographically signed and 
                    recorded on the blockchain, but supporting documents (such as inspection reports, test results, 
                    or photos) were not attached at the time of creation.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Blockchain Information */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Blockchain Record</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-gray-600">Status:</span>
                <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded font-medium">
                  Immutably Recorded
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-600">Record ID:</span>
                <span className="font-mono text-xs text-gray-900">{attestation.id}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-600">Created:</span>
                <span className="text-gray-900">{new Date(attestation.created_at).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 rounded-b-lg">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
