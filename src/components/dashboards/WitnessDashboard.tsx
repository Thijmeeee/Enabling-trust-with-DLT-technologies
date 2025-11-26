import { useState, useEffect } from 'react';
import { FileCheck, CheckCircle, XCircle, Clock, Shield, Activity, Search, Filter as FilterIcon, X, ChevronDown, ChevronUp, Square, Maximize, Package, User, ArrowRight, Key, RefreshCw, FileText, Edit } from 'lucide-react';
import { enhancedDB } from '../../lib/data/enhancedDataStore';
import { useRole } from '../../lib/utils/roleContext';

interface PendingDIDEvent {
  id: string;
  did: string;
  eventType: string;
  timestamp: string;
  description: string;
  data: any;
  status: 'pending' | 'approved' | 'rejected';
  productModel?: string;
  productType?: 'main' | 'component';
  dppId?: string;
  dppMetadata?: any;
}

interface GroupedEvents {
  dppId: string;
  dppName: string;
  dppType: 'main' | 'component';
  did: string;
  events: PendingDIDEvent[];
  componentType?: string; // 'glass' | 'frame' | 'window'
  components?: Array<{
    name: string;
    events: PendingDIDEvent[];
  }>;
}

export default function WitnessDashboard() {
  const { currentRoleDID } = useRole();
  const [pendingEvents, setPendingEvents] = useState<PendingDIDEvent[]>([]);
  const [approvedEvents, setApprovedEvents] = useState<PendingDIDEvent[]>([]);
  const [rejectedEvents, setRejectedEvents] = useState<PendingDIDEvent[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [selectedEvent, setSelectedEvent] = useState<PendingDIDEvent | null>(null);
  const [expandedDPP, setExpandedDPP] = useState<string | null>(null);
  const [expandedComponents, setExpandedComponents] = useState<Set<string>>(new Set());
  
  // Confirmation modal states
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'approve' | 'reject' | null>(null);
  const [eventToConfirm, setEventToConfirm] = useState<PendingDIDEvent | null>(null);
  
  // Filter states
  const [searchText, setSearchText] = useState('');
  const [productTypeFilter, setProductTypeFilter] = useState<'all' | 'window' | 'glass' | 'frame'>('all');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [processedFilter, setProcessedFilter] = useState<'all' | 'processed' | 'unprocessed'>('all');

  useEffect(() => {
    loadEvents();
    const interval = setInterval(loadEvents, 5000);
    return () => clearInterval(interval);
  }, []);

  async function loadEvents() {
    // Get all DPPs and their attestations
    const allDPPs = await enhancedDB.getAllDPPs();
    
    // Build parent-child relationships
    const dppMap = new Map(allDPPs.map(dpp => [dpp.id, dpp]));
    const didToDppMap = new Map(allDPPs.map(dpp => [dpp.did, dpp])); // DID -> DPP mapping
    const parentMap = new Map<string, string>(); // child DPP ID -> parent DPP ID
    
    for (const dpp of allDPPs) {
      // Check both parent_did (DID string) and metadata.parent_dpp_id (numeric ID)
      if (dpp.type === 'component') {
        if (dpp.parent_did) {
          // parent_did is a DID string, need to find the DPP with that DID
          const parentDpp = didToDppMap.get(dpp.parent_did);
          if (parentDpp) {
            parentMap.set(dpp.id, parentDpp.id);
            console.log('Component found:', dpp.model, 'Parent:', parentDpp.model, 'Parent ID:', parentDpp.id);
          }
        } else if (dpp.metadata?.parent_dpp_id) {
          parentMap.set(dpp.id, String(dpp.metadata.parent_dpp_id));
          console.log('Component found (metadata):', dpp.model, 'Parent ID:', dpp.metadata.parent_dpp_id);
        }
      }
    }
    
    console.log('Parent Map:', Array.from(parentMap.entries()));
    
    // Filter for DID events only
    const didEventTypes = ['did_creation', 'key_rotation', 'ownership_change', 'did_update', 'did_lifecycle_update'];
    
    const events: PendingDIDEvent[] = [];
    const approved: PendingDIDEvent[] = [];
    const rejected: PendingDIDEvent[] = [];

    // Track unique events by attestation ID to avoid duplicates
    const eventMap = new Map<string, PendingDIDEvent>();

    for (const dpp of allDPPs) {
      const attestations = await enhancedDB.getAttestationsByDID(dpp.did);
      
      for (const att of attestations) {
        if (!didEventTypes.includes(att.attestation_type)) continue;

        // Determine status based on approval_status field
        let status: 'pending' | 'approved' | 'rejected' = 'pending';
        if (att.approval_status === 'approved') {
          status = 'approved';
        } else if (att.approval_status === 'rejected') {
          status = 'rejected';
        } else if (att.approval_status === 'pending') {
          status = 'pending';
        } else {
          // Legacy: fallback to signature-based detection for old attestations
          if (att.witness_did === currentRoleDID) {
            if (att.signature.startsWith('witness-reject-')) {
              status = 'rejected';
            } else if (att.signature.startsWith('witness-sig-')) {
              status = 'approved';
            }
          }
        }
        
        // Determine the grouping DPP (parent for components, self for main products)
        let groupDppId = dpp.id;
        let groupDppModel = dpp.model;
        
        if (dpp.type === 'component' && parentMap.has(dpp.id)) {
          const parentId = parentMap.get(dpp.id)!;
          const parentDpp = dppMap.get(parentId);
          if (parentDpp) {
            groupDppId = parentDpp.id;
            groupDppModel = parentDpp.model;
            console.log('Grouping component', dpp.model, 'under parent', parentDpp.model, 'Parent ID:', groupDppId);
          }
        }
        
        console.log('Event for', dpp.model, '- Type:', dpp.type, '- GroupDppId:', groupDppId, '- isComponent:', dpp.type === 'component');
        
        // Store DPP reference for later filtering
        const event: PendingDIDEvent = {
          id: att.id,
          did: att.did,
          eventType: att.attestation_type,
          timestamp: att.timestamp,
          description: att.attestation_type.replace(/_/g, ' ').toUpperCase(),
          data: att.attestation_data,
          status: status,
          productModel: dpp.model, // Keep original component name
          productType: dpp.type,
          dppId: groupDppId, // Group by parent
          dppMetadata: { 
            ...dpp.metadata,
            groupModel: groupDppModel, // Store parent name for display
            isComponent: dpp.type === 'component',
            groupDppDid: dpp.type === 'component' && parentMap.has(dpp.id) 
              ? dppMap.get(parentMap.get(dpp.id)!)?.did 
              : dpp.did, // Store parent DID for components, own DID for windows
          },
        };

        eventMap.set(att.id, event);
      }
    }

    // Convert map to arrays
    for (const event of eventMap.values()) {
      if (event.status === 'approved') {
        approved.push(event);
      } else if (event.status === 'rejected') {
        rejected.push(event);
      } else {
        events.push(event);
      }
    }

    setPendingEvents(events);
    setApprovedEvents(approved);
    setRejectedEvents(rejected);
  }

  async function handleApprove(event: PendingDIDEvent) {
    // Update attestation status to approved
    await enhancedDB.updateAttestation(event.id, {
      approval_status: 'approved',
      signature: `witness-sig-${Date.now()}`,
      witness_did: currentRoleDID,
    });

    // If this is an ownership change, now actually update the owner
    if (event.eventType === 'ownership_change') {
      const newOwner = event.data?.newOwner || event.data?.new_owner;
      const previousOwner = event.data?.previousOwner || event.data?.old_owner;
      
      if (newOwner && event.dppId) {
        await enhancedDB.updateDPP(event.dppId, {
          owner: newOwner,
          metadata: {
            ...event.dppMetadata,
            previousOwner: previousOwner,
            ownershipTransferredAt: new Date().toISOString(),
            pendingOwnershipTransfer: undefined, // Clear pending transfer
          }
        });
      }
    }

    await loadEvents();
    setShowConfirmModal(false);
    setEventToConfirm(null);
    setConfirmAction(null);
  }

  async function handleReject(event: PendingDIDEvent) {
    // Update attestation status to rejected
    await enhancedDB.updateAttestation(event.id, {
      approval_status: 'rejected',
      signature: `witness-reject-${Date.now()}`,
      witness_did: currentRoleDID,
    });

    // If this is an ownership change, clear the pending transfer
    if (event.eventType === 'ownership_change' && event.dppId) {
      const dpp = await enhancedDB.getDPPById(event.dppId);
      if (dpp && dpp.metadata?.pendingOwnershipTransfer) {
        await enhancedDB.updateDPP(event.dppId, {
          metadata: {
            ...dpp.metadata,
            pendingOwnershipTransfer: undefined, // Clear pending transfer
          }
        });
      }
    }

    await loadEvents();
    setShowConfirmModal(false);
    setEventToConfirm(null);
    setConfirmAction(null);
  }

  function openConfirmModal(event: PendingDIDEvent, action: 'approve' | 'reject') {
    setEventToConfirm(event);
    setConfirmAction(action);
    setShowConfirmModal(true);
  }

  function handleConfirm() {
    if (!eventToConfirm || !confirmAction) return;
    
    if (confirmAction === 'approve') {
      handleApprove(eventToConfirm);
    } else {
      handleReject(eventToConfirm);
    }
  }

  const getFilteredEvents = () => {
    switch (filter) {
      case 'pending':
        return pendingEvents;
      case 'approved':
        return approvedEvents;
      case 'rejected':
        return rejectedEvents;
      default:
        return [...pendingEvents, ...approvedEvents, ...rejectedEvents];
    }
  };

  const filteredEvents = getFilteredEvents();

  // Groepeer events per DPP met filters - ALLEEN parent/main DPPs als hoofdgroepen
  const groupedEvents = () => {
    const groups = new Map<string, GroupedEvents>();
    
    console.log('=== GROUPING EVENTS ===');
    console.log('Total filtered events:', filteredEvents.length);
    
    filteredEvents.forEach((event: any) => {
      // Gebruik altijd dppId als groepsleutel (voor components is dit de parent ID)
      const groupKey = event.dppId;
      
      console.log('Processing event:', event.productModel, '- GroupKey:', groupKey, '- isComponent:', event.dppMetadata?.isComponent);
      
      // Apply processed filter
      if (filter === 'all' && processedFilter !== 'all') {
        const isProcessed = event.status === 'approved' || event.status === 'rejected';
        if (processedFilter === 'processed' && !isProcessed) return;
        if (processedFilter === 'unprocessed' && isProcessed) return;
      }
      
      // Apply search filter
      if (searchText) {
        const searchLower = searchText.toLowerCase();
        const matchesSearch = 
          event.productModel?.toLowerCase().includes(searchLower) ||
          event.did.toLowerCase().includes(searchLower) ||
          event.description.toLowerCase().includes(searchLower) ||
          event.dppMetadata?.groupModel?.toLowerCase().includes(searchLower);
        
        if (!matchesSearch) return;
      }
      
      // Bepaal component type voor filtering
      let componentType = 'window';
      if (event.dppMetadata?.isComponent) {
        const meta = event.dppMetadata as any;
        if (meta.componentType === 'glass' || event.productModel?.toLowerCase().includes('glass')) {
          componentType = 'glass';
        } else if (meta.componentType === 'frame' || event.productModel?.toLowerCase().includes('frame')) {
          componentType = 'frame';
        }
      }
      
      // Apply product type filter
      if (productTypeFilter !== 'all' && productTypeFilter !== componentType) {
        return;
      }
      
      // Create group if it doesn't exist (using parent/main DPP ID as key)
      if (!groups.has(groupKey)) {
        // Use groupModel for the group name (this is the parent name for components)
        const groupName = event.dppMetadata?.groupModel || event.productModel || 'Unknown Product';
        const groupDid = event.dppMetadata?.groupDppDid || event.did; // Use parent DID if available
        groups.set(groupKey, {
          dppId: groupKey,
          dppName: groupName,
          dppType: 'main',
          did: groupDid,
          componentType: 'window',
          events: [],
          components: [],
        });
      }
      
      const group = groups.get(groupKey)!;
      
      // If this is a component event, add to components array
      if (event.dppMetadata?.isComponent) {
        const componentName = event.productModel || 'Unknown Component';
        let componentGroup = group.components!.find(c => c.name === componentName);
        if (!componentGroup) {
          componentGroup = { name: componentName, events: [] };
          group.components!.push(componentGroup);
        }
        componentGroup.events.push(event);
        console.log('  → Added to components array of group:', group.dppName);
      } else {
        // Main product event
        group.events.push(event);
        console.log('  → Added as main product event to group:', group.dppName);
      }
    });
    
    console.log('=== FINAL GROUPS ===');
    console.log('Total groups:', groups.size);
    Array.from(groups.values()).forEach(g => {
      console.log('Group:', g.dppName, '(ID: ' + g.dppId + ') - Main events:', g.events.length, '- Components:', g.components?.length || 0);
      g.components?.forEach(c => console.log('  Component:', c.name, '- Events:', c.events.length));
    });
    
    // Filter to show only window groups (main products with components)
    const validGroups = Array.from(groups.values()).filter(group => {
      // Only show groups that are windows (main products)
      const isWindowGroup = group.dppName.toLowerCase().startsWith('window') && 
                           !group.dppName.toLowerCase().includes('frame') && 
                           !group.dppName.toLowerCase().includes('panel');
      
      console.log('Filtering group:', group.dppName, 
        '- isWindow:', isWindowGroup, 
        '- Keep?', isWindowGroup);
      
      return isWindowGroup;
    });
    
    console.log('Valid groups after filtering:', validGroups.length);
    
    return validGroups;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 pt-20">
      <div className="max-w-[1920px] mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-3 bg-emerald-100 rounded-lg">
                  <FileCheck className="w-8 h-8 text-emerald-600" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">Witness Node Dashboard</h1>
                  <p className="text-gray-600">Validate and sign DID events</p>
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500">Your Witness DID</div>
              <div className="text-xs font-mono text-gray-900 mt-1">{currentRoleDID}</div>
            </div>
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <Clock className="w-8 h-8 text-yellow-600" />
              <div>
                <div className="text-2xl font-bold text-gray-900">{pendingEvents.length}</div>
                <div className="text-sm text-gray-600">Pending Events</div>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-8 h-8 text-green-600" />
              <div>
                <div className="text-2xl font-bold text-gray-900">{approvedEvents.length}</div>
                <div className="text-sm text-gray-600">Approved</div>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <XCircle className="w-8 h-8 text-red-600" />
              <div>
                <div className="text-2xl font-bold text-gray-900">{rejectedEvents.length}</div>
                <div className="text-sm text-gray-600">Rejected</div>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <Activity className="w-8 h-8 text-blue-600" />
              <div>
                <div className="text-2xl font-bold text-gray-900">{pendingEvents.length + approvedEvents.length}</div>
                <div className="text-sm text-gray-600">Total Validated</div>
              </div>
            </div>
          </div>
        </div>

        {/* Search and Filter Bar */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
          <div className="flex items-center gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by product name, DID, or event type..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {searchText && (
                <button
                  onClick={() => setSearchText('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
            
            {/* Product Type Filter */}
            <div className="relative">
              <button
                onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <FilterIcon className="w-5 h-5 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">
                  {productTypeFilter === 'all' ? 'All Products' : 
                   productTypeFilter === 'window' ? 'Windows' :
                   productTypeFilter === 'glass' ? 'Glass' : 'Frame'}
                </span>
                <ChevronDown className="w-4 h-4 text-gray-500" />
              </button>
              
              {showFilterDropdown && (
                <div className="absolute top-full left-0 mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden z-10">
                  <button
                    onClick={() => {
                      setProductTypeFilter('all');
                      setShowFilterDropdown(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors ${
                      productTypeFilter === 'all' ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                    }`}
                  >
                    <Package className="w-5 h-5" />
                    <span className="font-medium">All Products</span>
                  </button>
                  <button
                    onClick={() => {
                      setProductTypeFilter('window');
                      setShowFilterDropdown(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors ${
                      productTypeFilter === 'window' ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                    }`}
                  >
                    <Maximize className="w-5 h-5" />
                    <span className="font-medium">Windows Only</span>
                  </button>
                  <button
                    onClick={() => {
                      setProductTypeFilter('glass');
                      setShowFilterDropdown(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors ${
                      productTypeFilter === 'glass' ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                    }`}
                  >
                    <Square className="w-5 h-5" />
                    <span className="font-medium">Glass Only</span>
                  </button>
                  <button
                    onClick={() => {
                      setProductTypeFilter('frame');
                      setShowFilterDropdown(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors ${
                      productTypeFilter === 'frame' ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                    }`}
                  >
                    <Package className="w-5 h-5" />
                    <span className="font-medium">Frame Only</span>
                  </button>
                </div>
              )}
            </div>
            
            {/* Processed Status Filter (only for 'all' tab) */}
            {filter === 'all' && (
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg">
                <button
                  onClick={() => setProcessedFilter('all')}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                    processedFilter === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setProcessedFilter('processed')}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                    processedFilter === 'processed' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Processed
                </button>
                <button
                  onClick={() => setProcessedFilter('unprocessed')}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                    processedFilter === 'unprocessed' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Unprocessed
                </button>
              </div>
            )}
            
            {/* Active Filters Count */}
            {(searchText || productTypeFilter !== 'all' || (filter === 'all' && processedFilter !== 'all')) && (
              <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm">
                <span className="font-medium">
                  {[searchText, productTypeFilter !== 'all', filter === 'all' && processedFilter !== 'all'].filter(Boolean).length} filter{[searchText, productTypeFilter !== 'all', filter === 'all' && processedFilter !== 'all'].filter(Boolean).length !== 1 ? 's' : ''} active
                </span>
                <button
                  onClick={() => {
                    setSearchText('');
                    setProductTypeFilter('all');
                    setProcessedFilter('all');
                  }}
                  className="hover:text-blue-900"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="bg-white rounded-lg border border-gray-200 mb-6">
          <div className="flex border-b border-gray-200">
            {[
              { id: 'pending', label: 'Pending', count: pendingEvents.length, color: 'yellow' },
              { id: 'approved', label: 'Approved', count: approvedEvents.length, color: 'green' },
              { id: 'rejected', label: 'Rejected', count: rejectedEvents.length, color: 'red' },
              { id: 'all', label: 'All Events', count: pendingEvents.length + approvedEvents.length + rejectedEvents.length, color: 'blue' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id as any)}
                className={`flex-1 px-6 py-4 font-medium transition-colors ${
                  filter === tab.id
                    ? 'bg-gray-50 text-gray-900 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                {tab.label} <span className={`ml-2 px-2 py-0.5 text-xs rounded-full bg-${tab.color}-100 text-${tab.color}-700`}>{tab.count}</span>
              </button>
            ))}
          </div>

          {/* Events List - Grouped by DPP */}
          <div className="p-6">
            {groupedEvents().length === 0 ? (
              <div className="text-center py-12">
                <Shield className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No events to display</p>
              </div>
            ) : (
              <div className="space-y-4">
                {groupedEvents().map((group) => {
                  const totalEvents = group.events.length + (group.components?.reduce((sum, c) => sum + c.events.length, 0) || 0);
                  const isExpanded = expandedDPP === group.dppId;
                  
                  return (
                    <div key={group.dppId} className="border border-gray-300 rounded-lg overflow-hidden">
                      {/* Window Header - Clickable */}
                      <div 
                        className="bg-gradient-to-r from-blue-100 to-blue-50 px-4 py-3 cursor-pointer hover:from-blue-200 hover:to-blue-100 transition-colors"
                        onClick={() => setExpandedDPP(isExpanded ? null : group.dppId)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Package className="w-5 h-5 text-blue-600" />
                            <div>
                              <h3 className="font-semibold text-gray-900">{group.dppName}</h3>
                              <p className="text-sm text-gray-600">
                                Main Product • {totalEvents} event{totalEvents !== 1 ? 's' : ''} 
                                {group.components && group.components.length > 0 && ` • ${group.components.length} component${group.components.length !== 1 ? 's' : ''}`}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <p className="text-xs text-gray-500 font-mono">
                              DID: {group.did}
                            </p>
                            {isExpanded ? (
                              <ChevronUp className="w-5 h-5 text-gray-600" />
                            ) : (
                              <ChevronDown className="w-5 h-5 text-gray-600" />
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* Window Content - Collapsible */}
                      {isExpanded && (
                        <>
                          {/* Main Product Events */}
                          {group.events.length > 0 && (
                            <div className="bg-white">
                              {group.events.map((event) => (
                                <div
                                  key={event.id}
                                  className={`border-b border-gray-200 p-4 transition-all ${
                                    event.status === 'pending'
                                      ? 'bg-yellow-50'
                                      : event.status === 'approved'
                                      ? 'bg-green-50'
                                      : 'bg-red-50'
                                  }`}
                                >
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-3 mb-2">
                                        {event.status === 'pending' && <Clock className="w-5 h-5 text-yellow-600" />}
                                        {event.status === 'approved' && <CheckCircle className="w-5 h-5 text-green-600" />}
                                        {event.status === 'rejected' && <XCircle className="w-5 h-5 text-red-600" />}
                                        <div>
                                          <h4 className="font-semibold text-gray-900">{event.description}</h4>
                                          <p className="text-xs text-gray-500">
                                            {new Date(event.timestamp).toLocaleString()}
                                          </p>
                                        </div>
                                      </div>
                                      
                                      {selectedEvent?.id === event.id && (
                                        <div className="mt-3 p-3 bg-white rounded border border-gray-200">
                                          <div className="text-xs font-semibold text-gray-700 mb-2">Event Data:</div>
                                          <pre className="text-xs text-gray-900 overflow-x-auto">{JSON.stringify(event.data, null, 2)}</pre>
                                        </div>
                                      )}
                                    </div>

                                    <div className="flex items-center gap-2 ml-4">
                                      <button
                                        onClick={() => setSelectedEvent(selectedEvent?.id === event.id ? null : event)}
                                        className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded hover:bg-gray-50"
                                      >
                                        {selectedEvent?.id === event.id ? 'Hide' : 'Details'}
                                      </button>
                                      
                                      {event.status === 'pending' && (
                                        <>
                                          <button
                                            onClick={() => openConfirmModal(event, 'approve')}
                                            className="px-3 py-1.5 text-sm text-white bg-green-600 rounded hover:bg-green-700"
                                          >
                                            Approve
                                          </button>
                                          <button
                                            onClick={() => openConfirmModal(event, 'reject')}
                                            className="px-3 py-1.5 text-sm text-white bg-red-600 rounded hover:bg-red-700"
                                          >
                                            Reject
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          
                          {/* Component Sub-DPPs */}
                          {group.components && group.components.map((component) => {
                            const componentKey = `${group.dppId}-${component.name}`;
                            const isComponentExpanded = expandedComponents.has(componentKey);
                            
                            return (
                              <div key={component.name} className="border-t border-gray-300">
                                {/* Component Sub-DPP Header - Clickable */}
                                <div 
                                  className="bg-gradient-to-r from-purple-50 to-purple-100 px-4 py-3 cursor-pointer hover:from-purple-100 hover:to-purple-200 transition-colors"
                                  onClick={() => {
                                    const newExpanded = new Set(expandedComponents);
                                    if (isComponentExpanded) {
                                      newExpanded.delete(componentKey);
                                    } else {
                                      newExpanded.add(componentKey);
                                    }
                                    setExpandedComponents(newExpanded);
                                  }}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                      <Shield className="w-5 h-5 text-purple-600" />
                                      <div>
                                        <h4 className="font-semibold text-purple-900">{component.name}</h4>
                                        <p className="text-xs text-purple-600">
                                          Component • {component.events.length} event{component.events.length !== 1 ? 's' : ''}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <p className="text-xs text-purple-500 font-mono">
                                        DID: {component.events[0]?.did || 'N/A'}
                                      </p>
                                      {isComponentExpanded ? (
                                        <ChevronUp className="w-5 h-5 text-purple-600" />
                                      ) : (
                                        <ChevronDown className="w-5 h-5 text-purple-600" />
                                      )}
                                    </div>
                                  </div>
                                </div>
                                
                                {/* Component Events - Collapsible */}
                                {isComponentExpanded && (
                                  <div className="bg-white">
                                    {component.events.map((event) => (
                                      <div
                                        key={event.id}
                                        className={`border-t border-gray-200 p-4 transition-all ${
                                          event.status === 'pending'
                                            ? 'bg-yellow-50'
                                            : event.status === 'approved'
                                            ? 'bg-green-50'
                                            : 'bg-red-50'
                                        }`}
                                      >
                                        <div className="flex items-start justify-between">
                                          <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-2">
                                              {event.status === 'pending' && <Clock className="w-5 h-5 text-yellow-600" />}
                                              {event.status === 'approved' && <CheckCircle className="w-5 h-5 text-green-600" />}
                                              {event.status === 'rejected' && <XCircle className="w-5 h-5 text-red-600" />}
                                              <div>
                                                <h4 className="font-semibold text-gray-900">{event.description}</h4>
                                                <p className="text-xs text-gray-500">
                                                  {new Date(event.timestamp).toLocaleString()}
                                                </p>
                                              </div>
                                            </div>
                                            
                                            {selectedEvent?.id === event.id && (
                                              <div className="mt-3 p-3 bg-white rounded border border-gray-200">
                                                <div className="text-xs font-semibold text-gray-700 mb-2">Event Data:</div>
                                                <pre className="text-xs text-gray-900 overflow-x-auto">{JSON.stringify(event.data, null, 2)}</pre>
                                              </div>
                                            )}
                                          </div>

                                          <div className="flex items-center gap-2 ml-4">
                                            <button
                                              onClick={() => setSelectedEvent(selectedEvent?.id === event.id ? null : event)}
                                              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded hover:bg-gray-50"
                                            >
                                              {selectedEvent?.id === event.id ? 'Hide' : 'Details'}
                                            </button>
                                            
                                            {event.status === 'pending' && (
                                              <>
                                                <button
                                                  onClick={() => openConfirmModal(event, 'approve')}
                                                  className="px-3 py-1.5 text-sm text-white bg-green-600 rounded hover:bg-green-700"
                                                >
                                                  Approve
                                                </button>
                                                <button
                                                  onClick={() => openConfirmModal(event, 'reject')}
                                                  className="px-3 py-1.5 text-sm text-white bg-red-600 rounded hover:bg-red-700"
                                                >
                                                  Reject
                                                </button>
                                              </>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && eventToConfirm && (() => {
        const eventType = eventToConfirm.eventType;
        const data = eventToConfirm.data;
        
        // Helper function to extract and display DIDs nicely
        const formatDID = (did: string) => {
          if (!did) return { short: 'Unknown', full: 'Unknown' };
          // Show last part after last colon for readability, but show full on hover
          const shortDid = did.split(':').pop() || did;
          return { short: shortDid, full: did };
        };
        
        // Determine visual representation based on event type
        let visualContent = null;
        
        if (eventType === 'ownership_change') {
          const oldOwner = data?.previousOwner || data?.old_owner || 'Unknown';
          const newOwner = data?.newOwner || data?.new_owner || 'Unknown';
          const oldOwnerFormatted = formatDID(oldOwner);
          const newOwnerFormatted = formatDID(newOwner);
          
          visualContent = (
            <div className="py-8">
              <div className="flex items-center justify-center gap-8">
                <div className="text-center flex-1">
                  <div className="w-24 h-24 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <User className="w-12 h-12 text-white" />
                  </div>
                  <div className="bg-white rounded-lg p-4 border-2 border-blue-200">
                    <p className="text-xs font-semibold text-blue-600 mb-2">CURRENT OWNER</p>
                    <p className="text-sm font-bold text-gray-800 mb-2">{oldOwnerFormatted.short}</p>
                    <p className="text-xs font-mono text-gray-500 break-all" title={oldOwnerFormatted.full}>
                      {oldOwnerFormatted.full}
                    </p>
                  </div>
                </div>
                
                <div className="flex flex-col items-center">
                  <ArrowRight className="w-12 h-12 text-green-500 animate-pulse" />
                  <p className="text-xs font-semibold text-gray-600 mt-2">TRANSFER</p>
                </div>
                
                <div className="text-center flex-1">
                  <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <User className="w-12 h-12 text-white" />
                  </div>
                  <div className="bg-white rounded-lg p-4 border-2 border-green-200">
                    <p className="text-xs font-semibold text-green-600 mb-2">NEW OWNER</p>
                    <p className="text-sm font-bold text-gray-800 mb-2">{newOwnerFormatted.short}</p>
                    <p className="text-xs font-mono text-gray-500 break-all" title={newOwnerFormatted.full}>
                      {newOwnerFormatted.full}
                    </p>
                  </div>
                </div>
              </div>
              
              {data?.transferMethod && (
                <div className="mt-6 text-center">
                  <p className="text-sm text-gray-600">
                    Transfer Method: <span className="font-semibold text-gray-800">{data.transferMethod}</span>
                  </p>
                  {data?.blockchainTxHash && (
                    <p className="text-xs text-gray-500 font-mono mt-1">
                      TX: {data.blockchainTxHash.substring(0, 20)}...
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        } else if (eventType === 'key_rotation') {
          const oldKey = data?.old_key || data?.previousKey || 'Unknown';
          const newKey = data?.new_key || data?.newKey || 'Unknown';
          
          visualContent = (
            <div className="py-8">
              <div className="flex items-center justify-center gap-8">
                <div className="text-center flex-1">
                  <div className="w-24 h-24 bg-orange-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <Key className="w-12 h-12 text-white" />
                  </div>
                  <div className="bg-white rounded-lg p-4 border-2 border-orange-200">
                    <p className="text-xs font-semibold text-orange-600 mb-2">OLD KEY</p>
                    <p className="text-xs font-mono text-gray-600 break-all">{oldKey.substring(0, 40)}...</p>
                  </div>
                </div>
                
                <div className="flex flex-col items-center">
                  <RefreshCw className="w-12 h-12 text-green-500 animate-spin" style={{animationDuration: '3s'}} />
                  <p className="text-xs font-semibold text-gray-600 mt-2">ROTATION</p>
                </div>
                
                <div className="text-center flex-1">
                  <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <Key className="w-12 h-12 text-white" />
                  </div>
                  <div className="bg-white rounded-lg p-4 border-2 border-green-200">
                    <p className="text-xs font-semibold text-green-600 mb-2">NEW KEY</p>
                    <p className="text-xs font-mono text-gray-600 break-all">{newKey.substring(0, 40)}...</p>
                  </div>
                </div>
              </div>
              
              {data?.reason && (
                <div className="mt-6 text-center">
                  <p className="text-sm text-gray-600">
                    Reason: <span className="font-semibold text-gray-800">{data.reason}</span>
                  </p>
                </div>
              )}
            </div>
          );
        } else if (eventType === 'did_creation') {
          const didFormatted = formatDID(eventToConfirm.did);
          const controller = data?.controller || data?.owner || 'Unknown';
          const controllerFormatted = formatDID(controller);
          
          visualContent = (
            <div className="py-8">
              <div className="flex flex-col items-center">
                <div className="w-28 h-28 bg-gradient-to-br from-green-400 to-emerald-600 rounded-full flex items-center justify-center mb-4 shadow-xl">
                  <FileText className="w-14 h-14 text-white" />
                </div>
                <p className="text-lg font-bold text-gray-800 mb-2">New DID Created</p>
                <div className="bg-white rounded-lg p-4 border-2 border-green-200 max-w-xl w-full">
                  <p className="text-xs font-semibold text-green-600 mb-2">DID IDENTIFIER</p>
                  <p className="text-sm font-mono text-gray-800 break-all">{didFormatted.full}</p>
                </div>
                
                <div className="mt-6 bg-blue-50 rounded-lg p-4 border border-blue-200 max-w-xl w-full">
                  <div className="flex items-center gap-3">
                    <User className="w-8 h-8 text-blue-600" />
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-blue-600 mb-1">CONTROLLER</p>
                      <p className="text-sm font-mono text-gray-800 break-all">{controllerFormatted.full}</p>
                    </div>
                  </div>
                </div>
                
                {data?.publicKey && (
                  <div className="mt-4 bg-gray-50 rounded-lg p-4 border border-gray-200 max-w-xl w-full">
                    <p className="text-xs font-semibold text-gray-600 mb-2">PUBLIC KEY</p>
                    <p className="text-xs font-mono text-gray-600 break-all">{data.publicKey.substring(0, 60)}...</p>
                  </div>
                )}
              </div>
            </div>
          );
        } else if (eventType === 'did_update' || eventType === 'did_lifecycle_update') {
          const changes = data?.changes || data?.updates || {};
          const lifecycleStatus = data?.status || data?.lifecycle_status;
          
          visualContent = (
            <div className="py-8">
              <div className="flex flex-col items-center">
                <div className="w-28 h-28 bg-gradient-to-br from-blue-400 to-cyan-600 rounded-full flex items-center justify-center mb-4 shadow-xl">
                  <RefreshCw className="w-14 h-14 text-white" />
                </div>
                <p className="text-lg font-bold text-gray-800 mb-2">DID Document Update</p>
                
                {lifecycleStatus && (
                  <div className="mt-4 bg-blue-50 rounded-lg p-4 border-2 border-blue-200 max-w-xl w-full">
                    <p className="text-xs font-semibold text-blue-600 mb-2">LIFECYCLE STATUS</p>
                    <p className="text-2xl font-bold text-blue-700">{lifecycleStatus}</p>
                  </div>
                )}
                
                {Object.keys(changes).length > 0 && (
                  <div className="mt-4 bg-white rounded-lg p-4 border border-gray-200 max-w-xl w-full">
                    <p className="text-xs font-semibold text-gray-600 mb-3">CHANGES</p>
                    <div className="space-y-2">
                      {Object.entries(changes).map(([key, value]) => (
                        <div key={key} className="flex items-center gap-2">
                          <ArrowRight className="w-4 h-4 text-gray-400" />
                          <span className="text-sm font-semibold text-gray-700">{key}:</span>
                          <span className="text-sm text-gray-600">{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        } else {
          // Generic visual for other event types
          visualContent = (
            <div className="py-8">
              <div className="flex flex-col items-center">
                <div className="w-28 h-28 bg-gradient-to-br from-gray-400 to-slate-600 rounded-full flex items-center justify-center mb-4 shadow-xl">
                  <Edit className="w-14 h-14 text-white" />
                </div>
                <p className="text-lg font-bold text-gray-800 mb-2">{eventToConfirm.description}</p>
                <p className="text-sm text-gray-600">DID Event</p>
              </div>
            </div>
          );
        }
        
        return (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[95vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
                <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                  {confirmAction === 'approve' ? (
                    <>
                      <CheckCircle className="w-7 h-7 text-green-600" />
                      Confirm Approval
                    </>
                  ) : (
                    <>
                      <XCircle className="w-7 h-7 text-red-600" />
                      Confirm Rejection
                    </>
                  )}
                </h2>
                <p className="text-sm text-gray-600 mt-1">Review the DID event details before confirming</p>
              </div>
              
              <div className="p-6">
                <div className="mb-6 bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 rounded-xl border border-gray-200">
                  {visualContent}
                </div>
                
                <div className="bg-gray-50 rounded-lg p-5 border border-gray-200">
                  <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    Event Information
                  </h3>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <span className="text-xs font-semibold text-gray-500 uppercase">Event Type</span>
                      <p className="text-sm font-semibold text-gray-900 mt-1">{eventToConfirm.description}</p>
                    </div>
                    
                    <div>
                      <span className="text-xs font-semibold text-gray-500 uppercase">Product</span>
                      <p className="text-sm font-semibold text-gray-900 mt-1">{eventToConfirm.productModel}</p>
                    </div>
                  </div>
                  
                  <div className="mb-4">
                    <span className="text-xs font-semibold text-gray-500 uppercase">DID</span>
                    <p className="text-xs font-mono text-gray-800 break-all mt-1 bg-white p-2 rounded border border-gray-200">{eventToConfirm.did}</p>
                  </div>
                  
                  <div>
                    <span className="text-xs font-semibold text-gray-500 uppercase">Timestamp</span>
                    <p className="text-sm text-gray-900 mt-1">{new Date(eventToConfirm.timestamp).toLocaleString()}</p>
                  </div>
                </div>
                
                <div className={`mt-6 p-4 rounded-lg border-2 ${confirmAction === 'approve' ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'}`}>
                  <div className="flex items-start gap-3">
                    {confirmAction === 'approve' ? (
                      <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className={`text-sm font-bold ${confirmAction === 'approve' ? 'text-green-800' : 'text-red-800'} mb-1`}>
                        {confirmAction === 'approve' ? 'Approval Action' : 'Rejection Action'}
                      </p>
                      <p className={`text-sm ${confirmAction === 'approve' ? 'text-green-700' : 'text-red-700'}`}>
                        {confirmAction === 'approve' 
                          ? 'By confirming, you validate this event as legitimate and sign it with your witness DID. This action cannot be undone.'
                          : 'By confirming, you mark this event as invalid and it will not be accepted in the DID log. This action cannot be undone.'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="p-6 bg-gray-100 rounded-b-lg flex justify-end gap-3 border-t border-gray-200">
                <button
                  onClick={() => {
                    setShowConfirmModal(false);
                    setEventToConfirm(null);
                    setConfirmAction(null);
                  }}
                  className="px-6 py-2.5 text-gray-700 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirm}
                  className={`px-6 py-2.5 text-white rounded-lg font-medium transition-colors shadow-lg ${
                    confirmAction === 'approve'
                      ? 'bg-green-600 hover:bg-green-700'
                      : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {confirmAction === 'approve' ? '✓ Confirm Approval' : '✗ Confirm Rejection'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
