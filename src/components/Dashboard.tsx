import { useState, useEffect, useCallback } from 'react';
import { Search, AlertCircle, Plus, User } from 'lucide-react';
import { searchDPPs } from '../lib/dppManagerLocal';
import type { DPP } from '../lib/localData';
import DPPListItem from './DPPListItem';
import { useRole, UserRole } from '../lib/roleContext';
import CreateDPPForm from './CreateDPPForm';

export default function Dashboard({ onSelectDPP }: { onSelectDPP: (did: string) => void }) {
  const { currentRole, setRole } = useRole();
  const [dpps, setDpps] = useState<DPP[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'main' | 'component'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'replaced'>('all');
  const [stats, setStats] = useState({ total: 0, main: 0, components: 0, active: 0 });
  const [offset, setOffset] = useState(0);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const limit = 50;

  const loadDPPs = useCallback(async () => {
    setLoading(true);
    const filters: {
      searchTerm?: string;
      type?: 'main' | 'component';
      status?: string;
      limit: number;
      offset: number;
    } = { limit, offset };

    if (searchTerm) filters.searchTerm = searchTerm;
    if (filterType !== 'all') filters.type = filterType;
    if (filterStatus !== 'all') filters.status = filterStatus;

    console.log('Loading DPPs with filters:', filters);
    const result = await searchDPPs(filters);
    console.log('Search result:', result);
    
    const sortedData = result.data.sort((a, b) => {
      if (a.type === 'main' && b.type === 'component') return -1;
      if (a.type === 'component' && b.type === 'main') return 1;
      return 0;
    });
    
    setDpps(sortedData);

    const allResult = await searchDPPs({ limit: 10000 });
    console.log('All DPPs for stats:', allResult);
    const mainCount = allResult.data.filter((d) => d.type === 'main').length;
    const componentCount = allResult.data.filter((d) => d.type === 'component').length;
    const activeCount = allResult.data.filter((d) => d.lifecycle_status === 'active').length;

    setStats({
      total: allResult.count,
      main: mainCount,
      components: componentCount,
      active: activeCount,
    });

    setLoading(false);
  }, [searchTerm, filterType, filterStatus, offset, limit]);

  useEffect(() => {
    console.log('Dashboard effect triggered, loading DPPs...');
    loadDPPs();
  }, [loadDPPs]);

  useEffect(() => {
    // Reset offset when filters change
    setOffset(0);
  }, [searchTerm, filterType, filterStatus]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Role Selector - Absolute Top Left */}
      <div className="fixed top-4 left-4 z-50 flex items-center gap-2">
        <div className="bg-blue-600 p-2 rounded-lg shadow-lg">
          <User className="w-5 h-5 text-white" />
        </div>
        <select
          value={currentRole}
          onChange={(e) => setRole(e.target.value as UserRole)}
          className="px-4 py-2 bg-blue-600 border-2 border-blue-400 rounded-lg text-white font-semibold hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300 cursor-pointer shadow-lg"
        >
          <option value="Operator">👷 Operator</option>
          <option value="Recycler">♻️ Recycler</option>
          <option value="Fabrikant">🏭 Fabrikant</option>
          <option value="Supervisor">👁️ Supervisor</option>
        </select>
      </div>

      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white border-b border-blue-700">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-4xl font-bold mb-2">Digital Product Passport System</h1>
              <div className="flex items-center gap-3 text-blue-100">
                <div className="px-4 py-2 bg-blue-700 rounded-lg font-mono font-semibold">
                  DID:webvh Protocol
                </div>
                <span className="text-sm">Decentralized Identifier-based Product Verification</span>
              </div>
            </div>
            <div className="flex gap-4 items-center">
              {currentRole === 'Manufacturer' && (
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 font-semibold shadow-lg"
                >
                  <Plus size={20} />
                  Create New DPP
                </button>
              )}
              
              <button
                onClick={async () => {
                  if (confirm('Are you sure you want to reset the database? This will delete all data and regenerate mock data.')) {
                    localStorage.clear();
                    window.location.reload();
                  }
                }}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2 font-semibold shadow-lg"
                title="Clear database and regenerate mock data"
              >
                🔄 Reset Database
              </button>
              
              <div className="flex gap-4">
                <div className="text-center bg-blue-700 rounded-lg px-4 py-3">
                  <div className="text-3xl font-bold">{stats.total}</div>
                  <div className="text-xs text-blue-200">Total DPPs</div>
                </div>
                <div className="text-center bg-blue-700 rounded-lg px-4 py-3">
                  <div className="text-3xl font-bold">{stats.main}</div>
                  <div className="text-xs text-blue-200">Main Products</div>
                </div>
                <div className="text-center bg-green-600 rounded-lg px-4 py-3">
                  <div className="text-3xl font-bold">{stats.components}</div>
                  <div className="text-xs text-green-200">Components</div>
                </div>
                <div className="text-center bg-emerald-600 rounded-lg px-4 py-3">
                  <div className="text-3xl font-bold">{stats.active}</div>
                  <div className="text-xs text-emerald-200">Active</div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-4 items-center">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by DID, model, or owner..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setOffset(0);
                }}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
              />
            </div>

            <div className="flex gap-2">
              <select
                value={filterType}
                onChange={(e) => {
                  setFilterType(e.target.value as 'all' | 'main' | 'component');
                  setOffset(0);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
              >
                <option value="all">All Types</option>
                <option value="main">Main Products</option>
                <option value="component">Components</option>
              </select>

              <select
                value={filterStatus}
                onChange={(e) => {
                  setFilterStatus(e.target.value as 'all' | 'active' | 'replaced');
                  setOffset(0);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="replaced">Replaced</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="text-gray-500 mt-4">Loading DPPs...</p>
          </div>
        ) : dpps.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <AlertCircle className="mx-auto h-12 w-12 text-gray-400" />
            <p className="text-gray-500 mt-4">No DPPs found</p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {dpps.map((dpp) => (
                <DPPListItem key={dpp.id} dpp={dpp} onSelect={() => onSelectDPP(dpp.did)} />
              ))}
            </div>

            <div className="mt-6 flex justify-center gap-2">
              <button
                onClick={() => setOffset(Math.max(0, offset - limit))}
                disabled={offset === 0}
                className="px-4 py-2 bg-white border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Previous
              </button>
              <span className="px-4 py-2 text-gray-600">
                {offset + 1} - {Math.min(offset + limit, stats.total)} of {stats.total}
              </span>
              <button
                onClick={() => setOffset(offset + limit)}
                disabled={offset + limit >= stats.total}
                className="px-4 py-2 bg-white border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          </>
        )}
      </div>
      
      {showCreateForm && (
        <CreateDPPForm
          onClose={() => setShowCreateForm(false)}
          onComplete={() => {
            setShowCreateForm(false);
            loadDPPs(); // Reload the list
          }}
        />
      )}
    </div>
  );
}
