import { useState } from 'react';
import { CheckCircle, Circle, Package, Wrench, Home, Recycle, ArrowRight, UserCircle, ArrowRightLeft } from 'lucide-react';

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

export default function WindowLifecycleVisualization({ dpp, events }: {
  dpp: any;
  events: any[];
}) {
  const [expandedStage, setExpandedStage] = useState<string | null>(null);

  // Check if product is at end of life (supports both 'disposed' and 'end_of_life')
  const isEndOfLife = dpp.lifecycle_status === 'disposed' || dpp.lifecycle_status === 'end_of_life';

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
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 transition-colors">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Package className="w-5 h-5 text-blue-600" />
          Window Lifecycle & DID Integration
        </h2>
        <div className="text-right">
          <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            {completed} of {total} phases completed
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{progressPercent.toFixed(0)}% Complete</div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-green-500 to-blue-600 transition-all duration-500 rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <div className="space-y-4">
        {lifecycleStages.map((stage, index) => (
          <div key={stage.id} className="relative">
            {/* Connecting line */}
            {index < lifecycleStages.length - 1 && (
              <div
                className={`absolute left-3 top-12 bottom-0 w-0.5 ${stage.status === 'completed' ? 'bg-green-600' :
                  stage.status === 'current' ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
              />
            )}

            <div
              className={`relative flex items-start gap-4 p-4 rounded-lg cursor-pointer transition-colors ${expandedStage === stage.id
                ? 'bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700'
                : stage.status === 'current'
                  ? 'bg-blue-50 dark:bg-blue-900/30'
                  : stage.status === 'future'
                    ? 'opacity-60 hover:opacity-80'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700/30'
                } ${stage.status === 'future' ? 'border border-dashed border-gray-300 dark:border-gray-600' : ''
                }`}
              onClick={() => setExpandedStage(expandedStage === stage.id ? null : stage.id)}
            >
              <div className="relative z-10 bg-white dark:bg-gray-800 rounded-full p-1">
                {getStatusIcon(stage.status, stage.icon)}
              </div>

              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900 dark:text-white">{stage.title}</h3>
                    {stage.status === 'current' && (
                      <span className="px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full">
                        Current
                      </span>
                    )}
                    {stage.status === 'future' && (
                      <span className="px-2 py-0.5 bg-gray-300 text-gray-600 text-xs rounded-full">
                        Upcoming
                      </span>
                    )}
                    {stage.status === 'completed' && (
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                        ✓ Completed
                      </span>
                    )}
                  </div>
                  {stage.timestamp && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(stage.timestamp).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{stage.description}</p>

                {/* Ownership Information */}
                {stage.owner && (
                  <div className="mt-3 flex items-center gap-4 text-xs">
                    <div className="flex items-center gap-1 px-2 py-1 bg-blue-50 dark:bg-blue-900/30 rounded border border-blue-200 dark:border-blue-700">
                      <UserCircle className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                      <span className="text-blue-700 dark:text-blue-400 font-medium">Owner:</span>
                      <span className="text-blue-900 dark:text-blue-300 font-mono">{stage.owner.split(':').pop()}</span>
                    </div>
                    {stage.custodian && (
                      <>
                        <ArrowRightLeft className="w-3 h-3 text-gray-400" />
                        <div className="flex items-center gap-1 px-2 py-1 bg-green-50 dark:bg-green-900/30 rounded border border-green-200 dark:border-green-700">
                          <UserCircle className="w-3 h-3 text-green-600 dark:text-green-400" />
                          <span className="text-green-700 dark:text-green-400 font-medium">Custodian:</span>
                          <span className="text-green-900 dark:text-green-300 font-mono">{stage.custodian.split(':').pop()}</span>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* DID Events */}
                <div className="mt-2 flex flex-wrap gap-1">
                  {stage.didEvents?.map((event) => (
                    <span
                      key={event}
                      className={`text-xs px-2 py-0.5 rounded ${stage.status === 'completed'
                        ? 'bg-green-50 text-green-700'
                        : stage.status === 'current'
                          ? 'bg-blue-50 text-blue-700'
                          : 'bg-gray-50 text-gray-500'
                        }`}
                    >
                      {event}
                    </span>
                  ))}
                </div>

                {/* Expanded Details */}
                {expandedStage === stage.id && stage.details && (
                  <div className="mt-4 p-3 bg-white dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600">
                    <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">Stage Details:</div>
                    <div className="space-y-1">
                      {Object.entries(stage.details).map(([key, value]) => (
                        <div key={key} className="flex justify-between text-xs">
                          <span className="text-gray-600 dark:text-gray-400 capitalize">
                            {key.replace(/([A-Z])/g, ' $1').trim()}:
                          </span>
                          <span className="font-mono text-gray-900 dark:text-white ml-2 break-all max-w-xs text-right">
                            {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <ArrowRight
                className={`w-4 h-4 text-gray-400 transition-transform ${expandedStage === stage.id ? 'rotate-90' : ''
                  }`}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-green-50 dark:from-blue-900/30 dark:to-green-900/30 rounded-lg border border-blue-200 dark:border-blue-700">
        <p className="text-sm text-gray-800 dark:text-gray-200 space-y-2">
          <span className="block">
            <strong>Lifecycle Status:</strong> {(dpp.lifecycle_status || 'active').toUpperCase()}
          </span>
          <span className="block">
            <strong>Current Owner:</strong> <span className="font-mono text-blue-700 dark:text-blue-400">{dpp.owner.split(':').pop()}</span>
            {dpp.custodian && (
              <>
                {' → '}
                <strong>Custodian:</strong> <span className="font-mono text-green-700 dark:text-green-400">{dpp.custodian.split(':').pop()}</span>
              </>
            )}
          </span>
          <span className="block text-xs text-gray-600 dark:text-gray-400 mt-2">
            <strong>DID Integration:</strong> Each lifecycle stage is tracked and verified through the DID system.
            Ownership and custody transfers are recorded as immutable events on the blockchain.
          </span>
        </p>
      </div>
    </div>
  );
}
