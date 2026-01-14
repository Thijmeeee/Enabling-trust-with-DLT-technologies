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
  Hash,
  AlertCircle
} from 'lucide-react';
import { 
  buildProofPath,
  verifyProofPath,
  hashWitnessEntry,
  type ProofPathStructure,
  type VerificationStep,
  type VerificationResult,
} from '../../lib/utils/merkleTree';
import { type AnchoringProof } from '../../types/witness';
import ProofPathRenderer from './ProofPathRenderer';
import VerificationPanel from './VerificationPanel';

interface Props {
  selectedProof?: AnchoringProof;
  localOperation?: any; 
  onVerificationComplete?: (result: VerificationResult) => void;
  alerts?: any[];
}

export default function MerkleTreeVisualizer({ 
  selectedProof,
  localOperation,
  onVerificationComplete,
  alerts = []
}: Props) {
  // Check if current event has active alerts
  const hasActiveAlert = alerts.some(a => a.status === 'active' || !a.status);

  // State
  const [proofPath, setProofPath] = useState<ProofPathStructure | null>(null);
  const [verificationSteps, setVerificationSteps] = useState<VerificationStep[]>([]);
  const [isLeafValid, setIsLeafValid] = useState<boolean | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifiedLevels, setVerifiedLevels] = useState<Set<number>>(new Set());
  const [showFullHashes, setShowFullHashes] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(0.7);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  // Dragging state for panning
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });

  // Ref for the container
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle mouse events for panning
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    
    setIsDragging(true);
    dragStart.current = {
      x: e.pageX - containerRef.current.offsetLeft,
      y: e.pageY - containerRef.current.offsetTop,
      scrollLeft: containerRef.current.scrollLeft,
      scrollTop: containerRef.current.scrollTop
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !containerRef.current) return;
    
    e.preventDefault();
    const x = e.pageX - containerRef.current.offsetLeft;
    const y = e.pageY - containerRef.current.offsetTop;
    
    const walkX = (x - dragStart.current.x) * 1.5; // Drag speed mult
    const walkY = (y - dragStart.current.y) * 1.5;
    
    containerRef.current.scrollLeft = dragStart.current.scrollLeft - walkX;
    containerRef.current.scrollTop = dragStart.current.scrollTop - walkY;
  };

  const handleMouseUpOrLeave = () => {
    setIsDragging(false);
  };

  // Handle mouse wheel zoom with Ctrl key
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        setZoomLevel(prev => {
          const newZoom = Math.min(2.5, Math.max(0.2, prev + delta));
          return Number(newZoom.toFixed(2));
        });
      }
    };

    // Use capturing to ensure we catch it before other handlers
    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [containerRef.current]);

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
        expectedRoot: proofPath?.merkleRoot || '',
        isValid: proofPath?.isValid || false
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
    <div className={`flex flex-col gap-4 relative transition-all duration-700 ${
      hasActiveAlert ? 'ring-4 ring-red-500/20 rounded-2xl p-2 bg-red-50/10 dark:bg-red-900/5' : ''
    }`}>
      {/* Visualizer Header */}
      <div className={`flex items-center justify-between p-3 rounded-lg border shadow-sm transition-colors duration-300 ${
        hasActiveAlert 
          ? 'bg-red-50 dark:bg-red-900/40 border-red-200 dark:border-red-800' 
          : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
      }`}>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Shield className={`w-5 h-5 ${hasActiveAlert ? 'text-red-500' : 'text-indigo-500'}`} />
            <span className="text-sm font-bold text-gray-700 dark:text-gray-200 uppercase tracking-widest">
              {hasActiveAlert ? 'COMPROMISED ASSET AUDIT' : 'Merkle Proof Visualizer'}
            </span>
          </div>
          
          {hasActiveAlert && (
            <div className="flex items-center gap-2 px-3 py-1 bg-red-600 text-white text-[10px] font-black rounded-full">
              <AlertCircle className="w-3 h-3" />
              FLAGGED INCONSISTENCY
            </div>
          )}

          <div className="hidden lg:block h-6 w-px bg-gray-200 dark:bg-gray-700 mx-2"></div>
          <div className="hidden lg:flex items-center gap-2">
            <Database className="w-4 h-4 text-gray-400" />
            <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Verification Protocol v1.0</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Zoom Controls */}
          <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-md p-0.5 mr-2">
            <button 
              onClick={() => setZoomLevel(prev => Math.max(0.2, prev - 0.1))}
              className="p-1.5 text-gray-500 hover:text-indigo-600 transition-colors"
              title="Zoom Out (Ctrl + Scroll)"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-[10px] font-bold w-10 text-center text-gray-600 dark:text-gray-300">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button 
              onClick={() => setZoomLevel(prev => Math.min(2.5, prev + 0.1))}
              className="p-1.5 text-gray-500 hover:text-indigo-600 transition-colors"
              title="Zoom In (Ctrl + Scroll)"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setZoomLevel(0.7)}
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

      {/* Main Display Area - Side by Side Layout */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Left Column: Zoomable Merkle Tree */}
        <div className="flex-1 min-w-0 w-full">
          <div 
            ref={containerRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUpOrLeave}
            onMouseLeave={handleMouseUpOrLeave}
            className={`
              relative bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 
              overflow-auto min-h-[600px] max-h-[850px] shadow-inner transition-colors
              bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] dark:bg-[radial-gradient(#374151_1px,transparent_1px)] 
              [background-size:24px_24px] select-none
              ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}
            `}
          >
            {proofPath ? (
              <div 
                className="transition-transform duration-300 ease-out p-12 flex justify-center"
                style={{ 
                  transform: `scale(${zoomLevel})`,
                  minWidth: 'fit-content',
                  width: '100%',
                  transformOrigin: 'top center'
                }}
              >
                <div className="min-w-[500px]">
                  <ProofPathRenderer 
                    proofPath={proofPath}
                    verificationProgress={currentStep - 1}
                    verifiedLevels={verifiedLevels}
                    showFullHashes={showFullHashes}
                  />
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[500px] text-gray-500">
                <Database className="w-16 h-16 mb-4 opacity-20" />
                <p className="font-medium">Selected operation has no witness proof data</p>
                <p className="text-sm">A witness anchor is required for cryptographic verification</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Static Verification Engine (Does not zoom) */}
        {proofPath && (
          <div className="w-full lg:w-[400px] shrink-0 sticky top-4">
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
            
            {/* Legend inside the sidebar for better space usage */}
            <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
              <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Map Legend</h4>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]"></div>
                  <span className="text-xs text-gray-600 dark:text-gray-400">On-Chain Root / Verified Node</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]"></div>
                  <span className="text-xs text-gray-600 dark:text-gray-400">Target Operation (Leaf)</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.4)]"></div>
                  <span className="text-xs text-gray-600 dark:text-gray-400">Batch Sibling Hash</span>
                </div>
              </div>
            </div>
          </div>
        )}
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

