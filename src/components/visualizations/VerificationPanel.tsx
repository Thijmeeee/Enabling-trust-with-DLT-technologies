import { Pause, CheckCircle, XCircle, ChevronRight, Zap, RefreshCw, Shield, Database } from 'lucide-react';
import { type VerificationStep } from '../../lib/utils/merkleTree';
import { truncateHash } from '../../lib/utils/proofUtils';

interface VerificationPanelProps {
  steps: VerificationStep[];
  currentStep: number;
  totalLevels: number;
  isVerifying: boolean;
  isValid: boolean;
  isLeafValid: boolean | null;
  merkleRoot: string;
  computedRoot?: string;
  onPlay: () => void;
  onPause: () => void;
  onReset: () => void;
  showFullHashes: boolean;
}

export default function VerificationPanel({
  steps,
  currentStep,
  totalLevels,
  isVerifying,
  isValid,
  isLeafValid,
  merkleRoot,
  computedRoot,
  onPlay,
  onPause,
  onReset,
  showFullHashes
}: VerificationPanelProps) {
  const step = steps[currentStep] || steps[steps.length - 1];
  const isComplete = currentStep >= steps.length;
  
  // Identify the source of the error if invalid
  const finalComputedHash = computedRoot || (steps.length > 0 ? steps[steps.length - 1].output : '');
  const isRootMismatch = isComplete && finalComputedHash !== merkleRoot;
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm transition-colors">
      <div className="border-b border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between bg-gray-50 dark:bg-gray-900/50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 dark:bg-indigo-900/40 rounded-lg">
            <Zap className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 dark:text-white">Verification Engine</h3>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase font-black tracking-widest">Witness Proof Audit</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isVerifying ? (
            <button onClick={onPause} className="px-6 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg flex items-center gap-2 font-bold uppercase text-xs tracking-wider transition-all shadow-md shadow-amber-500/20 active:scale-95">
              <Pause className="w-4 h-4 fill-current" /> Pause
            </button>
          ) : isComplete ? (
            <button onClick={onReset} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center gap-2 font-bold uppercase text-xs tracking-wider transition-all shadow-md shadow-indigo-500/20 active:scale-95">
              <RefreshCw className="w-4 h-4" /> Reset
            </button>
          ) : (
            <button onClick={onPlay} className="px-8 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center gap-2 font-bold uppercase text-sm tracking-widest transition-all shadow-lg shadow-emerald-500/20 active:scale-95">
              <Shield className="w-5 h-5" /> Verify
            </button>
          )}
        </div>
      </div>

      <div className="p-6">
        {!isComplete ? (
          <div className="space-y-6">
            <div className="grid grid-cols-7 items-center gap-2">
              {/* Left Input */}
              <div className="col-span-3">
                <div className="text-[10px] font-bold uppercase text-gray-400 mb-1">Left Input</div>
                <div className={`
                  p-3 rounded-lg border-2 font-mono text-xs break-all
                  ${step?.leftInput === steps[currentStep]?.leftInput ? 'bg-indigo-50 border-indigo-200 dark:bg-indigo-900/20' : 'bg-gray-50 border-gray-100 dark:bg-gray-900/20'}
                `}>
                  {truncateHash(step?.leftInput, showFullHashes)}
                </div>
              </div>

              {/* Concat Indicator */}
              <div className="flex justify-center flex-col items-center">
                <div className="text-[10px] font-black text-gray-300">CONCAT</div>
                <ChevronRight className="w-4 h-4 text-gray-300" />
              </div>

              {/* Right Input */}
              <div className="col-span-3">
                <div className="text-[10px] font-bold uppercase text-gray-400 mb-1">Right Input</div>
                <div className={`
                  p-3 rounded-lg border-2 font-mono text-xs break-all
                  ${step?.rightInput === steps[currentStep]?.rightInput ? 'bg-indigo-50 border-indigo-200 dark:bg-indigo-900/20' : 'bg-gray-50 border-gray-100 dark:bg-gray-900/20'}
                `}>
                  {truncateHash(step?.rightInput, showFullHashes)}
                </div>
              </div>
            </div>

            <div className="flex justify-center">
              <div className="bg-gray-100 dark:bg-gray-700 h-8 w-0.5" />
            </div>

            <div className="bg-indigo-600 rounded-xl p-4 text-white shadow-lg shadow-indigo-600/20 transform transition-transform">
              <div className="text-[10px] font-black uppercase tracking-widest opacity-70 mb-2 text-center">Resulting Parent Hash (SHA256)</div>
              <div className="font-mono text-sm text-center break-all">
                {truncateHash(step?.output, showFullHashes)}
              </div>
            </div>
          </div>
        ) : (
          <div className={`
            p-8 rounded-2xl flex flex-col items-center text-center transition-all duration-700
            ${isValid 
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-2 border-emerald-500 shadow-xl shadow-emerald-500/10' 
              : 'bg-red-50 dark:bg-red-950/40 border-2 border-red-500 shadow-xl shadow-red-500/10'}
          `}>
            {isValid ? (
              <>
                <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center mb-4 text-white shadow-lg shadow-emerald-500/40">
                  <CheckCircle className="w-10 h-10" />
                </div>
                <h2 className="text-2xl font-black text-emerald-900 dark:text-emerald-400 mb-2">Audit Passed</h2>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                    <CheckCircle className="w-4 h-4" />
                    <span>Cryptographic Path Verified</span>
                  </div>
                  {isLeafValid !== null && (
                    <div className={`flex items-center gap-2 ${isLeafValid ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-600 dark:text-amber-400'}`}>
                      {isLeafValid ? <CheckCircle className="w-4 h-4" /> : <Database className="w-4 h-4" />}
                      <span>{isLeafValid ? 'Local Data Match' : 'Using Witness Log (No Local Match)'}</span>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center mb-4 text-white shadow-lg shadow-red-500/40">
                  <XCircle className="w-10 h-10" />
                </div>
                <h2 className="text-2xl font-black text-red-900 dark:text-red-400 mb-2">Audit Failed</h2>
                <p className="text-red-700 dark:text-red-300 max-w-sm">
                   The Witness Proof from <code>did-witness.json</code> is mathematically inconsistent with the Blockchain Anchor. This indicates a forgery in the batch log.
                </p>
              </>
            )}
            
            <div className="mt-6 pt-6 border-t border-current/10 w-full grid grid-cols-2 gap-4">
              <div className="text-left">
                <div className={`text-[10px] font-bold uppercase ${isValid ? 'opacity-60' : 'text-red-500 opacity-100'}`}>Computed Root</div>
                <div className={`font-mono text-[10px] truncate ${!isValid && 'text-red-600 dark:text-red-400 font-bold'}`}>
                  {truncateHash(finalComputedHash, showFullHashes)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-bold uppercase opacity-60">On-Chain Anchor</div>
                <div className={`font-mono text-[10px] truncate ${!isValid && 'text-emerald-600 dark:text-emerald-400 font-bold'}`}>
                  {truncateHash(merkleRoot, showFullHashes)}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-gray-50 dark:bg-gray-900/30 px-6 py-3 flex items-center justify-between border-t border-gray-200 dark:border-gray-700">
        <div className="w-full bg-gray-200 dark:bg-gray-700 h-1.5 rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all duration-500 ${isValid ? 'bg-emerald-500' : 'bg-indigo-500'}`}
            style={{ width: `${((currentStep) / steps.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="bg-gray-50 dark:bg-gray-900/30 p-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-start gap-2 bg-blue-50 dark:bg-blue-900/10 p-3 rounded-lg border border-blue-100 dark:border-blue-900/50">
          <Database className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <p className="text-[10px] leading-relaxed text-blue-800 dark:text-blue-300 italic">
            <strong>Source:</strong> Hashes retrieved from <code>did-witness.json</code>. This audit proves the path between the witness-captured leaf and the on-chain anchor.
          </p>
        </div>
      </div>
    </div>
  );
}
