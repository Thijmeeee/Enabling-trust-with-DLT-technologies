import { useState, useEffect } from 'react';
import { CheckCircle2, Factory, ShieldCheck, Recycle, User, ExternalLink } from 'lucide-react';
import { hybridDataStore } from '../lib/data/hybridDataStore';
import { etherscanTxUrl } from '../lib/api/config';

interface StoryEvent {
  id: string;
  timestamp: string;
  title: string;
  description: string;
  icon: any;
  color: string;
  status: 'completed' | 'pending';
  txHash?: string;
}

export default function SimpleStoryTimeline({ did }: { did: string }) {
  const [events, setEvents] = useState<StoryEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStory();
  }, [did]);

  async function loadStory() {
    setLoading(true);
    const story: StoryEvent[] = [];
    const dpp = await hybridDataStore.getDPPByDID(did);
    if (!dpp) return;

    // 1. Production Stage
    story.push({
      id: 'prod',
      timestamp: dpp.created_at,
      title: 'Product Born',
      description: `This product was manufactured and digitally registered by ${dpp.metadata?.manufacturer || 'EcoGlass B.V.'}. All materials are certified.`,
      icon: Factory,
      color: 'blue',
      status: 'completed'
    });

    // 2. Notarization Stage
    const anchorings = await hybridDataStore.getAnchoringEventsByDID(did);
    if (anchorings.length > 0) {
      const latestAnchor = anchorings[anchorings.length - 1];
      story.push({
        id: 'anchor',
        timestamp: latestAnchor.timestamp,
        title: 'Security Seal Applied',
        description: 'The product identity has been locked in the public notarization system. It cannot be faked or altered.',
        icon: ShieldCheck,
        color: 'purple',
        status: 'completed',
        txHash: latestAnchor.transaction_hash
      });
    }

    // 3. Ownership Stage
    story.push({
      id: 'owner',
      timestamp: new Date().toISOString(), // Fallback
      title: 'Current Custody',
      description: `Verified ownership held by: ${dpp.owner || 'Authorized Logistics Partner'}`,
      icon: User,
      color: 'green',
      status: 'completed'
    });

    // 4. Future: Circular Stage
    story.push({
      id: 'recycle',
      timestamp: '',
      title: 'End of Life Plan',
      description: 'Materials are eligible for 100% circular recycling',
      icon: Recycle,
      color: 'gray',
      status: 'pending'
    });

    setEvents(story.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
    setLoading(false);
  }

  if (loading) return <div className="animate-pulse space-y-4">
    {[1, 2, 3].map(i => <div key={i} className="h-20 bg-gray-100 dark:bg-gray-800 rounded-lg"></div>)}
  </div>;

  return (
    <div className="relative">
      {/* Vertical Line */}
      <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700"></div>

      <div className="space-y-8">
        {events.map((event, index) => (
          <div key={event.id} className="relative flex items-start gap-6">
            {/* Icon Bubble */}
            <div className={`relative z-10 flex items-center justify-center w-12 h-12 rounded-full border-4 border-white dark:border-gray-900 shadow-sm transition-colors ${
              event.status === 'completed' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-100 dark:bg-gray-800 text-gray-400'
            }`}>
              <event.icon className="w-6 h-6" />
            </div>

            {/* Content */}
            <div className={`flex-1 pt-1 ${event.status === 'pending' ? 'opacity-50' : ''}`}>
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">{event.title}</h3>
                {event.timestamp && (
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                    {new Date(event.timestamp).toLocaleDateString()}
                  </span>
                )}
              </div>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed">{event.description}</p>
              
              {event.txHash && (
                <div className="mt-3">
                  <a 
                    href={etherscanTxUrl(event.txHash) || '#'} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300 transition-colors bg-purple-50 dark:bg-purple-900/20 px-3 py-1.5 rounded-lg border border-purple-100 dark:border-purple-800"
                  >
                    <ExternalLink size={12} />
                    View Blockchain Transaction
                  </a>
                </div>
              )}

              {event.status === 'completed' && index === 0 && (
                <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full text-sm font-medium border border-green-100 dark:border-green-900/50">
                  <CheckCircle2 className="w-4 h-4" />
                  Verified Active State
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
