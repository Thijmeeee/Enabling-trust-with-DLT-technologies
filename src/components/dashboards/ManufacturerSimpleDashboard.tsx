import { useState, useEffect } from 'react';
import { Plus, Package, CheckCircle, Clock, ChevronRight, Copy } from 'lucide-react';
import { hybridDataStore as enhancedDB } from '../../lib/data/hybridDataStore';
import { useRole } from '../../lib/utils/roleContext';
import type { DPP } from '../../lib/data/localData';

interface ManufacturerSimpleDashboardProps {
  onRegisterWindow: () => void;
  onNavigate: (did: string) => void;
}

export default function ManufacturerSimpleDashboard({ onRegisterWindow, onNavigate }: ManufacturerSimpleDashboardProps) {
  const { currentRoleDID } = useRole();
  const [recentItems, setRecentItems] = useState<DPP[]>([]);
  const [loading, setLoading] = useState(true);
  const [todayCount, setTodayCount] = useState(0);

  useEffect(() => {
    loadRecentItems();
  }, [currentRoleDID]);

  async function loadRecentItems() {
    setLoading(true);
    try {
      const allDpps = await enhancedDB.getAllDPPs();

      // Filter for items owned by current manufacturer
      const myItems = allDpps.filter(dpp =>
        dpp.owner === currentRoleDID || dpp.custodian === currentRoleDID
      );

      // Get items created today
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const todayItems = myItems.filter(dpp => {
        const createdDate = new Date(dpp.created_at);
        return createdDate >= today;
      });

      setTodayCount(todayItems.length);

      // Get recent items (last 5 main products)
      const sorted = myItems
        .filter(dpp => dpp.type === 'main')
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5);

      setRecentItems(sorted);
    } catch (error) {
      console.error('Error loading recent items:', error);
    } finally {
      setLoading(false);
    }
  }

  const handleCopyDid = (e: React.MouseEvent, did: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(did);
    // Optional: Add toast or visual feedback here
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 pt-16 transition-colors">
      {/* Clean Header */}
      <div className="border-b border-gray-100 dark:border-gray-800 px-6 py-6">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Welcome, Manufacturer</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">What would you like to do today?</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8">
        {/* Main Action - Big Button */}
        <div className="mb-8">
          <button
            onClick={onRegisterWindow}
            className="w-full bg-gray-900 dark:bg-blue-600 hover:bg-gray-800 dark:hover:bg-blue-700 text-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all transform hover:scale-[1.02] active:scale-[0.98] border-2 border-gray-900 dark:border-blue-600"
          >
            <div className="flex flex-col items-center gap-4">
              <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center">
                <Plus className="w-10 h-10" />
              </div>
              <div className="text-center">
                <span className="text-2xl font-bold block">Register New Window</span>
                <span className="text-gray-300 dark:text-blue-200 text-sm mt-1 block">Click here to add a new product</span>
              </div>
            </div>
          </button>
        </div>

        {/* Today's Stats - Clean Card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border-2 border-gray-100 dark:border-gray-700 p-6 mb-8 shadow-sm transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                <CheckCircle className="w-7 h-7 text-gray-700 dark:text-gray-300" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Registered Today</p>
                <p className="text-4xl font-bold text-gray-900 dark:text-white">{todayCount}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Items - Clean List */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border-2 border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden transition-colors">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-gray-400 dark:text-gray-500" />
              Recently Added
            </h2>
          </div>

          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white mx-auto"></div>
            </div>
          ) : recentItems.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              <Package className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
              <p className="font-medium">No products registered yet.</p>
              <p className="text-sm">Click the button above to get started!</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {recentItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.did)}
                  className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                      <Package className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{item.model}</p>

                      {/* DID Display with Copy Button */}
                      <div className="flex items-center gap-2 mt-1 mb-1">
                        <span className="text-xs text-gray-500 dark:text-gray-400 font-mono bg-gray-50 dark:bg-gray-700 px-1.5 py-0.5 rounded border border-gray-100 dark:border-gray-600 flex items-center">
                          {item.did.length > 20 ? `...${item.did.slice(-8)}` : item.did}
                        </span>
                        <button
                          onClick={(e) => handleCopyDid(e, item.did)}
                          className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-full transition-colors"
                          title="Copy DID"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>

                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {new Date(item.created_at).toLocaleString('en-US', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
