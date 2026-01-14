import { Shield, Lock, Hash, Share2 } from 'lucide-react';
import { type ProofPathStructure } from '../../lib/utils/merkleTree';
import { truncateHash } from '../../lib/utils/proofUtils';

interface ProofPathRendererProps {
  proofPath: ProofPathStructure;
  verificationProgress: number; 
  verifiedLevels: Set<number>;
  showFullHashes: boolean;
  onLevelClick?: (level: number) => void;
}

interface TreeLeafNode {
  type: 'path' | 'sibling';
  hash: string;
  level: number;
}

interface TreeInternalNode {
  type: 'internal';
  hash: string;
  level: number;
  left: TreeLeafNode | TreeInternalNode;
  right: TreeLeafNode | TreeInternalNode;
}

type TreeNode = TreeLeafNode | TreeInternalNode;

export default function ProofPathRenderer({
  proofPath,
  verifiedLevels,
  showFullHashes,
}: ProofPathRendererProps) {
  // Convert flat proof path to a hierarchical tree structure for visualization
  const buildTree = (levelIdx: number, currentHash: string): TreeNode => {
    if (levelIdx < 0) {
      return { type: 'path', hash: proofPath.leafHash, level: -1 };
    }

    const level = proofPath.levels[levelIdx];
    const isLeftChild = level.isLeftChild;

    const pathChild = buildTree(levelIdx - 1, level.currentHash);
    const siblingChild: TreeLeafNode = { type: 'sibling', hash: level.siblingHash, level: levelIdx };

    return {
      type: 'internal',
      hash: currentHash,
      level: levelIdx,
      left: isLeftChild ? pathChild : siblingChild,
      right: isLeftChild ? siblingChild : pathChild
    };
  };

  const tree = buildTree(proofPath.levels.length - 1, proofPath.merkleRoot);

  const renderTreeNode = (node: TreeNode, depth: number = 0) => {
    // A node is considered "verified" if:
    // 1. It's an internal node and its level is in verifiedLevels
    // 2. It's the path leaf and verification hasn't started or level 0 is done
    // 3. It's a sibling that was used in a verified level
    const isVerified = node.type === 'internal' 
      ? verifiedLevels.has(node.level) 
      : (node.type === 'path' ? verifiedLevels.has(0) : verifiedLevels.has(node.level));

    // Determine if this specific node is currently the active computation step
    // We now include inputs (leaf/siblings) in the active state to ensure highlighting starts at the absolute bottom
    const isInternalActive = node.type === 'internal' && verifiedLevels.size === node.level;
    const isLeafActive = node.type === 'path' && verifiedLevels.size === 0;
    const isSiblingActive = node.type === 'sibling' && verifiedLevels.size === node.level;
    
    const isActive = isInternalActive || isLeafActive || isSiblingActive;

    // Determine type-specific background colors and borders
    let bgColorClass = 'bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700';
    let iconColorClass = 'text-gray-400';
    let label = '';
    let Icon = Lock;

    if (node.type === 'path') {
      if (isVerified) {
        bgColorClass = 'bg-rose-100 border-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.3)] dark:bg-rose-900/40 dark:border-rose-400';
        iconColorClass = 'text-rose-600 dark:text-rose-400';
      } else if (isActive) {
        bgColorClass = 'bg-rose-50 border-rose-500 animate-pulse shadow-[0_0_20px_rgba(244,63,94,0.4)] dark:bg-rose-900/40 dark:border-rose-400';
        iconColorClass = 'text-rose-600 dark:text-rose-300';
      } else {
        bgColorClass = 'bg-rose-50 border-rose-200 dark:bg-rose-950/20 dark:border-rose-900/50';
        iconColorClass = 'text-rose-400 dark:text-rose-600';
      }
      label = 'Verification Target';
      Icon = Hash;
    } else if (node.type === 'sibling') {
      if (isVerified) {
        bgColorClass = 'bg-blue-100 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.3)] dark:bg-blue-900/40 dark:border-blue-400';
        iconColorClass = 'text-blue-600 dark:text-blue-400';
      } else if (isActive) {
        bgColorClass = 'bg-blue-50 border-blue-500 animate-pulse shadow-[0_0_20px_rgba(59,130,246,0.4)] dark:bg-blue-900/40 dark:border-blue-400';
        iconColorClass = 'text-blue-600 dark:text-blue-300';
      } else {
        bgColorClass = 'bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-900/50';
        iconColorClass = 'text-blue-400 dark:text-blue-600';
      }
      label = 'Batch Sibling';
      Icon = Share2;
    } else {
      // Internal nodes
      const isRoot = node.level === proofPath.levels.length - 1;
      if (isVerified) {
        bgColorClass = 'bg-emerald-100 border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.4)] dark:bg-emerald-900/40 dark:border-emerald-400';
        iconColorClass = 'text-emerald-600 dark:text-emerald-400';
      } else if (isActive) {
        bgColorClass = 'bg-indigo-50 border-indigo-500 animate-pulse shadow-[0_0_25px_rgba(99,102,241,0.5)] dark:bg-indigo-900/40 dark:border-indigo-400';
        iconColorClass = 'text-indigo-600 dark:text-indigo-300';
      } else {
        bgColorClass = 'bg-gray-50 border-gray-200 dark:bg-gray-800/60 dark:border-gray-700';
        iconColorClass = 'text-gray-400 dark:text-gray-500';
      }
      label = isRoot ? 'On-Chain Anchor' : `Internal Hash Lvl ${node.level + 1}`;
      Icon = isRoot ? Shield : Lock;
    }

    return (
      <div className="flex flex-col items-center">
        {/* Node Box */}
        <div className={`
          relative z-10 flex flex-col items-center p-2 rounded-xl border-2 transition-all duration-700 min-w-[160px]
          ${bgColorClass}
          ${isActive ? 'scale-105 z-20' : 'scale-100'}
        `}>
          <div className="flex items-center gap-2 mb-1.5 w-full justify-center">
            <Icon className={`w-3.5 h-3.5 transition-colors ${iconColorClass}`} />
            <span className={`text-[9px] font-black uppercase tracking-wider transition-colors ${isVerified || isActive ? iconColorClass : 'text-gray-400 dark:text-gray-500'}`}>
              {label}
            </span>
          </div>
          
          <div className={`
            w-full rounded-lg p-2 border transition-all duration-500 text-center
            ${isVerified || isActive 
                ? 'bg-white/80 dark:bg-black/40 border-black/5 dark:border-white/10 shadow-sm' 
                : 'bg-gray-100/50 dark:bg-gray-900/50 border-transparent'}
          `}>
            <div className="text-[8px] opacity-40 font-black mb-0.5 text-gray-500 dark:text-gray-400 uppercase tracking-widest">sha256 hash</div>
            <div className={`
              font-mono text-[10px] font-bold truncate px-1 transition-all duration-500
              ${isVerified || isActive ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-600'}
            `}>
              {truncateHash(node.hash, showFullHashes)}
            </div>
          </div>
        </div>

        {/* Children Container */}
        {node.type === 'internal' && (
          <div className="flex mt-16 relative min-w-full">
            {/* Connection Lines - Uniform Theme and Step Feedback */}
            <svg 
              className="absolute -top-16 left-0 w-full h-16 pointer-events-none overflow-visible"
              preserveAspectRatio="none"
            >
              <line 
                x1="50%" y1="0" x2="25%" y2="100%" 
                className={`transition-all duration-700 stroke-[2px] ${
                  isVerified 
                    ? 'stroke-emerald-500 dark:stroke-emerald-400 opacity-100' 
                    : isActive 
                      ? 'stroke-indigo-500 dark:stroke-indigo-400 opacity-100 animate-pulse' 
                      : 'stroke-gray-300 dark:stroke-gray-700 opacity-40'
                }`}
                strokeLinecap="round"
              />
              <line 
                x1="50%" y1="0" x2="75%" y2="100%" 
                className={`transition-all duration-700 stroke-[2px] ${
                  isVerified 
                    ? 'stroke-emerald-500 dark:stroke-emerald-400 opacity-100' 
                    : isActive 
                      ? 'stroke-indigo-500 dark:stroke-indigo-400 opacity-100 animate-pulse' 
                      : 'stroke-gray-300 dark:stroke-gray-700 opacity-40'
                }`}
                strokeLinecap="round"
              />
            </svg>
            
            <div className="w-1/2 flex justify-center px-2">
              {renderTreeNode(node.left, depth + 1)}
            </div>
            <div className="w-1/2 flex justify-center px-2">
              {renderTreeNode(node.right, depth + 1)}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col items-center py-4 min-w-max">
       <div className="p-8">
          {renderTreeNode(tree)}
       </div>
    </div>
  );
}

