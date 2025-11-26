import { useEffect, useState } from 'react';
import { Clock, FileText, Shield, Link2, CheckCircle2, AlertCircle, ChevronDown, ChevronUp, Search, Filter } from 'lucide-react';
import { enhancedDB } from '../lib/data/enhancedDataStore';
import type { AnchoringEvent, WitnessAttestation } from '../lib/data/localData';

interface DIDEvent {
  id: string;
  timestamp: string;
  type: 'creation' | 'update' | 'attestation' | 'anchoring' | 'verification';
  did: string;
  description: string;
  details: any;
  icon: any;
  color: string;
}

export default function DIDEventsLog({ did }: { did: string }) {
  const [events, setEvents] = useState<DIDEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'creation' | 'update' | 'attestation' | 'anchoring' | 'verification'>('all');

  useEffect(() => {
    console.log('DIDEventsLog: useEffect triggered, loading events...');
    loadEvents();
  }, [did]);

  async function loadEvents() {
    console.log('DIDEventsLog: Loading events for DID:', did);
    setLoading(true);
    const allEvents: DIDEvent[] = [];

    // Get DPP
    const dpp = await enhancedDB.getDPPByDID(did);
    console.log('DIDEventsLog: DPP found:', dpp);
    if (!dpp) {
      console.warn('DIDEventsLog: No DPP found for DID:', did);
      setLoading(false);
      return;
    }

    // DPP Creation Event
    allEvents.push({
      id: `creation-${dpp.id}`,
      timestamp: dpp.created_at,
      type: 'creation',
      did: dpp.did,
      description: String('DPP Created'),
      details: {
        type: dpp.type,
        model: dpp.model,
        owner: dpp.owner,
      },
      icon: FileText,
      color: 'blue',
    });

    // Anchoring Events
    const anchorings = await enhancedDB.getAnchoringEventsByDID(did);
    console.log('DIDEventsLog: Anchoring events found:', anchorings.length);
    anchorings.forEach((anchor: AnchoringEvent) => {
      allEvents.push({
        id: `anchor-${anchor.id}`,
        timestamp: anchor.timestamp,
        type: 'anchoring',
        did: anchor.did,
        description: `Anchored to DLT (${anchor.anchor_type})`,
        details: {
          transactionHash: anchor.transaction_hash,
          blockNumber: anchor.block_number,
          merkleRoot: anchor.merkle_root,
          network: anchor.metadata?.network || 'ethereum',
        },
        icon: Link2,
        color: 'purple',
      });
    });

    // Attestations - separate DID events from lifecycle events
    const attestations = await enhancedDB.getAttestationsByDID(did);
    console.log('DIDEventsLog: Attestations found:', attestations.length, attestations);
    attestations.forEach((attestation: WitnessAttestation) => {
      // DID-related witness events (what witnesses actually monitor)
      const didEventTypes = ['did_creation', 'key_rotation', 'ownership_change', 'did_update', 'did_lifecycle_update'];
      const isDIDEvent = didEventTypes.includes(attestation.attestation_type);
      
      // Skip pending DID events - they should only appear after witness approval
      if (isDIDEvent && attestation.approval_status === 'pending') {
        return;
      }
      
      // Skip rejected DID events
      if (isDIDEvent && attestation.approval_status === 'rejected') {
        return;
      }
      
      // Product lifecycle events (separate from witness attestations)
      const lifecycleEventTypes = ['assembly', 'installation', 'maintenance', 'disposal', 'manufacturing'];
      const isLifecycleEvent = lifecycleEventTypes.includes(attestation.attestation_type);
      
      // Use attestation_data.timestamp if available, otherwise use attestation.timestamp
      const eventTimestamp = (attestation.attestation_data as any)?.timestamp || attestation.timestamp;
      
      let description = '';
      let eventType: 'attestation' | 'update' = 'attestation';
      let color = 'green';
      
      if (isDIDEvent) {
        // These are witness attestations of DID operations
        const eventNames: Record<string, string> = {
          'did_creation': 'DID Created & Registered',
          'key_rotation': 'Cryptographic Key Rotated',
          'ownership_change': 'Ownership Transferred',
          'did_update': 'DID Document Updated',
          'did_lifecycle_update': 'DID Lifecycle Stage Change'
        };
        description = eventNames[attestation.attestation_type] || attestation.attestation_type;
        color = 'green'; // Witness events are green
      } else if (isLifecycleEvent) {
        // These are product lifecycle events (not DID events)
        description = `Product Lifecycle: ${attestation.attestation_type.charAt(0).toUpperCase() + attestation.attestation_type.slice(1)}`;
        eventType = 'update';
        color = 'blue'; // Lifecycle events are blue
      } else {
        // Fallback for any other attestation types
        description = `Event: ${attestation.attestation_type.replace(/_/g, ' ')}`;
      }
      
      allEvents.push({
        id: `attestation-${attestation.id}`,
        timestamp: eventTimestamp,
        type: eventType,
        did: attestation.did,
        description: description,
        details: {
          witness: attestation.witness_did,
          eventType: (attestation.attestation_data as any)?.eventType || attestation.attestation_type,
          data: attestation.attestation_data,
          signature: attestation.signature,
          isDIDEvent: isDIDEvent,
          isLifecycleEvent: isLifecycleEvent,
        },
        icon: Shield,
        color: color,
      });
    });

    // DID Document Verification Events
    const didDoc = await enhancedDB.getDIDDocumentByDID(did);
    if (didDoc) {
      allEvents.push({
        id: `verification-${didDoc.id}`,
        timestamp: didDoc.created_at,
        type: 'verification',
        did: didDoc.did,
        description: 'DID Document Verified',
        details: {
          controller: didDoc.controller,
          verificationMethods: didDoc.verification_method.length,
          proof: didDoc.proof,
        },
        icon: CheckCircle2,
        color: 'emerald',
      });
    }

    console.log('DIDEventsLog: Total events collected:', allEvents.length);
    // Sort by timestamp ascending (oldest first)
    allEvents.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    setEvents(allEvents);
    setLoading(false);
  }

  const getFilteredEvents = () => {
    return events.filter(event => {
      const matchesSearch = searchTerm === '' || 
        event.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        event.did.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = filterType === 'all' || event.type === filterType;
      return matchesSearch && matchesType;
    });
  };

  const filteredEvents = getFilteredEvents();

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">Event Timeline</h3>
          <span className="ml-2 text-sm text-gray-500">{filteredEvents.length} events</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search events..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white cursor-pointer"
          >
            <option value="all">All Types</option>
            <option value="creation">Creation</option>
            <option value="update">Updates</option>
            <option value="attestation">Attestations</option>
            <option value="anchoring">Anchoring</option>
            <option value="verification">Verification</option>
          </select>
        </div>
      </div>

      <div className="space-y-4">
        {filteredEvents.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <AlertCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
            No events found for this DID
          </div>
        ) : (
          <div className="relative">
            {/* Vertical timeline line */}
            <div className="absolute left-1/2 transform -translate-x-1/2 h-full w-1 bg-gradient-to-b from-blue-200 via-purple-200 to-green-200"></div>
            
            {/* Events */}
            <div className="space-y-8">
              {filteredEvents.map((event, index) => {
                const IconComponent = event.icon;
                const colorClasses = {
                  blue: 'bg-blue-500 border-blue-200',
                  purple: 'bg-purple-500 border-purple-200',
                  green: 'bg-green-500 border-green-200',
                  emerald: 'bg-emerald-500 border-emerald-200',
                }[event.color];
                
                const isLeft = index % 2 === 0;

                return (
                  <div key={event.id} className={`flex items-center ${isLeft ? 'flex-row' : 'flex-row-reverse'}`}>
                    {/* Content card */}
                    <div className={`w-5/12 ${isLeft ? 'pr-8 text-right' : 'pl-8 text-left'}`}>
                      <div 
                        className="bg-white rounded-lg shadow-md border-2 border-gray-200 p-4 hover:shadow-lg transition-all cursor-pointer"
                        onClick={() => setExpandedEvent(expandedEvent === event.id ? null : event.id)}
                      >
                        <div className={`flex items-start gap-3 ${isLeft ? 'flex-row-reverse' : 'flex-row'}`}>
                          <div className={`flex-shrink-0 w-10 h-10 rounded-full ${colorClasses} flex items-center justify-center shadow-md border-4 border-white`}>
                            <IconComponent className="w-5 h-5 text-white" />
                          </div>
                          <div className="flex-grow min-w-0">
                            <div className="flex items-center justify-between">
                              <h4 className="font-semibold text-gray-900 text-sm mb-1">{event.description.trim()}</h4>
                              {expandedEvent === event.id ? (
                                <ChevronUp className="w-4 h-4 text-gray-400" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-gray-400" />
                              )}
                            </div>
                            <p className="text-xs text-gray-500 mb-2">
                              {new Date(event.timestamp).toLocaleString()}
                            </p>
                            <p className="text-xs text-gray-600 font-mono break-all">{event.did}</p>
                          </div>
                        </div>
                        
                        {/* Collapsed view - show minimal info */}
                        {expandedEvent !== event.id && (
                          <div className="mt-3 text-xs text-gray-700">
                            {event.type === 'creation' && (
                              <p><span className="font-medium">Type:</span> {event.details.type} • <span className="font-medium">Model:</span> {event.details.model}</p>
                            )}
                            {event.type === 'anchoring' && (
                              <p><span className="font-medium">Network:</span> {event.details.network} • <span className="font-medium">Block:</span> {event.details.blockNumber}</p>
                            )}
                            {event.type === 'attestation' && (
                              <div>
                                <p className="mb-1"><span className="font-medium">Witness Node:</span> {event.details.witness.split(':').pop()}</p>
                                {event.details.isDIDEvent && (
                                  <div className="mt-2 px-2 py-1 bg-green-50 border border-green-200 rounded text-green-800 font-medium">
                                    ✓ DID Event - Monitored by Witnesses
                                  </div>
                                )}
                              </div>
                            )}
                            {event.type === 'update' && event.details.isLifecycleEvent && (
                              <div>
                                <div className="mt-2 px-2 py-1 bg-blue-50 border border-blue-200 rounded text-blue-800 text-xs">
                                  Product Lifecycle Event (not a DID event)
                                </div>
                              </div>
                            )}
                            {event.type === 'verification' && (
                              <p><span className="font-medium">Verification Methods:</span> {event.details.verificationMethods}</p>
                            )}
                          </div>
                        )}
                        
                        {/* Expanded view - show all details */}
                        {expandedEvent === event.id && (
                          <div className="mt-4 pt-4 border-t border-gray-200">
                            <div className="text-xs font-semibold text-gray-600 mb-2">Full Event Details:</div>
                            <div className="space-y-2 text-xs">
                              {Object.entries(event.details)
                                .filter(([key]) => {
                                  // Hide witness, isDIDEvent, and isLifecycleEvent for lifecycle events
                                  if (event.type === 'update' && event.details.isLifecycleEvent) {
                                    return !['witness', 'isDIDEvent', 'isLifecycleEvent', 'signature'].includes(key);
                                  }
                                  // Hide internal flags for all events
                                  return !['isDIDEvent', 'isLifecycleEvent'].includes(key);
                                })
                                .map(([key, value]) => (
                                  <div key={key} className="flex justify-between items-start gap-2">
                                    <span className="text-gray-600 font-medium capitalize min-w-fit">
                                      {key.replace(/([A-Z])/g, ' $1').trim()}:
                                    </span>
                                    <span className="text-gray-900 font-mono break-all text-right">
                                      {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                                    </span>
                                  </div>
                                ))}
                            </div>
                            
                            <div className="mt-3 pt-3 border-t border-gray-100">
                              <p className="text-xs text-gray-500 italic">Click to collapse details</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Center dot on timeline */}
                    <div className="w-2/12 flex justify-center relative z-10">
                      <div className={`w-6 h-6 rounded-full ${colorClasses} border-4 border-white shadow-lg`}></div>
                    </div>
                    
                    {/* Empty space on other side */}
                    <div className="w-5/12"></div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
