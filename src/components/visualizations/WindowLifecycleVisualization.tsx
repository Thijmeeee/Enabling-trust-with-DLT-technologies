import { useState, lazy, Suspense } from 'react';
import { CheckCircle, Circle, Package, Wrench, Home, Recycle, ArrowRight, UserCircle, ArrowRightLeft, Settings } from 'lucide-react';
import { LifecycleStatusBadge } from '../shared/LifecycleStatusBadge';
import { useRole } from '../../lib/utils/roleContext';

// Lazy load modal to avoid circular dependencies during startup
const LifecycleActionModal = lazy(() => import('../dashboards/LifecycleActionModal').then(m => ({ default: m.LifecycleActionModal })));

interface LifecycleStage {
  id: string;
  title: string;
  description: string;
  status: 'completed' | 'current' | 'future';
  icon: any;
  didEvents?: string[];
  timestamp?: string;
  details?: Record<string, any>;
  owner?: string;
  custodian?: string;
}

export default function WindowLifecycleVisualization({ dpp, events, onUpdate }: {
  dpp: any;
  events: any[];
  onUpdate?: () => void;
}) {
  const [expandedStage, setExpandedStage] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { canSeeField, currentRoleDID } = useRole();

  // Check if product is at end of life (supports both 'disposed' and 'end_of_life' and 'recycled')
  const isEndOfLife = dpp.lifecycle_status === 'disposed' || dpp.lifecycle_status === 'end_of_life' || dpp.lifecycle_status === 'recycled';

  // Calculate progress - if end of life, all 5 stages are complete
  const completedStages = () => {
    if (isEndOfLife) return 5; // All stages completed when recycled

    let count = 0;
    if (dpp.created_at) count++; // Manufacturing
    if (events.some((e: any) => e.event_type === 'assembly')) count++; // Assembly
    if (events.some((e: any) => e.event_type === 'installation')) count++; // Installation
    if (events.some((e: any) => e.event_type === 'maintenance')) count++; // Maintenance
    return count;
  };

  // Determine current lifecycle stage based on DPP status and events
  const determineCurrentStage = () => {
    if (isEndOfLife) return 'end-of-life';
    if (events.some((e: any) => e.event_type === 'maintenance')) return 'maintenance';
    if (events.some((e: any) => e.event_type === 'installation')) return 'installation';
    if (events.some((e: any) => e.event_type === 'assembly')) return 'assembly';
    return 'manufacturing';
  };

  const currentStage = determineCurrentStage();
  const canManage = canSeeField('lifecycle');

  const lifecycleStages: LifecycleStage[] = [
    {
      id: 'manufacturing',
      title: 'Manufacturing',
      description: 'Components produced and DID created',
      status: 'completed',
      icon: Package,
      didEvents: ['DID Created', 'DID Document Registered', 'Components Linked'],
      timestamp: dpp.created_at,
      owner: dpp.owner,
      custodian: undefined,
      details: {
        manufacturer: dpp.owner,
        productionDate: dpp.metadata?.productionDate,
        batch: dpp.metadata?.batch,
        model: dpp.model,
        owner: dpp.owner,
      },
    },
    {
      id: 'assembly',
      title: 'Assembly',
      description: 'Window assembled from components',
      status: isEndOfLife ? 'completed' : (currentStage === 'manufacturing' ? 'current' : 'completed'),
      icon: Wrench,
      didEvents: ['Assembly Verified', 'Quality Check', 'Witness Attestation'],
      timestamp: events.find((e: any) => e.event_type === 'assembly')?.timestamp || dpp.created_at,
      owner: dpp.owner,
      custodian: undefined,
      details: {
        assembledBy: dpp.owner,
        dimensions: dpp.metadata?.dimensions,
        weight: dpp.metadata?.weight,
        owner: dpp.owner,
      },
    },
    {
      id: 'installation',
      title: 'Installation',
      description: 'Window installed at location',
      status: isEndOfLife ? 'completed' :
        (currentStage === 'manufacturing' || currentStage === 'assembly' ? 'future' :
          currentStage === 'installation' ? 'current' : 'completed'),
      icon: Home,
      didEvents: ['Location Updated', 'Custodian Changed', 'Installation Verified'],
      timestamp: events.find((e: any) => e.event_type === 'installation')?.timestamp,
      owner: dpp.owner,
      custodian: dpp.custodian || 'Building Owner',
      details: events.find((e: any) => e.event_type === 'installation') ? {
        location: 'Building Site',
        installer: dpp.custodian || dpp.owner,
        installDate: events.find((e: any) => e.event_type === 'installation')?.timestamp,
        owner: dpp.owner,
        custodian: dpp.custodian || 'Building Owner',
        ownershipNote: 'Ownership remains with manufacturer, custody transfers to building',
      } : undefined,
    },
    {
      id: 'maintenance',
      title: 'Operation & Maintenance',
      description: 'Active use with maintenance tracking',
      status: isEndOfLife ? 'completed' :
        currentStage === 'maintenance' ? 'current' :
          currentStage === 'installation' || currentStage === 'manufacturing' || currentStage === 'assembly' ? 'future' : 'current',
      icon: Wrench,
      didEvents: ['Maintenance Logged', 'Performance Monitored', 'Updates Recorded'],
      timestamp: events.find((e: any) => e.event_type === 'maintenance')?.timestamp,
      owner: dpp.owner,
      custodian: dpp.custodian || 'Building Owner',
      details: {
        maintenanceCount: events.filter((e: any) => e.event_type === 'maintenance').length,
        lastCheck: events.filter((e: any) => e.event_type === 'maintenance').slice(-1)[0]?.timestamp,
        status: dpp.lifecycle_status,
        owner: dpp.owner,
        custodian: dpp.custodian || 'Building Owner',
      },
    },
    {
      id: 'end-of-life',
      title: 'End of Life & Recycling',
      description: 'Decommissioning and material recovery',
      status: isEndOfLife ? 'completed' : 'future',
      icon: Recycle,
      didEvents: ['Decommission Recorded', 'Materials Catalogued', 'Recycling Verified'],
      timestamp: isEndOfLife ? dpp.updated_at : undefined,
      owner: dpp.owner,
      custodian: 'Recycling Facility',
      details: isEndOfLife ? {
        decommissionDate: dpp.updated_at,
        materials: {
          glass: dpp.metadata?.glass?.material || 'Glass',
          frame: dpp.metadata?.frame?.material || 'Aluminum',
        },
        recyclability: '95%',
        owner: dpp.owner,
        finalCustodian: 'Recycling Facility',
      } : undefined,
    },
  ];

  const getStatusIcon = (status: string, Icon: any) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-6 h-6 text-green-600" />;
      case 'current':
        return (
          <div className="relative">
            <Icon className="w-6 h-6 text-blue-600" />
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-600 rounded-full animate-pulse" />
          </div>
        );
      default:
        return <Circle className="w-6 h-6 text-gray-300" />;
    }
  };

  const completed = completedStages();
  const total = 5;
  const progressPercent = (completed / total) * 100;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 transition-all shadow-sm hover:shadow-md">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Package className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            Lifecycle Journey
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Track product journey from manufacturing to end-of-life
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <div className="text-sm font-semibold text-gray-900 dark:text-white">
              {completed} / {total} Phases
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{progressPercent.toFixed(0)}% Complete</div>
          </div>

          {canManage && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg shadow-sm flex items-center gap-2 transition-all transform active:scale-95"
            >
              <Settings className="w-4 h-4" />
              Manage Status
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-10 relative">
        <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-4 overflow-hidden shadow-inner">
          <div
            className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600 transition-all duration-1000 ease-out rounded-full relative"
            style={{ width: `${progressPercent}%` }}
          >
            <div className="absolute inset-0 bg-white/20 animate-pulse" />
          </div>
        </div>
      </div>

      <div className="space-y-6 relative">
        {lifecycleStages.map((stage, index) => (
          <div key={stage.id} className="relative group">
            {/* Connecting line */}
            {index < lifecycleStages.length - 1 && (
              <div
                className={`absolute left-[1.65rem] top-14 bottom-[-1.5rem] w-0.5 transition-colors duration-500 ${stage.status === 'completed' ? 'bg-indigo-500' :
                  stage.status === 'current' ? 'bg-gradient-to-b from-indigo-500 to-gray-200 dark:to-gray-700' : 'bg-gray-200 dark:bg-gray-700'
                  }`}
              />
            )}

            <div
              className={`relative flex items-start gap-6 p-5 rounded-xl cursor-pointer transition-all duration-300 border ${expandedStage === stage.id
                ? 'bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800 shadow-sm'
                : stage.status === 'current'
                  ? 'bg-white dark:bg-gray-800 border-indigo-200 dark:border-indigo-800 shadow-md ring-1 ring-indigo-50 dark:ring-indigo-900/20'
                  : stage.status === 'future'
                    ? 'opacity-60 border-transparent hover:bg-gray-50 dark:hover:bg-gray-800/50'
                    : 'border-transparent hover:bg-gray-50 dark:hover:bg-gray-800/50'
                }`}
              onClick={() => setExpandedStage(expandedStage === stage.id ? null : stage.id)}
            >
              <div className={`relative z-10 rounded-full p-2 transition-transform duration-300 group-hover:scale-110 ${stage.status === 'completed' ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' :
                  stage.status === 'current' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 ring-4 ring-blue-50 dark:ring-blue-900/20' :
                    'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500'
                }`}>
                {stage.status === 'completed' ? <CheckCircle className="w-6 h-6" /> : <stage.icon className="w-6 h-6" />}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-3">
                    <h3 className={`font-bold text-lg ${stage.status === 'current' ? 'text-blue-700 dark:text-blue-400' : 'text-gray-900 dark:text-white'}`}>
                      {stage.title}
                    </h3>
                    {stage.status === 'current' && (
                      <span className="px-2.5 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-bold rounded-full uppercase tracking-wider">
                        Current
                      </span>
                    )}
                  </div>
                  {stage.timestamp && (
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                      {new Date(stage.timestamp).toLocaleDateString()}
                    </span>
                  )}
                </div>

                <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{stage.description}</p>

                {/* Expanded Content */}
                <div className={`grid transition-all duration-300 ease-in-out ${expandedStage === stage.id ? 'grid-rows-[1fr] opacity-100 mt-4' : 'grid-rows-[0fr] opacity-0'}`}>
                  <div className="overflow-hidden">
                    <div className="bg-white dark:bg-gray-900/50 rounded-lg border border-gray-100 dark:border-gray-700 p-4 space-y-3">
                      {/* DID Events Chips */}
                      <div className="flex flex-wrap gap-2 mb-4">
                        {stage.didEvents?.map((event) => (
                          <span
                            key={event}
                            className={`text-xs font-medium px-2.5 py-1 rounded-md border ${stage.status === 'completed'
                              ? 'bg-green-50 text-green-700 border-green-100 dark:bg-green-900/20 dark:text-green-300 dark:border-green-900/30'
                              : 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700'
                              }`}
                          >
                            {event}
                          </span>
                        ))}
                      </div>

                      {/* Details Grid */}
                      {stage.details && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-sm border-t border-gray-100 dark:border-gray-700 pt-3">
                          {Object.entries(stage.details).map(([key, value]) => (
                            <div key={key} className="flex justify-between items-center py-1">
                              <span className="text-gray-500 dark:text-gray-400 capitalize font-medium">
                                {key.replace(/([A-Z])/g, ' $1').trim()}
                              </span>
                              <span className="font-mono text-gray-900 dark:text-gray-200 truncate ml-4 max-w-[150px]" title={String(value)}>
                                {typeof value === 'object' ? 'Complex Data' : String(value)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Actors */}
                      {(stage.owner || stage.custodian) && (
                        <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                          {stage.owner && (
                            <div className="flex items-center gap-2 text-xs bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 rounded-full text-blue-700 dark:text-blue-300">
                              <UserCircle className="w-3.5 h-3.5" />
                              <span className="font-semibold">Owner:</span>
                              {stage.owner.split(':').pop()}
                            </div>
                          )}
                          {stage.custodian && (
                            <div className="flex items-center gap-2 text-xs bg-purple-50 dark:bg-purple-900/20 px-3 py-1.5 rounded-full text-purple-700 dark:text-purple-300">
                              <ArrowRightLeft className="w-3.5 h-3.5" />
                              <span className="font-semibold">Custodian:</span>
                              {stage.custodian.split(':').pop()}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className={`mt-2 transition-transform duration-300 ${expandedStage === stage.id ? '-rotate-90 text-blue-500' : 'rotate-90 text-gray-300'}`}>
                <ArrowRight className="w-5 h-5" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Current Lifecycle Status:</span>
          <LifecycleStatusBadge status={dpp.lifecycle_status} size="lg" />
        </div>

        <div className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          Blockchain Verified
        </div>
      </div>

      <Suspense fallback={null}>
        {isModalOpen && (
          <LifecycleActionModal
            isOpen={true}
            dpp={dpp}
            onClose={() => setIsModalOpen(false)}
            onUpdate={() => {
              if (onUpdate) onUpdate();
              setIsModalOpen(false);
            }}
            currentUserDid={currentRoleDID || 'did:ethr:0x000'}
          />
        )}
      </Suspense>
    </div>
  );
}
