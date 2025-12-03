import { useState, useEffect } from 'react';
import EnhancedDashboard from './components/dashboards/EnhancedDashboard';
import MainDPPView from './components/dpp/MainDPPView';
import ComponentDPPView from './components/dpp/ComponentDPPView';
import CreateDPPForm from './components/dpp/CreateDPPForm';
import WitnessDashboard from './components/dashboards/WitnessDashboard';
import WatcherDashboard from './components/dashboards/WatcherDashboard';
import ResolverDashboard from './components/dashboards/ResolverDashboard';
import ManufacturerDashboard from './components/dashboards/ManufacturerDashboard';
import IntroductionPage from './components/IntroductionPage';
import { RoleProvider, useRole, type UserRole } from './lib/utils/roleContext';
import { enhancedDB } from './lib/data/enhancedDataStore';
import { generateMixedTestData } from './lib/operations/bulkOperations';
import { User, ChevronDown, HelpCircle, Wallet } from 'lucide-react';

type View = 'dashboard' | 'dpp-main' | 'dpp-component' | 'create-dpp' | 'manufacturer-wallet';

function AppContent() {
  const { currentRole, setRole } = useRole();
  const [view, setView] = useState<View>('dashboard');
  const [currentDID, setCurrentDID] = useState<string>('');
  const [isInitializing, setIsInitializing] = useState(true);
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  // Always show intro on reload
  const [showIntro, setShowIntro] = useState(true);
  // Track where the user came from when viewing a DPP
  const [returnView, setReturnView] = useState<View>('dashboard');

  const handleContinueFromIntro = () => {
    setShowIntro(false);
  };

  useEffect(() => {
    // Auto-initialize data on first load
    let cancelled = false;

    const initData = async () => {
      setIsInitializing(true);

      // Check if data already exists
      const existing = await enhancedDB.getAllDPPs();

      // Prevent double initialization in StrictMode
      if (cancelled) return;

      if (existing.length === 0) {
        console.log('No data found, generating test data...');
        try {
          await generateMixedTestData();
          console.log('Test data generated successfully');
          const newDpps = await enhancedDB.getAllDPPs();
          console.log('Total DPPs after generation:', newDpps.length);
        } catch (err) {
          console.error('Error initializing data:', err);
        }
      } else {
        console.log('Existing data found:', existing.length, 'DPPs');
      }

      setIsInitializing(false);
    };

    initData();

    return () => {
      cancelled = true;
    };
  }, []);

  // Handle role switching - reset view if on manufacturer-wallet and switching to non-manufacturer role
  useEffect(() => {
    const isManufacturer = currentRole === 'Manufacturer' || currentRole === 'Manufacturer A' || currentRole === 'Manufacturer B';
    if (view === 'manufacturer-wallet' && !isManufacturer) {
      console.log('Role switched to non-manufacturer, resetting view to dashboard');
      setView('dashboard');
      setReturnView('dashboard');
    }
  }, [currentRole, view]);

  function handleSelectDPP(did: string, fromView?: View) {
    console.log('handleSelectDPP called with DID:', did, 'from view:', fromView);
    setCurrentDID(did);

    // Track where we came from
    if (fromView) {
      setReturnView(fromView);
    }

    enhancedDB.getDPPByDID(did).then((dpp) => {
      console.log('DPP found:', dpp);
      if (dpp) {
        const newView = dpp.type === 'main' ? 'dpp-main' : 'dpp-component';
        console.log('Setting view to:', newView);
        setView(newView);
      } else {
        console.error('DPP not found for DID:', did);
      }
    }).catch(err => {
      console.error('Error loading DPP:', err);
    });
  }

  function handleBack() {
    console.log('handleBack called, returning to:', returnView);
    setView(returnView);
    setCurrentDID('');
  }

  function handleCreateDPP() {
    setView('create-dpp');
  }

  function handleDPPCreated() {
    setView('dashboard');
  }

  const roles = [
    { value: 'Operator' as const, label: 'Operator' },
    { value: 'Manufacturer A' as const, label: 'Manufacturer A' },
    { value: 'Manufacturer B' as const, label: 'Manufacturer B' },
    { value: 'Recycler' as const, label: 'Recycler' },
    { value: 'Supervisor' as const, label: 'Supervisor' },
    { value: 'Witness' as const, label: 'Witness' },
    { value: 'Watcher' as const, label: 'Watcher' },
    { value: 'Resolver' as const, label: 'Resolver' },
  ];

  return (
    <div className="relative">
      {/* Role selector dropdown and help button */}
      <div className="fixed top-4 left-4 z-50 flex items-center gap-2">
        <div className="relative">
          <button
            onClick={() => setShowRoleDropdown(!showRoleDropdown)}
            className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg shadow-sm transition-colors"
          >
            <User className="w-4 h-4" />
            <span className="text-sm font-medium">
              {roles.find(r => r.value === currentRole)?.label}
            </span>
            <ChevronDown className="w-4 h-4" />
          </button>

          {showRoleDropdown && (
            <div className="absolute top-full left-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
              {roles.map((role) => (
                <button
                  key={role.value}
                  onClick={() => {
                    setRole(role.value);
                    setShowRoleDropdown(false);
                  }}
                  className={`w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors ${currentRole === role.value ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-700'
                    }`}
                >
                  {role.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Help button */}
        <button
          onClick={() => setShowIntro(true)}
          className="flex items-center justify-center w-10 h-10 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg shadow-sm transition-colors"
          title="Show introduction"
        >
          <HelpCircle className="w-5 h-5 text-gray-600" />
        </button>

        {/* Manufacturer Wallet Button */}
        {(currentRole === 'Manufacturer' || currentRole === 'Manufacturer A' || currentRole === 'Manufacturer B') && (
          <button
            onClick={() => setView('manufacturer-wallet')}
            className={`flex items-center justify-center w-10 h-10 border border-gray-300 rounded-lg shadow-sm transition-colors ${view === 'manufacturer-wallet'
              ? 'bg-blue-50 border-blue-200 text-blue-600'
              : 'bg-white hover:bg-gray-50 text-gray-600'
              }`}
            title="Open Manufacturer Wallet"
          >
            <Wallet className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Introduction Page */}
      {showIntro && (
        <IntroductionPage onContinue={handleContinueFromIntro} />
      )}

      {!showIntro && isInitializing && (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-gray-600">Loading data...</p>
          </div>
        </div>
      )}

      {!showIntro && !isInitializing && (
        <>
          {view === 'dashboard' && currentRole === 'Witness' && (
            <WitnessDashboard />
          )}

          {view === 'dashboard' && currentRole === 'Watcher' && (
            <WatcherDashboard />
          )}

          {view === 'dashboard' && currentRole === 'Resolver' && (
            <ResolverDashboard />
          )}

          {view === 'manufacturer-wallet' && (currentRole === 'Manufacturer' || currentRole === 'Manufacturer A' || currentRole === 'Manufacturer B') && (
            <ManufacturerDashboard
              onNavigate={handleSelectDPP}
              onCreateDPP={handleCreateDPP}
              onBack={handleBack}
              onClose={() => { setView('dashboard'); setReturnView('dashboard'); setCurrentDID(''); }}
            />
          )}

          {view === 'dashboard' && currentRole !== 'Witness' && currentRole !== 'Watcher' && currentRole !== 'Resolver' && (
            <EnhancedDashboard
              onNavigate={handleSelectDPP}
              onCreateDPP={(currentRole === 'Manufacturer' || currentRole === 'Manufacturer A' || currentRole === 'Manufacturer B') ? handleCreateDPP : undefined}
            />
          )}

          {view === 'create-dpp' && (
            <>
              <EnhancedDashboard
                onNavigate={handleSelectDPP}
                onCreateDPP={(currentRole === 'Manufacturer' || currentRole === 'Manufacturer A' || currentRole === 'Manufacturer B') ? handleCreateDPP : undefined}
              />
              <CreateDPPForm onClose={handleBack} onComplete={handleDPPCreated} />
            </>
          )}

          {view === 'dpp-main' && (
            <MainDPPView
              did={currentDID}
              onBack={handleBack}
              onNavigate={(did) => handleSelectDPP(did, returnView)}
              backLabel={returnView === 'manufacturer-wallet' ? 'Back to Wallet' : 'Back to Dashboard'}
            />
          )}

          {view === 'dpp-component' && (
            <MainDPPView
              did={currentDID}
              onBack={handleBack}
              onNavigate={(did) => handleSelectDPP(did, returnView)}
              backLabel={returnView === 'manufacturer-wallet' ? 'Back to Wallet' : 'Back to Dashboard'}
            />
          )}
        </>
      )}
    </div>
  );
}

export default function App() {
  return (
    <RoleProvider>
      <AppContent />
    </RoleProvider>
  );
}
