/**
 * MerkleTreeVisualizer Component
 * 
 * An interactive, scalable Merkle Tree visualization for the Watcher Dashboard.
 * This component visualizes how DID-event integrity is verified through cryptographic
 * proof chains showing the "HOW" of trustless verification.
 */

import { useState, useEffect, useRef } from 'react';
import { 
  GitBranch, 
  Shield, 
  ZoomIn,
  ZoomOut,
  Maximize,
  Database,
  Lock,
  Copy,
  ExternalLink,
  Info,
  RefreshCw,
  Hash
} from 'lucide-react';
import { 
  buildProofPath,
  verifyProofPath,
  hashWitnessEntry,
  type ProofPathStructure,
  type VerificationStep,
  type VerificationResult,
} from '../../lib/utils/merkleTree';
import type { WatcherAlert } from '../../lib/data/localData';
import { type AnchoringProof } from '../../types/witness';
import ProofPathRenderer from './ProofPathRenderer';
import VerificationPanel from './VerificationPanel';

interface Props {
  selectedProof?: AnchoringProof;
  localOperation?: any; 
  onVerificationComplete?: (result: VerificationResult) => void;
  alerts?: WatcherAlert[];
}

export default function MerkleTreeVisualizer({ 
  selectedProof,
  localOperation,
  onVerificationComplete,
}: Props) {
  // State
  const [proofPath, setProofPath] = useState<ProofPathStructure | null>(null);
  const [verificationSteps, setVerificationSteps] = useState<VerificationStep[]>([]);
  const [isLeafValid, setIsLeafValid] = useState<boolean | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifiedLevels, setVerifiedLevels] = useState<Set<number>>(new Set());
  const [showFullHashes, setShowFullHashes] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  // Ref for the container
  const containerRef = useRef<HTMLDivElement>(null);

  // Build proof path when proof changes
  useEffect(() => {
    if (!selectedProof) {
      setProofPath(null);
      setVerificationSteps([]);
      setCurrentStep(0);
      setVerifiedLevels(new Set());
      return;
    }

    try {
      const path = buildProofPath(selectedProof);
      const verification = verifyProofPath(selectedProof);
      
      // Secondary check: Does the local operation hash match the witness leaf?
      if (localOperation) {
        const localHash = hashWitnessEntry(localOperation);
        setIsLeafValid(localHash === path.leafHash);
      } else {
        setIsLeafValid(null);
      }

      setProofPath(path);
      setVerificationSteps(verification.steps);
      setCurrentStep(0);
      setVerifiedLevels(new Set());
    } catch (error) {
      console.error('Error building proof path:', error);
      setProofPath(null);
    }
  }, [selectedProof]);

  // Verification Logic
  useEffect(() => {
    let timer: any;
    if (isVerifying && proofPath && currentStep < verificationSteps.length) {
      timer = setTimeout(() => {
        setVerifiedLevels(prev => new Set([...prev, currentStep]));
        setCurrentStep(prev => prev + 1);
      }, 1000);
    } else if (currentStep >= verificationSteps.length && isVerifying) {
      setIsVerifying(false);
      onVerificationComplete?.({
        steps: verificationSteps,
        computedRoot: verificationSteps[verificationSteps.length-1].output,
        expectedRoot: proofPath.merkleRoot,
        isValid: proofPath.isValid
      });
    }
    return () => clearTimeout(timer);
  }, [isVerifying, currentStep, verificationSteps, proofPath, onVerificationComplete]);

  // Handlers
  const handlePlay = () => setIsVerifying(true);
  const handlePause = () => setIsVerifying(false);
  const handleReset = () => {
    setCurrentStep(0);
    setVerifiedLevels(new Set());
    setIsVerifying(false);
  };
  const handleStepForward = () => {
    if (currentStep < verificationSteps.length) {
      setVerifiedLevels(prev => new Set([...prev, currentStep]));
      setCurrentStep(prev => prev + 1);
    }
  };
  const handleStepBackward = () => {
    if (currentStep > 0) {
      const nextLevels = new Set(verifiedLevels);
      nextLevels.delete(currentStep - 1);
      setVerifiedLevels(nextLevels);
      setCurrentStep(prev => prev - 1);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(text);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  if (!selectedProof) {
    return (
      <div className="flex flex-col items-center justify-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-dashed border-gray-300 dark:border-gray-700 min-h-[400px]">
        <div className="inline-flex items-center justify-center p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-full mb-4">
          <GitBranch className="w-8 h-8 text-indigo-400" />
        </div>
        <h3 className="text-gray-900 dark:text-white font-medium">No Operation Selected</h3>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1 max-w-xs text-center">
          Select a DID operation from the history list to visualize its cryptographic integrity proof.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 relative">
      {/* Visualizer Controls */}
      <div className="flex items-center justify-between bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
            <span className="text-[10px] sm:text-xs font-medium text-gray-600 dark:text-gray-400">Anchor (Internal Node)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-rose-500"></div>
            <span className="text-[10px] sm:text-xs font-medium text-gray-600 dark:text-gray-400">Target Leaf</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
            <span className="text-[10px] sm:text-xs font-medium text-gray-600 dark:text-gray-400">Batch Sibling</span>
          </div>
          <div className="hidden sm:flex items-center gap-2 border-l border-gray-200 dark:border-gray-700 pl-4 ml-2">
            <Shield className="w-4 h-4 text-emerald-500" />
            <span className="text-[10px] font-bold text-gray-500 uppercase">Hierarchical Proof Visualizer</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Zoom Controls */}
          <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-md p-0.5 mr-2">
            <button 
              onClick={() => setZoomLevel(prev => Math.max(0.4, prev - 0.1))}
              className="p-1.5 text-gray-500 hover:text-indigo-600 transition-colors"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-[10px] font-bold w-10 text-center text-gray-600 dark:text-gray-300">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button 
              onClick={() => setZoomLevel(prev => Math.min(2, prev + 0.1))}
              className="p-1.5 text-gray-500 hover:text-indigo-600 transition-colors"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setZoomLevel(1)}
              className="p-1.5 text-gray-500 hover:text-indigo-600 border-l border-gray-200 dark:border-gray-600 ml-0.5"
              title="Reset Zoom"
            >
              <Maximize className="w-4 h-4" />
            </button>
          </div>

          <button 
            onClick={() => setShowFullHashes(!showFullHashes)}
            className={`p-1.5 rounded-md transition-colors ${showFullHashes ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
            title="Toggle Full Hashes"
          >
            <Hash className="w-4 h-4" />
          </button>
          <button 
            onClick={handleReset}
            className="p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
            title="Reset Verification"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Display */}
      <div 
        ref={containerRef}
        className="relative bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 overflow-auto min-h-[600px]"
      >
        <div 
          className="flex flex-col items-center pt-8 transition-transform duration-300 ease-out overflow-visible"
          style={{ 
            transform: `scale(${zoomLevel})`,
            transformOrigin: 'top center',
            minWidth: 'fit-content',
            width: '100%',
            paddingLeft: '100px',
            paddingRight: '100px'
          }}
        >
           {proofPath ? (
             <div className="flex flex-col lg:flex-row gap-12 w-full">
               <div className="flex-1 min-w-0">
                 <ProofPathRenderer 
                   proofPath={proofPath}
                   verificationProgress={currentStep - 1}
                   verifiedLevels={verifiedLevels}
                   showFullHashes={showFullHashes}
                 />
               </div>
               <div className="w-full lg:w-96 shrink-0 pt-8">
                 <VerificationPanel 
                   steps={verificationSteps}
                   currentStep={currentStep}
                   totalLevels={verificationSteps.length}
                   isVerifying={isVerifying}
                   isValid={proofPath.isValid}
                   isLeafValid={isLeafValid}
                   merkleRoot={proofPath.merkleRoot}
                   onPlay={handlePlay}
                   onPause={handlePause}
                   onReset={handleReset}
                   showFullHashes={showFullHashes}
                 />
               </div>
             </div>
           ) : (
             <div className="flex flex-col items-center justify-center h-96 text-gray-500">
               <Database className="w-16 h-16 mb-4 opacity-20" />
               <p className="font-medium">Selected operation has no witness proof data</p>
               <p className="text-sm">A witness anchor is required for cryptographic verification</p>
             </div>
           )}
        </div>
      </div>

      {/* Protocol Metadata Footer */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-4 border border-indigo-100 dark:border-indigo-900/40">
           <div className="flex gap-4">
             <div className="p-3 bg-white dark:bg-gray-800 rounded-xl shadow-sm self-start">
                <Lock className="w-6 h-6 text-indigo-600" />
             </div>
             <div>
                <h4 className="text-xs font-bold text-indigo-900 dark:text-indigo-300 uppercase tracking-widest mb-1">Blockchain Root Anchor</h4>
                <div className="font-mono text-[10px] sm:text-xs text-indigo-800 dark:text-indigo-200 break-all mb-2">
                  {proofPath?.merkleRoot || '0x0000000000000000000000000000000000000000000000000000000000000000'}
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => copyToClipboard(proofPath?.merkleRoot || '')}
                    className="text-[10px] flex items-center gap-1.5 px-2 py-1 bg-white dark:bg-gray-800 rounded border border-indigo-200 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 transition-colors"
                  >
                    {copiedHash === proofPath?.merkleRoot ? 'Copied!' : 'Copy Root Hash'}
                    <Copy className="w-3 h-3" />
                  </button>
                  {selectedProof?.txHash && (
                      <a 
                        href={`https://sepolia.etherscan.io/tx/${selectedProof.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] flex items-center gap-1.5 px-2 py-1 bg-white dark:bg-gray-800 rounded border border-indigo-200 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 transition-colors"
                      >
                         <ExternalLink className="w-3 h-3" />
                         Verify on Etherscan
                      </a>
                  )}
                </div>
             </div>
           </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 flex flex-col justify-center">
           <div className="text-[10px] text-gray-500 uppercase font-bold mb-1">Hashing Protocol</div>
           <div className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
             <Info className="w-4 h-4 text-blue-500" />
             SHA-256 (RFC 6234)
           </div>
           <div className="mt-3 text-[10px] text-gray-500 leading-tight">
             This witness branch proves the inclusion of your DID event in batch #{selectedProof?.batchId || 'N/A'}.
           </div>
        </div>
      </div>
    </div>
  );
}

