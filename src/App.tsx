import { useState, useEffect } from 'react';
import EnhancedDashboard from './components/EnhancedDashboard';
import MainDPPView from './components/MainDPPView';
import ComponentDPPView from './components/ComponentDPPView';
import CreateDPPForm from './components/CreateDPPForm';
import { RoleProvider, useRole } from './lib/roleContext';
import { enhancedDB } from './lib/enhancedDataStore';
import { generateMixedTestData } from './lib/bulkOperations';
import { User, ChevronDown } from 'lucide-react';

type View = 'dashboard' | 'dpp-main' | 'dpp-component' | 'create-dpp';

function AppContent() {
  const { currentRole, setRole } = useRole();
  const [view, setView] = useState<View>('dashboard');
  const [currentDID, setCurrentDID] = useState<string>('');
  const [isInitializing, setIsInitializing] = useState(true);
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);

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

  function handleSelectDPP(did: string) {
    console.log('handleSelectDPP called with DID:', did);
    setCurrentDID(did);

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
    setView('dashboard');
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
    { value: 'Manufacturer' as const, label: 'Manufacturer' },
    { value: 'Recycler' as const, label: 'Recycler' },
    { value: 'Supervisor' as const, label: 'Supervisor' },
  ];

  return (
    <div className="relative">
      {/* Role selector dropdown */}
      <div className="fixed top-4 left-4 z-50">
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
                  className={`w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors ${
                    currentRole === role.value ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-700'
                  }`}
                >
                  {role.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {isInitializing ? (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-gray-600">Loading data...</p>
          </div>
        </div>
      ) : (
        <>
          {view === 'dashboard' && (
            <EnhancedDashboard 
              onNavigate={handleSelectDPP} 
              onCreateDPP={currentRole === 'Manufacturer' ? handleCreateDPP : undefined}
            />
          )}
          
          {view === 'create-dpp' && (
            <>
              <EnhancedDashboard 
                onNavigate={handleSelectDPP} 
                onCreateDPP={currentRole === 'Manufacturer' ? handleCreateDPP : undefined}
              />
              <CreateDPPForm onClose={handleBack} onComplete={handleDPPCreated} />
            </>
          )}
          
          {view === 'dpp-main' && (
            <MainDPPView did={currentDID} onBack={handleBack} onNavigate={handleSelectDPP} />
          )}

          {view === 'dpp-component' && (
            <MainDPPView did={currentDID} onBack={handleBack} onNavigate={handleSelectDPP} />
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
