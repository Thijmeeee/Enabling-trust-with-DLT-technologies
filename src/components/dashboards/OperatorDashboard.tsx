import { useState, useEffect } from 'react';
import { Plus, Package, CheckCircle, Clock, ChevronRight } from 'lucide-react';
import { hybridDataStore as enhancedDB } from '../../lib/data/hybridDataStore';
import { useRole } from '../../lib/utils/roleContext';
import type { DPP } from '../../lib/data/localData';

interface OperatorDashboardProps {
  onRegisterWindow: () => void;
  onNavigate: (did: string) => void;
}

export default function OperatorDashboard({ onRegisterWindow, onNavigate }: OperatorDashboardProps) {
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

      // Get items created today
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const todayItems = allDpps.filter(dpp => {
        const createdDate = new Date(dpp.created_at);
        return createdDate >= today;
      });

      setTodayCount(todayItems.length);

      // Get recent items (last 5)
      const sorted = allDpps
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5);

      setRecentItems(sorted);
    } catch (error) {
      console.error('Error loading recent items:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Simple Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900">Welkom, Operator</h1>
          <p className="text-gray-600 mt-1">Wat wilt u vandaag doen?</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8">
        {/* Main Action - Big Button */}
        <div className="mb-8">
          <button
            onClick={onRegisterWindow}
            className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all transform hover:scale-[1.02] active:scale-[0.98]"
          >
            <div className="flex flex-col items-center gap-4">
              <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center">
                <Plus className="w-10 h-10" />
              </div>
              <div className="text-center">
                <span className="text-2xl font-bold block">Nieuw Kozijn Registreren</span>
                <span className="text-blue-100 text-sm mt-1 block">Klik hier om een nieuw product toe te voegen</span>
              </div>
            </div>
          </button>
        </div>

        {/* Today's Stats - Simple */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Vandaag geregistreerd</p>
                <p className="text-3xl font-bold text-gray-900">{todayCount}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Goed bezig! 👍</p>
            </div>
          </div>
        </div>

        {/* Recent Items - Simple List */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-gray-400" />
              Recent Toegevoegd
            </h2>
          </div>

          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            </div>
          ) : recentItems.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>Nog geen producten geregistreerd.</p>
              <p className="text-sm">Klik op de knop hierboven om te beginnen!</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {recentItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.did)}
                  className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Package className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{item.model}</p>
                      <p className="text-sm text-gray-500">
                        {new Date(item.created_at).toLocaleString('nl-NL', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Help Text */}
        <p className="text-center text-gray-400 text-sm mt-8">
          Need help? Contact system support.
        </p>
      </div>
    </div>
  );
}
