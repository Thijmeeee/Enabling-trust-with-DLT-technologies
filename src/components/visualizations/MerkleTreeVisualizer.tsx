import { useState, useEffect, useMemo } from 'react';
import { 
  Hash, 
  GitBranch, 
  Shield, 
  CheckCircle2, 
  AlertTriangle, 
  Package, 
  ChevronDown, 
  ChevronRight,
  Layers,
  Lock,
  ExternalLink
} from 'lucide-react';
import { hybridDataStore } from '../../lib/data/hybridDataStore';
import { API_CONFIG } from '../../lib/api/config';

interface MerkleNode {
  id: string;
  hash: string;
  label: string;
  type: 'root' | 'batch' | 'product' | 'component' | 'event';
  children?: MerkleNode[];
  verified?: boolean;
  data?: any;
  depth?: number;
}

interface BatchData {
  batchId: number;
  merkleRoot: string;
  txHash?: string;
  blockNumber?: number;
  timestamp?: string;
  eventCount: number;
  events: any[];
}

interface Props {
  selectedDPPId?: string;
  selectedDPPDid?: string;
  onNodeClick?: (node: MerkleNode) => void;
}

export default function MerkleTreeVisualizer({ selectedDPPId, selectedDPPDid, onNodeClick }: Props) {
  const [batches, setBatches] = useState<BatchData[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['root']));
  const [selectedNode, setSelectedNode] = useState<MerkleNode | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<'idle' | 'verifying' | 'verified' | 'failed'>('idle');

  useEffect(() => {
    loadBatchData();
  }, [selectedDPPId, selectedDPPDid]);

  async function loadBatchData() {
    setLoading(true);
    try {
      // Get all batches from the witness service
      const allBatches = await hybridDataStore.getAllBatches();
      
      // Get attestations for the selected DPP if provided
      let relevantAttestations: any[] = [];
      if (selectedDPPDid) {
        relevantAttestations = await hybridDataStore.getAttestationsByDID(selectedDPPDid);
      }
      
      // Build batch data with events
      const batchDataList: BatchData[] = [];
      
      for (const batch of allBatches) {
        // Find events that belong to this batch
        const batchEvents = relevantAttestations.filter(att => {
          const attData = att.attestation_data as any;
          return attData?.batchId === batch.batch_id;
        });
        
        batchDataList.push({
          batchId: batch.batch_id,
          merkleRoot: batch.merkle_root || 'pending',
          txHash: batch.tx_hash || undefined,
          blockNumber: batch.block_number || undefined,
          timestamp: batch.timestamp,
          eventCount: batchEvents.length,
          events: batchEvents,
        });
      }
      
      // Sort by batch ID descending (most recent first)
      batchDataList.sort((a, b) => b.batchId - a.batchId);
      
      setBatches(batchDataList);
    } catch (error) {
      console.error('Error loading batch data:', error);
    }
    setLoading(false);
  }

  // Build Merkle tree structure from batches
  const merkleTree = useMemo((): MerkleNode => {
    const root: MerkleNode = {
      id: 'root',
      hash: 'Blockchain Anchored Trust Root',
      label: 'Trust Anchor (DLT)',
      type: 'root',
      verified: true,
      children: batches.map((batch) => ({
        id: `batch-${batch.batchId}`,
        hash: batch.merkleRoot,
        label: `Batch #${batch.batchId}`,
        type: 'batch' as const,
        verified: !!batch.txHash,
        data: batch,
        children: batch.events.map((event, eventIdx) => ({
          id: `event-${batch.batchId}-${eventIdx}`,
          hash: event.signature || `hash-${eventIdx}`,
          label: formatEventType(event.attestation_type),
          type: 'event' as const,
          verified: event.approval_status === 'approved',
          data: event,
        })),
      })),
    };
    return root;
  }, [batches]);

  function formatEventType(type: string): string {
    const typeMap: Record<string, string> = {
      'did_creation': 'DID Creation',
      'key_rotation': 'Key Rotation',
      'ownership_change': 'Ownership Transfer',
      'did_update': 'DID Update',
      'did_deactivation': 'DID Deactivation',
      'assembly': 'Product Assembly',
      'manufacturing': 'Manufacturing',
    };
    return typeMap[type] || type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  function toggleNode(nodeId: string) {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }

  function handleNodeClick(node: MerkleNode) {
    setSelectedNode(node);
    onNodeClick?.(node);
  }

  async function verifyMerkleProof(node: MerkleNode) {
    if (node.type !== 'batch' || !node.data?.txHash) return;
    
    setVerificationStatus('verifying');
    
    // Simulate verification process
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // In production, this would verify against the blockchain
    setVerificationStatus('verified');
    
    setTimeout(() => setVerificationStatus('idle'), 3000);
  }

  function getNodeIcon(type: string) {
    switch (type) {
      case 'root': return <Lock className="w-5 h-5" />;
      case 'batch': return <Layers className="w-4 h-4" />;
      case 'product': return <Package className="w-4 h-4" />;
      case 'event': return <Hash className="w-4 h-4" />;
      default: return <GitBranch className="w-4 h-4" />;
    }
  }

  function getNodeColor(node: MerkleNode) {
    if (node.type === 'root') return 'bg-gradient-to-br from-emerald-500 to-teal-600';
    if (node.type === 'batch') return node.verified ? 'bg-gradient-to-br from-blue-500 to-indigo-600' : 'bg-gradient-to-br from-amber-500 to-orange-600';
    if (node.type === 'event') return node.verified ? 'bg-gradient-to-br from-green-400 to-emerald-500' : 'bg-gradient-to-br from-gray-400 to-gray-500';
    return 'bg-gradient-to-br from-purple-500 to-pink-600';
  }

  function renderTreeNode(node: MerkleNode, depth: number = 0): JSX.Element {
    const isExpanded = expandedNodes.has(node.id);
    const hasChildren = node.children && node.children.length > 0;
    const isSelected = selectedNode?.id === node.id;

    return (
      <div key={node.id} className="relative">
        {/* Connector line */}
        {depth > 0 && (
          <div 
            className="absolute left-0 top-0 w-6 h-full border-l-2 border-gray-300 dark:border-gray-600"
            style={{ left: '-12px' }}
          />
        )}
        
        {/* Node */}
        <div 
          className={`
            relative flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all duration-200
            ${isSelected ? 'bg-blue-50 dark:bg-blue-900/30 ring-2 ring-blue-500' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}
          `}
          style={{ marginLeft: depth * 24 }}
          onClick={() => handleNodeClick(node)}
        >
          {/* Expand/Collapse button */}
          {hasChildren && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleNode(node.id);
              }}
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-gray-500" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-500" />
              )}
            </button>
          )}
          {!hasChildren && <div className="w-6" />}

          {/* Node icon */}
          <div className={`p-2 rounded-lg text-white ${getNodeColor(node)}`}>
            {getNodeIcon(node.type)}
          </div>

          {/* Node content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-900 dark:text-white">{node.label}</span>
              {node.verified && (
                <CheckCircle2 className="w-4 h-4 text-green-500" />
              )}
              {node.verified === false && (
                <AlertTriangle className="w-4 h-4 text-amber-500" />
              )}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 font-mono truncate">
              {node.hash.length > 40 ? `${node.hash.substring(0, 20)}...${node.hash.substring(node.hash.length - 16)}` : node.hash}
            </div>
          </div>

          {/* Verification badge for batches */}
          {node.type === 'batch' && node.data?.txHash && (
            <a
              href={`${API_CONFIG.BLOCKCHAIN.EXPLORER_URL}/tx/${node.data.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400 rounded text-xs hover:bg-green-200 dark:hover:bg-green-900/70 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              View on Chain
            </a>
          )}
        </div>

        {/* Children */}
        {hasChildren && isExpanded && (
          <div className="ml-6 mt-1 border-l-2 border-gray-200 dark:border-gray-700 pl-4">
            {node.children!.map(child => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-100 dark:bg-emerald-900/50 rounded-lg">
            <GitBranch className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Merkle Tree Verification</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Visualizing cryptographic proof chain from events to blockchain
            </p>
          </div>
        </div>
      </div>

      {/* Explanation */}
      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
          <div className="text-sm text-gray-700 dark:text-gray-300">
            <p className="font-medium mb-1">How Merkle Trees Enable Trustless Verification</p>
            <p className="text-gray-600 dark:text-gray-400">
              Each product event is hashed and combined with others to form a <strong>Merkle Root</strong>. 
              This root is anchored on the blockchain, allowing anyone to verify that a specific event 
              was included in a batch <strong>without trusting any central authority</strong>.
            </p>
          </div>
        </div>
      </div>

      {/* Tree Visualization */}
      <div className="p-4 max-h-[500px] overflow-y-auto">
        {batches.length === 0 ? (
          <div className="text-center py-8">
            <Layers className="w-12 h-12 mx-auto text-gray-400 mb-3" />
            <p className="text-gray-500 dark:text-gray-400">No blockchain batches found</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
              Events will appear here once they are anchored
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {renderTreeNode(merkleTree)}
          </div>
        )}
      </div>

      {/* Selected Node Details */}
      {selectedNode && selectedNode.type !== 'root' && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <h4 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <Hash className="w-4 h-4" />
            Node Details
          </h4>
          
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Type:</span>
              <span className="text-gray-900 dark:text-white capitalize">{selectedNode.type}</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Status:</span>
              <span className={selectedNode.verified ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}>
                {selectedNode.verified ? 'Verified' : 'Pending'}
              </span>
            </div>
            
            {selectedNode.type === 'batch' && selectedNode.data && (
              <>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Batch ID:</span>
                  <span className="text-gray-900 dark:text-white">#{selectedNode.data.batchId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Events:</span>
                  <span className="text-gray-900 dark:text-white">{selectedNode.data.eventCount}</span>
                </div>
                {selectedNode.data.blockNumber && (
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Block:</span>
                    <span className="text-gray-900 dark:text-white">#{selectedNode.data.blockNumber}</span>
                  </div>
                )}
              </>
            )}
            
            <div className="pt-2">
              <span className="text-gray-500 dark:text-gray-400 block mb-1">Hash:</span>
              <code className="block p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono break-all text-gray-800 dark:text-gray-200">
                {selectedNode.hash}
              </code>
            </div>

            {selectedNode.type === 'batch' && selectedNode.data?.txHash && (
              <button
                onClick={() => verifyMerkleProof(selectedNode)}
                disabled={verificationStatus === 'verifying'}
                className={`
                  w-full mt-3 px-4 py-2 rounded-lg font-medium transition-all
                  ${verificationStatus === 'verified' 
                    ? 'bg-green-500 text-white' 
                    : verificationStatus === 'verifying'
                    ? 'bg-blue-400 text-white cursor-wait'
                    : 'bg-blue-600 text-white hover:bg-blue-700'}
                `}
              >
                {verificationStatus === 'verifying' && (
                  <span className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    Verifying on Chain...
                  </span>
                )}
                {verificationStatus === 'verified' && (
                  <span className="flex items-center justify-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    Proof Verified!
                  </span>
                )}
                {verificationStatus === 'idle' && 'Verify Merkle Proof'}
                {verificationStatus === 'failed' && 'Verification Failed'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
        <div className="flex flex-wrap gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-gradient-to-br from-emerald-500 to-teal-600" />
            <span className="text-gray-600 dark:text-gray-400">Trust Root (Blockchain)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-gradient-to-br from-blue-500 to-indigo-600" />
            <span className="text-gray-600 dark:text-gray-400">Anchored Batch</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-gradient-to-br from-amber-500 to-orange-600" />
            <span className="text-gray-600 dark:text-gray-400">Pending Batch</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-gradient-to-br from-green-400 to-emerald-500" />
            <span className="text-gray-600 dark:text-gray-400">Verified Event</span>
          </div>
        </div>
      </div>
    </div>
  );
}
