import { useState, useEffect } from 'react';
import EnhancedDashboard from './components/dashboards/EnhancedDashboard';
import MainDPPView from './components/dpp/MainDPPView';
import ComponentDPPView from './components/dpp/ComponentDPPView';
import CreateDPPForm from './components/dpp/CreateDPPForm';
import WitnessDashboard from './components/dashboards/WitnessDashboard';
import WatcherDashboard from './components/dashboards/WatcherDashboard';
import ResolverDashboard from './components/dashboards/ResolverDashboard';
import ManufacturerDashboard from './components/dashboards/ManufacturerDashboard';
import ManufacturerSimpleDashboard from './components/dashboards/ManufacturerSimpleDashboard';
import SupervisorDashboard from './components/dashboards/SupervisorDashboard';
import RecyclerDashboard from './components/dashboards/RecyclerDashboard';
import ConsumerView from './components/dashboards/ConsumerView';
import WindowRegistrationWizard from './components/dashboards/WindowRegistrationWizard';
import IntroductionPage from './components/IntroductionPage';
import { RoleProvider, useRole, type UserRole } from './lib/utils/roleContext';
import { ThemeProvider, useTheme } from './lib/utils/ThemeContext';
import { hybridDataStore as enhancedDB } from './lib/data/hybridDataStore';
import { generateMixedTestData } from './lib/operations/bulkOperations';
import { User, ChevronDown, HelpCircle, Wallet, ToggleLeft, ToggleRight, Moon, Sun } from 'lucide-react';

type View = 'dashboard' | 'dpp-main' | 'dpp-component' | 'create-dpp' | 'manufacturer-wallet' | 'register-wizard';

function AppContent() {
  const { currentRole, setRole } = useRole();
  const { theme, toggleTheme } = useTheme();
  const [view, setView] = useState<View>('dashboard');
  const [currentDID, setCurrentDID] = useState<string>('');
  const [isInitializing, setIsInitializing] = useState(true);
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  // Always show intro on reload
  const [showIntro, setShowIntro] = useState(true);
  // Track where the user came from when viewing a DPP
  const [returnView, setReturnView] = useState<View>('dashboard');
  // Dashboard mode: 'role' = simplified role-based view, 'classic' = full enhanced dashboard
  const [dashboardMode, setDashboardMode] = useState<'role' | 'classic'>('role');

  const handleContinueFromIntro = () => {
    setShowIntro(false);
  };

  useEffect(() => {
    // Auto-initialize data on first load
    let cancelled = false;

    const initData = async () => {
      setIsInitializing(true);

      // Import hybridDataStore to check backend availability
      const { hybridDataStore } = await import('./lib/data/hybridDataStore');

      // Try to get data from backend first
      try {
        const backendData = await hybridDataStore.getAllDPPs();

        if (cancelled) return;

        if (backendData.length > 0) {
          console.log('[App] Found', backendData.length, 'identities from backend, syncing to local store...');

          // Sync backend data to enhancedDB so dashboards can use it
          for (const dpp of backendData) {
            try {
              await enhancedDB.insertDPP(dpp);
            } catch (e) {
              // Ignore duplicates
            }
          }

          console.log('[App] Synced backend data to local store');
          setIsInitializing(false);
          return;
        }

        console.log('[App] No backend data, checking local fallback...');
      } catch (err) {
        console.log('[App] Backend unavailable, using local data:', err);
      }

      // If no backend data, check local and generate mock data if needed
      const existing = await enhancedDB.getAllDPPs();

      // Prevent double initialization in StrictMode
      if (cancelled) return;

      if (existing.length === 0) {
        console.log('[App] No data found, generating test data...');
        try {
          await generateMixedTestData();
          console.log('[App] Test data generated successfully');
          const newDpps = await enhancedDB.getAllDPPs();
          console.log('[App] Total DPPs after generation:', newDpps.length);
        } catch (err) {
          console.error('[App] Error initializing data:', err);
        }
      } else {
        console.log('[App] Existing local data found:', existing.length, 'DPPs');
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
    { value: 'Manufacturer A' as const, label: 'Manufacturer A' },
    { value: 'Manufacturer B' as const, label: 'Manufacturer B' },
    { value: 'Supervisor' as const, label: 'Supervisor' },
    { value: 'Recycler' as const, label: 'Recycler' },
    { value: 'Consumer' as const, label: 'Consumer' },
    { value: 'Witness' as const, label: 'Witness' },
    { value: 'Watcher' as const, label: 'Watcher' },
    { value: 'Resolver' as const, label: 'Resolver' },
  ];

  return (
    <div className="relative bg-gray-50 dark:bg-gray-900 min-h-screen transition-colors">
      {/* Role selector dropdown and help button */}
      <div className="fixed top-4 left-4 z-50 flex items-center gap-2">
        <div className="relative">
          <button
            onClick={() => setShowRoleDropdown(!showRoleDropdown)}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm transition-colors"
          >
            <User className="w-4 h-4 text-gray-700 dark:text-gray-300" />
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {roles.find(r => r.value === currentRole)?.label}
            </span>
            <ChevronDown className="w-4 h-4 text-gray-700 dark:text-gray-300" />
          </button>

          {showRoleDropdown && (
            <div className="absolute top-full left-0 mt-2 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden">
              {roles.map((role) => (
                <button
                  key={role.value}
                  onClick={() => {
                    setRole(role.value);
                    setShowRoleDropdown(false);
                  }}
                  className={`w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${currentRole === role.value ? 'bg-blue-50 dark:bg-blue-900 text-blue-600 dark:text-blue-400 font-medium' : 'text-gray-700 dark:text-gray-300'
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
          className="flex items-center justify-center w-10 h-10 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm transition-colors"
          title="Show introduction"
        >
          <HelpCircle className="w-5 h-5 text-gray-600 dark:text-gray-300" />
        </button>

        {/* Dashboard Mode Toggle */}
        <button
          onClick={() => setDashboardMode(dashboardMode === 'role' ? 'classic' : 'role')}
          className={`flex items-center gap-2 px-3 py-2 border rounded-lg shadow-sm transition-colors ${dashboardMode === 'classic'
            ? 'bg-purple-50 dark:bg-purple-900/50 border-purple-200 dark:border-purple-700 text-purple-700 dark:text-purple-300'
            : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          title={dashboardMode === 'role' ? 'Switch to Classic View' : 'Switch to Role View'}
        >
          {dashboardMode === 'role' ? (
            <ToggleLeft className="w-5 h-5" />
          ) : (
            <ToggleRight className="w-5 h-5" />
          )}
          <span className="text-xs font-medium">
            {dashboardMode === 'role' ? 'Role' : 'Classic'}
          </span>
        </button>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="flex items-center justify-center w-10 h-10 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm transition-colors"
          title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
        >
          {theme === 'light' ? (
            <Moon className="w-5 h-5 text-gray-600" />
          ) : (
            <Sun className="w-5 h-5 text-yellow-400" />
          )}
        </button>

        {/* Manufacturer Wallet Button */}
        {(currentRole === 'Manufacturer' || currentRole === 'Manufacturer A' || currentRole === 'Manufacturer B') && (
          <button
            onClick={() => setView('manufacturer-wallet')}
            className={`flex items-center justify-center w-10 h-10 border rounded-lg shadow-sm transition-colors ${view === 'manufacturer-wallet'
              ? 'bg-blue-50 dark:bg-blue-900/50 border-blue-200 dark:border-blue-700 text-blue-600 dark:text-blue-400'
              : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300'
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
          {/* Registration Wizard */}
          {view === 'register-wizard' && (
            <WindowRegistrationWizard
              onClose={() => setView('dashboard')}
              onComplete={() => setView('dashboard')}
            />
          )}

          {/* Specialized Role Dashboards (always shown regardless of mode) */}
          {view === 'dashboard' && currentRole === 'Witness' && (
            <WitnessDashboard />
          )}

          {view === 'dashboard' && currentRole === 'Watcher' && (
            <WatcherDashboard />
          )}

          {view === 'dashboard' && currentRole === 'Resolver' && (
            <ResolverDashboard />
          )}

          {/* Manufacturer Wallet */}
          {view === 'manufacturer-wallet' && (currentRole === 'Manufacturer' || currentRole === 'Manufacturer A' || currentRole === 'Manufacturer B') && (
            <ManufacturerDashboard
              onNavigate={handleSelectDPP}
              onCreateDPP={handleCreateDPP}
              onBack={handleBack}
              onClose={() => { setView('dashboard'); setReturnView('dashboard'); setCurrentDID(''); }}
            />
          )}

          {/* Role-Based Dashboards (when dashboardMode === 'role') */}
          {view === 'dashboard' && dashboardMode === 'role' && (currentRole === 'Manufacturer' || currentRole === 'Manufacturer A' || currentRole === 'Manufacturer B') && (
            <ManufacturerSimpleDashboard
              onRegisterWindow={() => setView('register-wizard')}
              onNavigate={handleSelectDPP}
            />
          )}

          {view === 'dashboard' && dashboardMode === 'role' && currentRole === 'Supervisor' && (
            <SupervisorDashboard
              onNavigate={handleSelectDPP}
            />
          )}

          {view === 'dashboard' && dashboardMode === 'role' && currentRole === 'Recycler' && (
            <RecyclerDashboard
              onNavigate={handleSelectDPP}
            />
          )}

          {view === 'dashboard' && dashboardMode === 'role' && currentRole === 'Consumer' && (
            <ConsumerView
              onNavigate={handleSelectDPP}
            />
          )}

          {/* Classic Dashboard (when dashboardMode === 'classic') */}
          {view === 'dashboard' && (
            dashboardMode === 'classic' &&
            currentRole !== 'Witness' &&
            currentRole !== 'Watcher' &&
            currentRole !== 'Resolver'
          ) && (
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
    <ThemeProvider>
      <RoleProvider>
        <AppContent />
      </RoleProvider>
    </ThemeProvider>
  );
}
