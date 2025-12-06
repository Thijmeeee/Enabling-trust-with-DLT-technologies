import { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Users, 
  CheckCircle, 
  AlertTriangle, 
  Clock,
  Package,
  TrendingUp,
  Filter,
  Search,
  Eye,
  Calendar,
  Download,
  FileText,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { enhancedDB } from '../../lib/data/enhancedDataStore';
import type { DPP } from '../../lib/data/localData';

interface SupervisorDashboardProps {
  onNavigate: (did: string) => void;
}

export default function SupervisorDashboard({ onNavigate }: SupervisorDashboardProps) {
  const [dpps, setDpps] = useState<DPP[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'pending'>('all');
  const [stats, setStats] = useState({
    total: 0,
    today: 0,
    thisWeek: 0,
    activeOperators: 0,
    pendingValidation: 0,
    yesterdayCount: 0
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const allDpps = await enhancedDB.getAllDPPs();
      setDpps(allDpps);

      // Calculate stats
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

      const todayCount = allDpps.filter(dpp => new Date(dpp.created_at) >= today).length;
      const weekCount = allDpps.filter(dpp => new Date(dpp.created_at) >= weekAgo).length;
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      const yesterdayCount = allDpps.filter(dpp => {
        const created = new Date(dpp.created_at);
        return created >= yesterday && created < today;
      }).length;

      setStats({
        total: allDpps.length,
        today: todayCount,
        thisWeek: weekCount,
        activeOperators: 3, // Mock
        pendingValidation: Math.floor(allDpps.length * 0.05), // Mock: 5% pending
        yesterdayCount
      });
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredDpps = dpps.filter(dpp => {
    const matchesSearch = dpp.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
      dpp.did.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === 'all' || dpp.lifecycle_status === filterStatus;
    return matchesSearch && matchesFilter;
  }).slice(0, 20);

  return (
    <div className="min-h-screen bg-red-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-700 to-red-800 text-white">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Production Control Center</h1>
              <p className="text-red-100">Production overview and quality control</p>
            </div>
            <div className="flex items-center gap-2 text-sm text-red-100">
              <Calendar className="w-4 h-4" />
              {new Date().toLocaleDateString('en-US', { 
                weekday: 'long', 
                day: 'numeric', 
                month: 'long' 
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* KPI Cards with Trends */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <div className="bg-white rounded-xl p-5 border border-red-200 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <Package className="w-8 h-8 text-red-600" />
              <span className="text-xs font-medium text-gray-400">TOTAL</span>
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
            <p className="text-sm text-gray-500">Products</p>
          </div>

          <div className="bg-white rounded-xl p-5 border border-red-200 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <TrendingUp className="w-8 h-8 text-green-600" />
              <span className="flex items-center gap-1 text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                {stats.today >= stats.yesterdayCount ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                {stats.today >= stats.yesterdayCount ? '+' : ''}{stats.today - stats.yesterdayCount}
              </span>
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats.today}</p>
            <p className="text-sm text-gray-500">Today</p>
          </div>

          <div className="bg-white rounded-xl p-5 border border-red-200 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <BarChart3 className="w-8 h-8 text-red-600" />
              <span className="text-xs font-medium text-gray-400">7 DAYS</span>
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats.thisWeek}</p>
            <p className="text-sm text-gray-500">This Week</p>
          </div>

          <div className="bg-white rounded-xl p-5 border border-red-200 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <Users className="w-8 h-8 text-red-600" />
              <span className="text-xs font-medium text-green-600">●</span>
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats.activeOperators}</p>
            <p className="text-sm text-gray-500">Active Workers</p>
          </div>

          <div className="bg-white rounded-xl p-5 border border-red-200 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <AlertTriangle className="w-8 h-8 text-yellow-600" />
              {stats.pendingValidation > 0 && (
                <span className="text-xs font-medium text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded-full">Action</span>
              )}
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats.pendingValidation}</p>
            <p className="text-sm text-gray-500">Pending Validation</p>
          </div>
        </div>

        {/* Action Center */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <button 
            onClick={() => {
              const blob = new Blob([JSON.stringify(dpps, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `production-report-${new Date().toISOString().split('T')[0]}.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white py-3 px-4 rounded-xl transition-colors font-medium"
          >
            <Download className="w-5 h-5" />
            Export Report
          </button>
          <button 
            onClick={() => alert('Quality audit scheduled!')}
            className="flex items-center justify-center gap-2 bg-white border border-red-200 hover:bg-red-50 text-red-700 py-3 px-4 rounded-xl transition-colors font-medium"
          >
            <CheckCircle className="w-5 h-5" />
            Schedule Audit
          </button>
          <button 
            onClick={() => alert('Opening compliance dashboard...')}
            className="flex items-center justify-center gap-2 bg-white border border-red-200 hover:bg-red-50 text-red-700 py-3 px-4 rounded-xl transition-colors font-medium"
          >
            <FileText className="w-5 h-5" />
            Compliance
          </button>
          <button 
            onClick={() => window.print()}
            className="flex items-center justify-center gap-2 bg-white border border-red-200 hover:bg-red-50 text-red-700 py-3 px-4 rounded-xl transition-colors font-medium"
          >
            <BarChart3 className="w-5 h-5" />
            Print Summary
          </button>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Product List */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-red-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-red-100">
              <div className="flex items-center gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by model or DID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-gray-400" />
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value as 'all' | 'active' | 'pending')}
                    className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500"
                  >
                    <option value="all">All</option>
                    <option value="active">Active</option>
                    <option value="pending">Pending</option>
                  </select>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto"></div>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
                {filteredDpps.map((dpp) => (
                  <button
                    key={dpp.id}
                    onClick={() => onNavigate(dpp.did)}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-red-50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${
                        dpp.lifecycle_status === 'active' ? 'bg-green-500' : 'bg-yellow-500'
                      }`} />
                      <div>
                        <p className="font-medium text-gray-900">{dpp.model}</p>
                        <p className="text-xs text-gray-500 font-mono">{dpp.did.slice(0, 40)}...</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        dpp.type === 'main' 
                          ? 'bg-red-100 text-red-700' 
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {dpp.type === 'main' ? 'Main Product' : 'Component'}
                      </span>
                      <Eye className="w-4 h-4 text-gray-400" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Activity Feed */}
          <div className="bg-white rounded-xl border border-red-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-red-100">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-red-500" />
                Recent Activity
              </h3>
            </div>
            <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
              {dpps.slice(0, 10).map((dpp, index) => (
                <div key={dpp.id} className="px-4 py-3">
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      index === 0 ? 'bg-green-100' : 'bg-gray-100'
                    }`}>
                      <CheckCircle className={`w-4 h-4 ${
                        index === 0 ? 'text-green-600' : 'text-gray-400'
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 truncate">{dpp.model} registered</p>
                      <p className="text-xs text-gray-500">
                        {new Date(dpp.created_at).toLocaleString('en-US', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
