/**
 * MerkleTreeVisualizer Component
 * 
 * An interactive, scalable Merkle Tree visualization for the Watcher Dashboard.
 * This component visualizes how DID-event integrity is verified through cryptographic
 * proof chains, showing the "HOW" of trustless verification.
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  Hash, 
  GitBranch, 
  Shield, 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle,
  ChevronDown, 
  ChevronRight,
  ChevronLeft,
  Layers,
  Lock,
  Zap,
  Eye,
  EyeOff,
  RefreshCw,
  Info,
  ArrowRight,
  Copy,
  Check,
  ZoomIn,
  ZoomOut,
  Maximize,
  Plus,
  X,
} from 'lucide-react';
import { 
  buildMerkleTree, 
  getMerkleProof, 
  type MerkleNodeData,
  type MerkleTreeResult,
  type MerkleProof,
  type DIDOperation,
} from '../../lib/utils/merkleTree';
import type { WatcherAlert } from '../../lib/data/localData';

interface Props {
  selectedDPPDid?: string;
  operations?: DIDOperation[];
  alerts?: WatcherAlert[];
  onNodeClick?: (node: MerkleNodeData) => void;
  onOperationSelect?: (operation: DIDOperation) => void;
}

export default function MerkleTreeVisualizer({ 
  selectedDPPDid, 
  operations = [],
  alerts = [],
  onNodeClick,
  onOperationSelect,
}: Props) {
  // State
  const [merkleResult, setMerkleResult] = useState<MerkleTreeResult | null>(null);
  const [selectedLeaf, setSelectedLeaf] = useState<MerkleNodeData | null>(null);
  const [currentProof, setCurrentProof] = useState<MerkleProof | null>(null);
  const [displayTree, setDisplayTree] = useState<MerkleNodeData | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<'idle' | 'success' | 'failed'>('idle');
  const [animatingPath, setAnimatingPath] = useState(false);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [verificationProgress, setVerificationProgress] = useState<number>(-1); // -1 = none, 0-N = layer being verified
  const [verifiedNodes, setVerifiedNodes] = useState<Set<string>>(new Set());
  const [showHashDetails, setShowHashDetails] = useState(false);
  const [selectedStepIndex, setSelectedStepIndex] = useState<number | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showFullHashes, setShowFullHashes] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [scrollStart, setScrollStart] = useState({ left: 0, top: 0 });

  // Sync sidebar with leaf selection
  useEffect(() => {
    if (selectedLeaf) setIsSidebarOpen(true);
  }, [selectedLeaf]);
  
  // Ref for the container to handle scrolling
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle mouse wheel zoom and internal scrolling
  useEffect(() => {
    const handleGlobalWheel = (e: WheelEvent) => {
      const container = containerRef.current;
      if (!container) return;

      // Check if the scroll event happened inside or on the container
      if (container.contains(e.target as Node)) {
        // ALWAYS prevent default browser behavior (zoom or page scroll) when inside the tree
        e.preventDefault();

        if (e.ctrlKey || e.metaKey) {
          // Zoom functionality
          const zoomSpeed = 0.002; // Slightly faster zoom
          const delta = -e.deltaY * zoomSpeed;
          setZoomLevel(prev => Math.min(2, Math.max(0.4, prev + delta)));
        } else {
          // Manual scroll inside the container since we prevented default
          container.scrollTop += e.deltaY;
          container.scrollLeft += e.deltaX;
        }
      }
    };

    // Attaching to window with passive: false to ensure preventDefault() works for browser zoom
    window.addEventListener('wheel', handleGlobalWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleGlobalWheel);
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only left click initiated drag
    if (e.button !== 0) return;
    if (!containerRef.current) return;
    
    setIsDragging(true);
    setDragStart({ x: e.pageX, y: e.pageY });
    setScrollStart({ 
      left: containerRef.current.scrollLeft, 
      top: containerRef.current.scrollTop 
    });
    
    // Change cursor to grabbing
    containerRef.current.style.cursor = 'grabbing';
    containerRef.current.style.userSelect = 'none';
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !containerRef.current) return;
    
    e.preventDefault();
    const x = e.pageX;
    const y = e.pageY;
    
    const walkX = (x - dragStart.x) * 1.5;
    const walkY = (y - dragStart.y) * 1.5;
    
    containerRef.current.scrollLeft = scrollStart.left - walkX;
    containerRef.current.scrollTop = scrollStart.top - walkY;
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    if (containerRef.current) {
      containerRef.current.style.cursor = 'grab';
      containerRef.current.style.removeProperty('user-select');
    }
  };

  // Build Merkle tree when operations change
  useEffect(() => {
    if (!operations || operations.length === 0) {
      setMerkleResult(null);
      setDisplayTree(null);
      return;
    }

    try {
      const result = buildMerkleTree(operations);
      setMerkleResult(result);
      
      // Initially, mark nodes with errors if there are alerts
      const treeWithErrors = markIntegrityErrors(result.tree, alerts);
      setDisplayTree(treeWithErrors);
    } catch (error) {
      console.error('MerkleTreeVisualizer: Error building tree', error);
      setMerkleResult(null);
      setDisplayTree(null);
    }
  }, [operations, alerts]);

  // Handle leaf selection and proof generation
  const handleLeafClick = useCallback(async (leaf: MerkleNodeData) => {
    if (!merkleResult || !leaf.operation) return;
    
    // Reset previous verification
    setVerifiedNodes(new Set());
    setVerificationProgress(-1);
    setSelectedStepIndex(null);
    setSelectedLeaf(leaf);
    
    // Generate proof
    const proof = getMerkleProof(operations, leaf.operation);
    setCurrentProof(proof);
    
    // Mark nodes on proof path
    const treeWithHighlights = markTreeHighlights(
      markIntegrityErrors(merkleResult.tree, alerts),
      proof,
      leaf.index
    );
    setDisplayTree(treeWithHighlights);
    
    // Start Animated Verification Sequence
    setIsVerifying(true);
    setVerificationResult('idle');
    
    // The proof path goes from leaf upwards. 
    // We want to animate each level.
    const maxDepth = merkleResult.depth;
    
    for (let d = maxDepth; d >= 0; d--) {
      setVerificationProgress(d);
      
      // Look for the node at this depth that is on the proof path
      const findNodeIdAtDepth = (node: MerkleNodeData): string | null => {
        if (node.depth === d && node.isOnProofPath) return node.id;
        let found = null;
        if (node.leftChild) found = findNodeIdAtDepth(node.leftChild);
        if (!found && node.rightChild) found = findNodeIdAtDepth(node.rightChild);
        return found;
      };

      const pathNodeId = findNodeIdAtDepth(treeWithHighlights);
      
      // Simulate cryptographic calculation time
      await new Promise(r => setTimeout(r, 600));
      
      if (pathNodeId) {
        setVerifiedNodes(prev => {
          const next = new Set(prev);
          next.add(pathNodeId);
          return next;
        });
      }
    }
    
    setIsVerifying(false);
    // setVerificationProgress(-1); // REMOVED: keep progress state for persistent emerald pathing
    setVerificationResult(leaf.hasError ? 'failed' : 'success');
    
    // Notify parent
    onNodeClick?.(leaf);
    if (leaf.operation) {
      onOperationSelect?.(leaf.operation);
    }
  }, [merkleResult, operations, alerts, onNodeClick, onOperationSelect]);

  // Helper to mark errors in the tree (propagating upwards)
  function markIntegrityErrors(node: MerkleNodeData, alerts: WatcherAlert[]): MerkleNodeData {
    const newNode = { ...node };
    
    // Check if this leaf has an associated alert
    if (newNode.type === 'leaf' && newNode.operation) {
      const hasAlert = alerts.some(a => 
        a.status === 'active' && 
        (a.alert_type === 'hash_chain_broken' || a.alert_type === 'signature_mismatch' || a.alert_type === 'state_mismatch')
      );
      
      if (hasAlert) {
        newNode.hasError = true;
        newNode.errorMessage = 'Integrity Failure: Hash mismatch detected';
      }
    }
    
    // Process children
    if (newNode.leftChild) newNode.leftChild = markIntegrityErrors(newNode.leftChild, alerts);
    if (newNode.rightChild) newNode.rightChild = markIntegrityErrors(newNode.rightChild, alerts);
    
    // If any child has an error, this node also has an error (propagation)
    if (newNode.leftChild?.hasError || newNode.rightChild?.hasError) {
      newNode.hasError = true;
    }
    
    return newNode;
  }

  // Helper to mark path and siblings
  function markTreeHighlights(node: MerkleNodeData, proof: MerkleProof, leafIndex: number): MerkleNodeData {
    const newNode = { ...node };
    const depth = newNode.depth;
    const index = newNode.index;

    // Check if this node is on the path or is a sibling
    const isOnPath = isNodeOnPath(newNode, leafIndex, merkleResult!.depth);
    if (isOnPath) {
      newNode.isOnProofPath = true;
      newNode.isSelected = (newNode.type === 'leaf' && newNode.index === leafIndex);
    }

    // Is it a sibling in the proof?
    const isSibling = proof.proof.some(p => p === newNode.hash);
    if (isSibling && !isOnPath) {
      newNode.siblingHash = newNode.hash;
    }
    
    // Process children
    if (newNode.leftChild) newNode.leftChild = markTreeHighlights(newNode.leftChild, proof, leafIndex);
    if (newNode.rightChild) newNode.rightChild = markTreeHighlights(newNode.rightChild, proof, leafIndex);
    
    return newNode;
  }

  function isNodeOnPath(node: MerkleNodeData, leafIndex: number, treeDepth: number): boolean {
    // A node at height H (where leaf is height 0) covers a range of leaf indices
    // height = treeDepth - node.depth (leaves are at max height in buildMerkleTree, but we use depth property)
    // Actually, in buildMerkleTree, root has depth 0, leaves have depth treeDepth.
    const height = treeDepth - node.depth;
    const rangeSize = Math.pow(2, height);
    const rangeStart = node.index * rangeSize;
    const rangeEnd = rangeStart + rangeSize - 1;
    
    return leafIndex >= rangeStart && leafIndex <= rangeEnd;
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(text);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  if (!displayTree) {
    return (
      <div className="flex flex-col items-center justify-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-dashed border-gray-300 dark:border-gray-700 min-h-[400px]">
        <div className="inline-flex items-center justify-center p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-full mb-4">
          <GitBranch className="w-8 h-8 text-indigo-400" />
        </div>
        <h3 className="text-gray-900 dark:text-white font-medium">No Cryptographic History</h3>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1 max-w-xs text-center">
          This product does not have any anchored DID events yet. Complete a manufacturing or transfer step to generate integrity proofs.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 relative">
      {/* Sidebar / HUD Overlay */}
      <div className={`
        fixed top-0 right-0 h-full w-[400px] bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 shadow-2xl z-[100] transition-transform duration-500 ease-in-out
        ${isSidebarOpen && selectedLeaf ? 'translate-x-0' : 'translate-x-full'}
      `}>
        {selectedLeaf && (
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="bg-indigo-600 p-6 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-black uppercase tracking-tighter">Audit Explorer</h3>
                  <div className="text-xs text-indigo-200 font-bold uppercase tracking-widest">Client-Side Verification</div>
                </div>
              </div>
              <button 
                onClick={() => setIsSidebarOpen(false)}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </div>

            {/* Content Container */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
              
              {/* Target Data Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase text-gray-400 tracking-wider">Audit Target</h4>
                  <div className="px-2 py-0.5 bg-rose-100 dark:bg-rose-950/40 text-rose-600 text-[10px] font-bold rounded uppercase">Leaf Node</div>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-800 flex items-center gap-4">
                  <div className="p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                    <Hash className="w-6 h-6 text-rose-500" />
                  </div>
                  <div>
                    <div className="text-sm font-black text-gray-900 dark:text-white uppercase">{selectedLeaf.label}</div>
                    <div className="text-xs font-mono text-gray-500 truncate w-48">
                      {selectedLeaf.hash}
                    </div>
                  </div>
                </div>
              </div>

              {/* Progress Detail */}
              <div className="space-y-4">
                <h4 className="text-xs font-black uppercase text-gray-400 tracking-wider">Cryptographic Proof Path</h4>
                <div className="space-y-4 relative before:absolute before:left-[19px] before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-100 dark:before:bg-gray-800">
                  {currentProof?.proof.map((p, i) => (
                    <div 
                      key={i} 
                      onClick={() => verifiedNodes.size > i && setSelectedStepIndex(i === selectedStepIndex ? null : i)}
                      className={`relative pl-12 cursor-pointer transition-all duration-300 group ${
                        selectedStepIndex === i ? 'scale-[1.02]' : 'hover:translate-x-1'
                      }`}
                    >
                      {/* Step Indicator */}
                      <div className={`
                        absolute left-0 top-1 w-10 h-10 rounded-full border-4 border-white dark:border-gray-800 z-10 flex items-center justify-center transition-all duration-500
                        ${verifiedNodes.size > i 
                          ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' 
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-400'}
                      `}>
                        {verifiedNodes.size > i ? <Check className="w-5 h-5 stroke-[3px]" /> : <span className="font-black text-sm">{i + 1}</span>}
                      </div>

                      {/* Step Card */}
                      <div className={`p-4 rounded-xl border transition-all duration-300 ${
                        selectedStepIndex === i 
                          ? 'bg-indigo-50 border-indigo-200 dark:bg-indigo-950/20 dark:border-indigo-900 shadow-lg' 
                          : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 hover:border-indigo-200 dark:hover:border-indigo-800'
                      }`}>
                         <div className="flex justify-between items-center mb-2">
                           <span className="text-xs font-black uppercase text-gray-400">Combine Sibling</span>
                           <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                             currentProof.positions[i] === 'left' ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'
                           }`}>
                             {currentProof.positions[i].toUpperCase()}
                           </span>
                         </div>
                         <div className="font-mono text-xs text-gray-600 dark:text-gray-400 break-all leading-relaxed">
                            {showFullHashes ? p : `${p.substring(0, 24)}...`}
                         </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Math Detail (Drawer-style) */}
              {selectedStepIndex !== null && currentProof && (
                <div className="p-6 bg-indigo-600 rounded-2xl text-white space-y-5 animate-in slide-in-from-bottom-4 duration-300 shadow-xl">
                  <div className="flex items-center justify-between border-b border-indigo-500 pb-3">
                     <div className="flex items-center gap-2">
                        <Zap className="w-5 h-5 text-yellow-300 fill-yellow-300" />
                        <span className="font-black uppercase tracking-tighter text-sm">Calculation Details</span>
                     </div>
                     <button onClick={() => setSelectedStepIndex(null)} className="text-white/60 hover:text-white">
                        <X className="w-4 h-4" />
                     </button>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                       <div className="text-[11px] font-black uppercase text-indigo-300">Input Current</div>
                       <div className="p-3 bg-black/20 rounded-lg font-mono text-xs break-all leading-tight">
                         {currentProof.path[selectedStepIndex]}
                       </div>
                    </div>
                    <div className="flex justify-center -my-2">
                      <Plus className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div className="space-y-1.5">
                       <div className="text-[11px] font-black uppercase text-indigo-300">Input Sibling ({currentProof.positions[selectedStepIndex]})</div>
                       <div className="p-3 bg-black/20 rounded-lg font-mono text-xs break-all leading-tight ring-1 ring-white/10">
                         {currentProof.proof[selectedStepIndex]}
                       </div>
                    </div>
                    <div className="flex justify-center -my-2">
                      <div className="h-6 w-0.5 bg-indigo-400"></div>
                    </div>
                    <div className="space-y-1.5">
                       <div className="text-[11px] font-black uppercase text-indigo-300">Result (Sha256)</div>
                       <div className="p-3 bg-emerald-500 rounded-lg font-mono text-xs break-all leading-tight shadow-inner shadow-black/20 text-white font-bold">
                         {currentProof.path[selectedStepIndex + 1]}
                       </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Action */}
            <div className="p-6 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 shrink-0">
               {verificationResult !== 'idle' ? (
                 <div className="space-y-4">
                    <div className={`p-4 rounded-xl flex items-center gap-4 ${
                      verificationResult === 'success' 
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' 
                        : 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                    }`}>
                      {verificationResult === 'success' ? <CheckCircle2 className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
                      <div className="flex-1">
                        <div className="font-black uppercase text-xs tracking-tight">
                          {verificationResult === 'success' ? 'Verification Success' : 'Integrity Mismatch'}
                        </div>
                        <div className="text-xs opacity-80 leading-tight mt-0.5">
                          {verificationResult === 'success' 
                            ? 'The cryptographic chain perfectly matches the Root Anchor.'
                            : 'A data mismatch was detected. This event may have been tampered.'}
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={() => {
                        setSelectedLeaf(null);
                        setVerifiedNodes(new Set());
                        setCurrentProof(null);
                        setDisplayTree(markIntegrityErrors(merkleResult!.tree, alerts));
                        setVerificationResult('idle');
                        setSelectedStepIndex(null);
                        setVerificationProgress(-1);
                      }}
                      className="w-full py-4 bg-gray-900 dark:bg-white dark:text-gray-900 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-black dark:hover:bg-gray-200 transition-all shadow-xl active:scale-[0.98]"
                    >
                      Audit Complete
                    </button>
                 </div>
               ) : (
                  <div className="text-center text-[11px] text-gray-400 font-bold uppercase py-2">
                    Running Automated Audit...
                  </div>
               )}
            </div>
          </div>
        )}
      </div>

      {/* Floating Toggle (When sidebar hidden but leaf selected) */}
      {!isSidebarOpen && selectedLeaf && (
        <button 
          onClick={() => setIsSidebarOpen(true)}
          className="fixed right-6 top-1/2 -translate-y-1/2 bg-indigo-600 text-white p-4 rounded-l-2xl shadow-2xl z-[90] animate-in slide-in-from-right-10 duration-500 hover:pl-8 transition-all"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}

      {/* Visualizer Controls */}
      <div className="flex items-center justify-between bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className="text-[10px] sm:text-xs font-medium text-gray-600 dark:text-gray-400">Verified</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span className="text-[10px] sm:text-xs font-medium text-gray-600 dark:text-gray-400">Invalid</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-indigo-500"></div>
            <span className="text-[10px] sm:text-xs font-medium text-gray-600 dark:text-gray-400">Proof Path</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-300 dark:bg-blue-700"></div>
            <span className="text-[10px] sm:text-xs font-medium text-gray-600 dark:text-gray-400">Proof Sibling</span>
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
            onClick={() => setShowHashDetails(!showHashDetails)}
            className={`p-1.5 rounded-md transition-colors ${showHashDetails ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
            title="Toggle Hash View"
          >
            <Hash className="w-4 h-4" />
          </button>
          <button 
            onClick={() => {
              setSelectedLeaf(null);
              setCurrentProof(null);
              setDisplayTree(markIntegrityErrors(merkleResult!.tree, alerts));
            }}
            className="p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
            title="Reset Visualizer"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Tree Display */}
      <div 
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className="relative bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 overflow-auto min-h-[500px] cursor-grab"
      >
        <div 
          className="flex flex-col items-center pt-8 transition-transform duration-300 ease-out"
          style={{ 
            transform: `scale(${zoomLevel})`,
            transformOrigin: 'top center',
            minWidth: 'fit-content',
            width: '100%'
          }}
        >
           <MerkleTreeGraphic 
             node={displayTree} 
             onLeafClick={handleLeafClick}
             onVerificationClick={(depth) => {
               // Map tree depth to step index
               // Depth = depth, Root at 0, Leaves at maxDepth
               // Steps 0 = leaf (depth maxDepth), Step N-1 = Root (depth 1)
               if (merkleResult) {
                 const stepIdx = merkleResult.depth - depth;
                 if (stepIdx >= 0 && stepIdx < (currentProof?.proof.length || 0)) {
                   setSelectedStepIndex(stepIdx);
                 } else if (depth === 0) {
                   // This is the root verification (last step check)
                   setSelectedStepIndex((currentProof?.proof.length || 1) - 1);
                 }
               }
             }}
             showHashes={showHashDetails}
             proof={currentProof}
             verifiedNodes={verifiedNodes}
             verificationProgress={verificationProgress}
           />
        </div>
      </div>

      {/* Bottom Protocol Footer */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-4 border border-indigo-100 dark:border-indigo-900/40">
           <div className="flex gap-4">
             <div className="p-3 bg-white dark:bg-gray-800 rounded-xl shadow-sm self-start">
                <Lock className="w-6 h-6 text-indigo-600" />
             </div>
             <div>
                <h4 className="text-xs font-bold text-indigo-900 dark:text-indigo-300 uppercase tracking-widest mb-1">On-Chain Anchor</h4>
                <div className="font-mono text-[10px] sm:text-xs text-indigo-800 dark:text-indigo-200 break-all mb-2">
                  {merkleResult?.root}
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => copyToClipboard(merkleResult?.root || '')}
                    className="text-[10px] flex items-center gap-1.5 px-2 py-1 bg-white dark:bg-gray-800 rounded border border-indigo-200 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 transition-colors"
                  >
                    {copiedHash === merkleResult?.root ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    Copy Root Hash
                  </button>
                </div>
             </div>
           </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 flex flex-col justify-center">
           <div className="text-[10px] text-gray-500 uppercase font-bold mb-1">Hash Algorithm</div>
           <div className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
             <Info className="w-4 h-4 text-blue-500" />
             SHA-256 (Secure Hash)
           </div>
           <div className="mt-3 text-[10px] text-gray-500">
             Ensures that any change to event data completely changes the Root Hash.
           </div>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// GRAPHIC COMPONENT
// ----------------------------------------------------------------------------

interface GraphicProps {
  node: MerkleNodeData;
  onLeafClick: (leaf: MerkleNodeData) => void;
  onVerificationClick?: (depth: number) => void;
  showHashes: boolean;
  proof: MerkleProof | null;
  verifiedNodes: Set<string>;
  verificationProgress: number;
}

function MerkleTreeGraphic({ 
  node, 
  onLeafClick, 
  onVerificationClick,
  showHashes, 
  proof,
  verifiedNodes,
  verificationProgress 
}: GraphicProps) {
  // Sizing constants
  const nodeWidth = 160;
  const nodeHeight = 70;
  const verticalGap = 80;

  // Helper to count leaves in a subtree for weighted layout
  const countLeaves = (n: MerkleNodeData): number => {
     if (!n.leftChild && !n.rightChild) return 1;
     return (n.leftChild ? countLeaves(n.leftChild) : 0) + 
            (n.rightChild ? countLeaves(n.rightChild) : 0);
  };

  const renderNode = (n: MerkleNodeData, depth: number = 0) => {
    const isLeaf = n.type === 'leaf';
    const hasError = !!n.hasError;
    const isOnPath = !!n.isOnProofPath;
    const isSelected = !!n.isSelected;
    const isSibling = !!n.siblingHash;
    
    // Consistent scale based on depth
    const scale = Math.pow(0.96, depth);
    
    // Determine theme colors
    const typeStyles = {
      root: 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 shadow-indigo-200/20',
      leaf: 'border-rose-500 bg-rose-50 dark:bg-rose-950/40 shadow-rose-200/20',
      internal: 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 shadow-blue-200/20'
    };

    const currentTypeStyle = typeStyles[n.type];

    // Calculate weights for positioning
    const leftWeight = n.leftChild ? countLeaves(n.leftChild) : 0;
    const rightWeight = n.rightChild ? countLeaves(n.rightChild) : 0;
    const totalWeight = leftWeight + rightWeight;

    // Calculate line endpoints in percentages
    const leftX = totalWeight > 0 ? (leftWeight / totalWeight) * 50 : 50;
    const rightX = totalWeight > 0 ? (leftWeight / totalWeight) * 100 + (rightWeight / totalWeight) * 50 : 50;

    const isVerified = verifiedNodes.has(n.id);
    const isCalculating = verificationProgress === n.depth && isOnPath;

    return (
      <div 
        key={n.id} 
        className="flex flex-col items-center" 
        style={{ flex: totalWeight || 1, minWidth: `${nodeWidth * scale}px` }}
      >
        {/* Node UI */}
        <div 
          onClick={() => isLeaf && onLeafClick(n)}
          style={{ 
            width: `${nodeWidth * scale}px`, 
            height: `${nodeHeight * scale}px`,
            transform: `scale(${scale})`
          }}
          className={`
            relative z-10 rounded-xl border-2 flex flex-col items-center justify-center p-2 transition-all duration-500 shadow-lg
            ${isLeaf ? 'cursor-pointer hover:shadow-xl hover:-translate-y-0.5' : 'cursor-default'}
            ${hasError 
                ? 'border-red-600 bg-red-100 dark:bg-red-900 shadow-[0_0_25px_rgba(220,38,38,0.4)]' 
                : isSelected 
                  ? 'border-green-600 bg-green-100 dark:bg-green-950 ring-2 ring-green-400'
                  : isOnPath
                    ? isVerified 
                      ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 ring-2 ring-emerald-400'
                      : 'border-indigo-600 bg-indigo-100 dark:bg-primary-900/40 ring-2 ring-indigo-400'
                    : isSibling
                      ? 'border-blue-600 bg-blue-100 dark:bg-blue-900/40'
                      : currentTypeStyle
            }
          `}
        >
          {/* Verification Overlay */}
          {(isCalculating || isVerified) && isOnPath && (
            <div 
              onClick={(e) => {
                e.stopPropagation();
                if (isVerified) onVerificationClick?.(n.depth);
              }}
              className={`absolute -right-3 -top-3 w-8 h-8 rounded-full border-2 flex items-center justify-center shadow-lg z-20 cursor-pointer hover:scale-110 active:scale-95 transition-transform ${
                isVerified ? 'bg-emerald-600 border-white text-white' : 'bg-indigo-600 border-white text-white'
              }`}
            >
              {isCalculating ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
            </div>
          )}

          {/* Label */}
          <div className="flex items-center gap-1.5 mb-1 w-full justify-center">
            <div className={`p-1 rounded shadow-sm ${
              n.type === 'root' ? 'bg-indigo-600 text-white' :
              n.type === 'leaf' ? 'bg-rose-600 text-white' :
              'bg-blue-600 text-white'
            }`}>
              {n.type === 'root' ? <Lock className="w-2.5 h-2.5" /> :
               n.type === 'leaf' ? <Hash className="w-2.5 h-2.5" /> :
               <Layers className="w-2.5 h-2.5" />}
            </div>
            <span className={`text-[11px] font-black truncate uppercase tracking-tight ${hasError ? 'text-red-950' : 'text-slate-900 dark:text-white'}`}>
              {n.label}
            </span>
          </div>
          
          {/* Hash Box */}
          <div className={`font-mono text-[9px] w-full text-center truncate px-2 py-0.5 rounded border ${
            isOnPath || isSelected
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-indigo-200 dark:border-indigo-800' 
              : 'bg-white/60 dark:bg-black/40 text-slate-600 dark:text-slate-400 border-black/5 dark:border-white/5'
          }`}>
            {showHashes ? n.hash : `${n.hash.substring(0, 8)}...${n.hash.substring(n.hash.length - 6)}`}
          </div>

          {/* Tamper Badge */}
          {hasError && (
             <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-red-600 text-white text-[8px] font-black px-2 py-0.5 rounded-full shadow-md flex items-center gap-1 uppercase ring-1 ring-white">
                <AlertTriangle className="w-2 h-2" />
                TAMPER
             </div>
          )}
        </div>

        {/* Children Layout */}
        {(n.leftChild || n.rightChild) && (
          <div className="w-full relative flex justify-center" style={{ marginTop: `${verticalGap}px` }}>
            {/* SVG Connectors */}
            <svg 
              className="absolute left-0 w-full pointer-events-none z-0" 
              style={{ 
                top: `-${verticalGap + (nodeHeight/2 * scale)}px`, 
                height: `${verticalGap + (nodeHeight * scale)}px`,
                overflow: 'visible' 
              }}
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
               {n.leftChild && (
                 <path 
                   d={`M 50 0 L ${leftX} 100`} 
                   fill="none" 
                   strokeLinecap="round"
                   vectorEffect="non-scaling-stroke"
                   className={`
                     ${n.leftChild.isOnProofPath || n.leftChild.siblingHash 
                        ? verifiedNodes.has(n.leftChild.id)
                          ? 'stroke-emerald-600 dark:stroke-emerald-400 stroke-[4px] opacity-100'
                          : 'stroke-indigo-600 dark:stroke-indigo-400 stroke-[3.5px] opacity-100 shadow-xl' 
                        : 'stroke-black dark:stroke-white stroke-[3px] opacity-100'} 
                     transition-all duration-300
                   `}
                 />
               )}
               {n.rightChild && (
                 <path 
                   d={`M 50 0 L ${rightX} 100`} 
                   fill="none" 
                   strokeLinecap="round"
                   vectorEffect="non-scaling-stroke"
                   className={`
                     ${n.rightChild.isOnProofPath || n.rightChild.siblingHash  
                        ? verifiedNodes.has(n.rightChild.id)
                          ? 'stroke-emerald-600 dark:stroke-emerald-400 stroke-[4px] opacity-100'
                          : 'stroke-indigo-600 dark:stroke-indigo-400 stroke-[3.5px] opacity-100 shadow-xl' 
                        : 'stroke-black dark:stroke-white stroke-[3px] opacity-100'} 
                     transition-all duration-300
                   `}
                 />
               )}
            </svg>

            <div className="flex justify-between w-full">
              {n.leftChild && (
                <div style={{ flex: leftWeight }} className="flex justify-center">
                  {renderNode(n.leftChild, depth + 1)}
                </div>
              )}
              {n.rightChild && (
                <div style={{ flex: rightWeight }} className="flex justify-center">
                  {renderNode(n.rightChild, depth + 1)}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col items-center w-full">
      {renderNode(node)}
    </div>
  );
}

