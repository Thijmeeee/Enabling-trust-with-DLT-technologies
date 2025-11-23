import { useState } from 'react';
import { Play, Check, Loader, X } from 'lucide-react';
import { localDB } from '../lib/localData';
import { DPPWatcher, createWitnessAttestation } from '../lib/watcherLocal';

export default function DemoScenarios({ onClose, onRefresh }: { onClose: () => void; onRefresh: () => void }) {
  const [running, setRunning] = useState<string | null>(null);
  const [completed, setCompleted] = useState<string[]>([]);

  async function runScenario1() {
    setRunning('scenario1');

    const newGlassDid = 'did:webvh:example.com:products:glass-G2025-999';
    const newFrameDid = 'did:webvh:example.com:products:frame-F2025-888';
    const newWindowDid = 'did:webvh:example.com:products:window-W2025-100';

    const glassData = await localDB.insertDPP({
      did: newGlassDid,
      type: 'component',
      model: 'Glass-TripleGlazed-Premium',
      parent_did: newWindowDid,
      lifecycle_status: 'active',
      owner: 'did:webvh:example.com:organizations:glass-supplier',
      custodian: 'did:webvh:example.com:organizations:window-manufacturer',
      metadata: { description: 'Triple-glazed premium glass' },
      version: 1,
      previous_version_id: null,
    });

    await createWitnessAttestation(
      glassData.id,
      newGlassDid,
      'did:webvh:example.com:witnesses:qa-1',
      'creation',
      { event: 'Component created', location: 'Factory' }
    );

    await new Promise((resolve) => setTimeout(resolve, 500));

    const frameData = await localDB.insertDPP({
      did: newFrameDid,
      type: 'component',
      model: 'Frame-UPVC-Insulated',
      parent_did: newWindowDid,
      lifecycle_status: 'active',
      owner: 'did:webvh:example.com:organizations:frame-supplier',
      custodian: 'did:webvh:example.com:organizations:window-manufacturer',
      metadata: { description: 'UPVC insulated frame' },
      version: 1,
      previous_version_id: null,
    });

    await createWitnessAttestation(
      frameData.id,
      newFrameDid,
      'did:webvh:example.com:witnesses:qa-2',
      'creation',
      { event: 'Component created', location: 'Factory' }
    );

    await new Promise((resolve) => setTimeout(resolve, 500));

    const windowData = await localDB.insertDPP({
      did: newWindowDid,
      type: 'main',
      model: 'Window-Luxury-2025',
      parent_did: null,
      lifecycle_status: 'active',
      owner: 'did:webvh:example.com:organizations:window-manufacturer',
      custodian: null,
      metadata: { description: 'Luxury triple-glazed window' },
      version: 1,
      previous_version_id: null,
    });

    await localDB.insertRelationship({
      parent_did: newWindowDid,
      child_did: newGlassDid,
      relationship_type: 'component',
      position: 1,
      metadata: {},
    });

    await localDB.insertRelationship({
      parent_did: newWindowDid,
      child_did: newFrameDid,
      relationship_type: 'component',
      position: 2,
      metadata: {},
    });

    await localDB.insertDIDDocument({
      dpp_id: windowData.id,
      did: newWindowDid,
      controller: windowData.owner,
      verification_method: [],
      service_endpoints: [],
      proof: {},
      document_metadata: {},
    });

    const watcher = new DPPWatcher();
    await watcher.initialize('Demo Watcher', 'hierarchy', [newWindowDid, newGlassDid, newFrameDid]);
    await watcher.checkHierarchy();

    setRunning(null);
    setCompleted([...completed, 'scenario1']);
    onRefresh();
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">Demo Scenarios</h2>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded">
              <X size={24} />
            </button>
          </div>

          <div className="space-y-4">
            <div className="border rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg mb-2">
                    Scenario 1: Hierarchical DPP Creation
                  </h3>
                  <p className="text-gray-600 text-sm mb-3">
                    Create a new window product with glass and frame components, establish hierarchical relationships,
                    and register witness attestations.
                  </p>
                  <ul className="text-sm text-gray-500 space-y-1 mb-3">
                    <li>• Create glass component DPP</li>
                    <li>• Create frame component DPP</li>
                    <li>• Create main window DPP</li>
                    <li>• Link components to main product</li>
                    <li>• Register witness attestations</li>
                    <li>• Initialize watcher monitoring</li>
                  </ul>
                </div>
                <button
                  onClick={runScenario1}
                  disabled={running !== null}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                    completed.includes('scenario1')
                      ? 'bg-green-100 text-green-700'
                      : running === 'scenario1'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {running === 'scenario1' ? (
                    <>
                      <Loader size={18} className="animate-spin" />
                      Running
                    </>
                  ) : completed.includes('scenario1') ? (
                    <>
                      <Check size={18} />
                      Completed
                    </>
                  ) : (
                    <>
                      <Play size={18} />
                      Run
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> Demo scenarios use local in-memory storage. Data will reset when you refresh the page.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
