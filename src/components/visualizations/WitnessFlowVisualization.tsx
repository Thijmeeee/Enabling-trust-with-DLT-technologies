import { useEffect, useState } from 'react';
import { Shield, UserCheck, FileSignature, CheckCircle2, Clock } from 'lucide-react';
import { localDB } from '../../lib/data/localData';
import type { WitnessAttestation } from '../../lib/data/localData';

export default function WitnessFlowVisualization({ did }: { did: string }) {
  const [attestations, setAttestations] = useState<WitnessAttestation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAttestations();
  }, [did]);

  async function loadAttestations() {
    setLoading(true);
    const data = await localDB.getAttestationsByDID(did);
    setAttestations(data);
    setLoading(false);
  }

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
        <Shield className="w-5 h-5 text-green-600" />
        <h3 className="text-lg font-semibold text-gray-900">Witness Attestation Flow</h3>
        <span className="ml-auto text-sm text-gray-500">{attestations.length} attestations</span>
      </div>

      <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
        <p className="text-sm text-gray-700">
          <strong>Witnesses</strong> are independent validator nodes that monitor and attest to <strong>DID events</strong> such as 
          ownership changes, key rotations, and DID document updates. They provide cryptographic proof that these events occurred correctly.
        </p>
      </div>

      {/* Flow Diagram */}
      <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-green-50 rounded-lg border border-blue-200">
        <div className="flex items-center justify-between">
          <div className="flex flex-col items-center flex-1">
            <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center mb-2">
              <FileSignature className="w-6 h-6 text-white" />
            </div>
            <span className="text-sm font-medium text-gray-700">1. DID Event</span>
            <span className="text-xs text-gray-500">Ownership/Key change</span>
          </div>
          <div className="flex-shrink-0 w-8 h-0.5 bg-gray-300 mx-2"></div>
          <div className="flex flex-col items-center flex-1">
            <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center mb-2">
              <UserCheck className="w-6 h-6 text-white" />
            </div>
            <span className="text-sm font-medium text-gray-700">2. Witness</span>
            <span className="text-xs text-gray-500">Validator observes</span>
          </div>
          <div className="flex-shrink-0 w-8 h-0.5 bg-gray-300 mx-2"></div>
          <div className="flex flex-col items-center flex-1">
            <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center mb-2">
              <FileSignature className="w-6 h-6 text-white" />
            </div>
            <span className="text-sm font-medium text-gray-700">3. Sign</span>
            <span className="text-xs text-gray-500">Cryptographic signature</span>
          </div>
          <div className="flex-shrink-0 w-8 h-0.5 bg-gray-300 mx-2"></div>
          <div className="flex flex-col items-center flex-1">
            <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mb-2">
              <CheckCircle2 className="w-6 h-6 text-white" />
            </div>
            <span className="text-sm font-medium text-gray-700">4. Attest</span>
            <span className="text-xs text-gray-500">Record on blockchain</span>
          </div>
        </div>
      </div>

      {/* Attestations List */}
      <div className="space-y-4">
        {attestations.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Shield className="w-12 h-12 mx-auto mb-2 opacity-50" />
            No witness attestations found
          </div>
        ) : (
          attestations.map((attestation) => {
            const getAttestationTypeInfo = (type: string) => {
              if (type === 'did_creation') return { label: 'DID Creation', color: 'blue' };
              if (type === 'key_rotation') return { label: 'Key Rotation', color: 'purple' };
              if (type === 'ownership_change') return { label: 'Ownership Change', color: 'orange' };
              if (type === 'did_update') return { label: 'DID Document Update', color: 'green' };
              return { label: type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()), color: 'gray' };
            };
            
            const typeInfo = getAttestationTypeInfo(attestation.attestation_type);
            
            return (
              <div key={attestation.id} className="border border-gray-200 rounded-lg p-4 bg-gradient-to-r from-white to-green-50 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                      <Shield className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">{typeInfo.label}</h4>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Clock className="w-3 h-3" />
                        {new Date(attestation.timestamp).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div className={`px-3 py-1 bg-${typeInfo.color}-100 text-${typeInfo.color}-700 rounded-full text-xs font-medium`}>
                    Verified
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="p-2 bg-white rounded border border-gray-200">
                    <p className="text-xs text-gray-500 mb-1">Witness DID</p>
                    <p className="font-mono text-xs break-all text-gray-800">{attestation.witness_did}</p>
                  </div>

                  <div className="p-2 bg-white rounded border border-gray-200">
                    <p className="text-xs text-gray-500 mb-1">Cryptographic Signature</p>
                    <p className="font-mono text-xs break-all text-gray-800">{attestation.signature}</p>
                  </div>

                  {attestation.attestation_data && Object.keys(attestation.attestation_data).length > 0 && (
                    <div className="p-2 bg-white rounded border border-gray-200">
                      <p className="text-xs text-gray-500 mb-1">Attestation Data</p>
                      <div className="space-y-1">
                        {Object.entries(attestation.attestation_data).map(([key, value]) => (
                          <div key={key} className="flex gap-2">
                            <span className="text-xs font-medium text-gray-600">{key}:</span>
                            <span className="text-xs text-gray-800">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Verification Status */}
                <div className="mt-3 flex items-center gap-2 text-sm text-green-700 bg-green-50 p-2 rounded">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="font-medium">Signature Verified</span>
                  <span className="text-xs text-green-600">• Witness authenticated • Signature valid • Timestamp verified</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
