import { useState } from 'react';
import { 
  Server, 
  Shield, 
  ArrowRight,
  Globe
} from 'lucide-react';
import { ECOSYSTEM_MAP } from '../../lib/ecosystemMap';

const ROLE_THEMES: Record<string, any> = {
  Manufacturer: { bg: 'bg-black', text: 'text-white', border: 'border-slate-800', isDark: true },
  Witness: { bg: 'bg-blue-100', text: 'text-blue-900' },
  Watcher: { bg: 'bg-purple-100', text: 'text-purple-900' },
  Resolver: { bg: 'bg-yellow-100', text: 'text-yellow-900' },
  ConsumerRecycler: { bg: 'bg-green-100', text: 'text-green-900' },
};

export default function EcosystemView() {
  const [activeId, setActiveId] = useState<string | null>(null);

  const renderCard = (id: string) => {
    const profile = ECOSYSTEM_MAP[id];
    if (!profile) return null;

    const theme = ROLE_THEMES[id] || { bg: 'bg-gray-100', text: 'text-gray-900' };
    const ProfileIcon = profile.infrastructure[0]?.icon || Shield;
    const isActive = activeId === id;

    return (
      <button
        key={id}
        onMouseEnter={() => setActiveId(id)}
        onClick={() => setActiveId(id)}
        className={`
          text-left p-5 rounded-2xl border transition-all duration-300 relative overflow-hidden group
          ${theme.bg} 
          ${theme.text}
          ${isActive 
            ? `border-blue-500 shadow-2xl scale-[1.04] z-10 ring-4 ring-blue-400 ring-offset-4 dark:ring-offset-slate-900` 
            : `border-transparent hover:border-blue-300 dark:hover:border-blue-700 opacity-95 hover:opacity-100`
          }
        `}
      >
        <div className="flex items-center gap-5 relative z-10">
          <div className={`
            p-3 rounded-xl transition-colors
            ${theme.isDark ? 'bg-white/20 text-white' : 'bg-black/10 text-black'}
          `}>
            <ProfileIcon className="w-6 h-6" />
          </div>
          <div>
            <h4 className="font-bold text-xl leading-tight">
              {profile.label}
            </h4>
            <span className={`text-xs uppercase font-extrabold tracking-wider ${theme.isDark ? 'text-white/60' : 'text-black/50'}`}>
              {profile.infrastructure.length} Entities
            </span>
          </div>
          {isActive && (
            <ArrowRight className={`w-6 h-6 ml-auto animate-pulse ${theme.isDark ? 'text-white' : 'text-black'}`} />
          )}
        </div>
      </button>
    );
  };

  return (
    <div className="w-full relative">
      
      {/* Background Grid & Network Lines */}
      <div className="absolute inset-0 opacity-5 dark:opacity-10 pointer-events-none rounded-xl overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
      </div>

      <div className="relative z-10 p-0 lg:p-4 flex flex-col items-center">
        <div className="text-center mb-10 pt-4">
          <h3 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">
            The Trust Ecosystem
          </h3>
          <p className="text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
            Hover over a stakeholder to reveal their deployed infrastructure and role in the trust network.
            This demonstrates how distributed responsibility creates security.
          </p>
        </div>

        {/* Central Trust Network Hub */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 opacity-10 pointer-events-none">
          <div className="w-full h-full rounded-full bg-blue-500 animate-pulse blur-3xl"></div>
        </div>

        <div className="flex flex-col lg:flex-row items-start justify-center w-full gap-8 max-w-[1400px]">
          
          {/* Left Side: Stakeholders List */}
          <div className="flex flex-col gap-2 w-full lg:w-[480px] py-6 px-4">
            
            <div className="mb-6">
              <h4 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4 px-2">
                Network Status & Readiness
              </h4>
              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Blockchain</span>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${window.location.hostname === 'localhost' ? 'bg-blue-500 animate-pulse' : 'bg-green-500'}`}></div>
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                      {window.location.hostname === 'localhost' ? 'Sepolia / Local' : 'Sepolia Main'}
                    </span>
                  </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Registry</span>
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200">WitnessAnchor V1</span>
                </div>
              </div>

              <h4 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4 px-2">
                Supply Chain Stakeholders
              </h4>
              <div className="flex flex-col gap-4">
                {renderCard('Manufacturer')}
                {renderCard('ConsumerRecycler')}
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4 px-2">
                DID Infrastructure & Verifiers
              </h4>
              <div className="flex flex-col gap-4">
                {renderCard('Witness')}
                {renderCard('Watcher')}
                {renderCard('Resolver')}
              </div>
            </div>
          </div>

          {/* Right Side: Infrastructure Detail */}
          <div className="w-full lg:flex-1 min-h-[400px] py-6">
            {activeId ? (() => {
              const activeProfile = ECOSYSTEM_MAP[activeId];
              const theme = ROLE_THEMES[activeId] || { bg: 'bg-green-100', text: 'text-green-900' };
              const HeaderIcon = activeProfile.infrastructure[0]?.icon || Server;
              
              return (
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-6 h-full transition-all duration-500 animate-in fade-in slide-in-from-right-4 overflow-hidden relative">
                  
                  {/* Subtle Role-colored header background - Hidden for Manufacturer to keep it white */}
                  {!theme.isDark && (
                    <div className={`absolute top-0 left-0 right-0 h-32 ${theme.bg} opacity-10 pointer-events-none`}></div>
                  )}

                  <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gray-100 dark:border-gray-700 relative z-10">
                    <div className={`p-3 rounded-xl shadow-lg ${theme.isDark ? 'bg-black text-white' : 'bg-blue-600 text-white'}`}>
                       <HeaderIcon className="w-8 h-8" />
                    </div>
                    <div>
                      <h4 className="text-xl font-bold text-gray-900 dark:text-white">
                        {activeProfile.label}
                      </h4>
                      <p className="text-blue-600 dark:text-blue-400 font-medium">
                        Active Infrastructure
                      </p>
                    </div>
                  </div>

                  <div className="space-y-6">
                    {/* Responsibilities */}
                    <div>
                      <h5 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Core Responsibilities</h5>
                      <ul className="space-y-2">
                        {activeProfile.responsibilities.map((resp, i) => (
                          <li key={i} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                            {resp}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Deployed Entities */}
                    <div>
                      <h5 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Deployed Entities</h5>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {activeProfile.infrastructure.map((entity) => {
                          const EntityIcon = entity.icon;
                          return (
                            <div key={entity.id} className="bg-slate-50 dark:bg-slate-700/50 p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-500 transition-colors group/entity">
                              <div className="flex items-start gap-3">
                                <div className="p-2 bg-white dark:bg-slate-700 rounded-md shadow-sm text-gray-500 group-hover/entity:text-blue-500 transition-colors">
                                  <EntityIcon className="w-5 h-5" />
                                </div>
                                <div>
                                  <div className="font-semibold text-gray-900 dark:text-white text-sm">
                                    {entity.name}
                                  </div>
                                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">
                                    {entity.description}
                                  </div>
                                  <div className="mt-2 flex items-center gap-1.5">
                                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                                    <span className="text-[10px] font-mono text-green-600 dark:text-green-400 uppercase">
                                      {entity.status}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })() : (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-2xl bg-gray-50/50 dark:bg-gray-800/20">
                <Globe className="w-16 h-16 text-gray-300 dark:text-gray-600 mb-4" />
                <h4 className="text-lg font-medium text-gray-500 dark:text-gray-400">
                  Select a Stakeholder
                </h4>
                <p className="text-sm text-gray-400 dark:text-gray-500 max-w-sm mt-2">
                  Click on any stakeholder on the left to visualize their node infrastructure and network responsibilities.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
