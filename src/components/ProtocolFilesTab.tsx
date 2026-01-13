import { useState } from 'react';
import DIDLogFileView from './DIDLogFileView';
import WitnessFileView from './WitnessFileView';
import { FileCode, ShieldCheck, Database, FileJson } from 'lucide-react';

interface ProtocolFilesTabProps {
  did: string;
}

export default function ProtocolFilesTab({ did }: ProtocolFilesTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<'log' | 'witness'>('log');

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden mt-6">
      <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 px-6 pt-4">
        <div className="flex items-center gap-2 mb-4">
          <Database className="w-5 h-5 text-purple-600" />
          <h3 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">
            Raw Protocol Resources
          </h3>
          <span className="ml-2 px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-[10px] font-bold rounded-full uppercase tracking-wider">
            Spec-Compliant
          </span>
        </div>
        
        <div className="flex gap-6">
          <button
            onClick={() => setActiveSubTab('log')}
            className={`pb-3 text-sm font-semibold transition-all relative ${
              activeSubTab === 'log'
                ? 'text-purple-600 dark:text-purple-400'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            <div className="flex items-center gap-2">
              <FileCode className="w-4 h-4" />
              DID Log (did.jsonl)
            </div>
            {activeSubTab === 'log' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600 dark:bg-purple-400 rounded-full" />
            )}
          </button>
          
          <button
            onClick={() => setActiveSubTab('witness')}
            className={`pb-3 text-sm font-semibold transition-all relative ${
              activeSubTab === 'witness'
                ? 'text-purple-600 dark:text-purple-400'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" />
              Witness Proofs (did-witness.json)
            </div>
            {activeSubTab === 'witness' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600 dark:bg-purple-400 rounded-full" />
            )}
          </button>
        </div>
      </div>

      <div className="p-6">
        {activeSubTab === 'log' ? (
          <DIDLogFileView did={did} />
        ) : (
          <WitnessFileView did={did} />
        )}
      </div>
      
      <div className="bg-gray-50 dark:bg-gray-800/80 px-6 py-3 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center">
        <p className="text-[10px] text-gray-500 dark:text-gray-400 italic">
          Files are addressed via the did:webvh HTTPS transformation
        </p>
        <div className="flex items-center gap-1 text-[10px] font-medium text-gray-400">
          <FileJson className="w-3 h-3" />
          JSON-LD / JSONL
        </div>
      </div>
    </div>
  );
}
