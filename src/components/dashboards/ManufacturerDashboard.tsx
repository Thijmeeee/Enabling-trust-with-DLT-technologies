import { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Package,
  Box,
  RefreshCw,
  Wallet,
  TrendingUp,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Filter,
  Check,
  Trash2
} from 'lucide-react';
import { enhancedDB } from '../../lib/data/enhancedDataStore';
import { DPPCard } from '../dpp/DPPCard';
import type { DPP } from '../../lib/data/localData';
import { useRole } from '../../lib/utils/roleContext';

interface ManufacturerDashboardProps {
  onNavigate: (did: string, fromView?: string) => void;
  onCreateDPP?: () => void;
  onBack: () => void;
  onClose?: () => void;
}

export default function ManufacturerDashboard({ onNavigate, onBack, onCreateDPP, onClose }: ManufacturerDashboardProps) {
  const { currentRoleDID } = useRole();
  const [products, setProducts] = useState<DPP[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    recycled: 0
  });

  // Filter states
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    // Fetch all DPPs and filter client-side to ensure we catch all manufacturer items
    const allDpps = await enhancedDB.getAllDPPs();

    // Filter for items owned by the current user
    const myProducts = allDpps.filter(dpp =>
      dpp.owner === currentRoleDID || dpp.custodian === currentRoleDID
    );

    // Calculate stats
    const active = myProducts.filter(p => p.lifecycle_status === 'active').length;
    const recycled = myProducts.filter(p => p.lifecycle_status === 'recycled').length;

    setProducts(myProducts);
    setStats({
      total: myProducts.length,
      active,
      recycled
    });
    setLoading(false);
  }, [currentRoleDID]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleResetData = async () => {
    if (window.confirm('Are you sure you want to reset all data? This will delete all existing products and generate new test data with updated DIDs.')) {
      setLoading(true);
      try {
        // Clear existing data (this is a bit hacky, ideally we'd have a clear method)
        // Since we don't have a clear method exposed, we'll just rely on the fact that
        // generateMixedTestData doesn't clear, but we can manually delete the DB or 
        // just append. Wait, we need to clear.
        // Let's try to delete the database using indexedDB API directly as a fallback

        const req = indexedDB.deleteDatabase('dpp-enhanced-db');
        req.onsuccess = async () => {
          console.log('Database deleted successfully');
          window.location.reload(); // Reload to re-initialize
        };
        req.onerror = () => {
          console.error('Error deleting database');
          setLoading(false);
        };
      } catch (error) {
        console.error('Error resetting data:', error);
        setLoading(false);
      }
    }
  };

  // Extract unique values for filters
  const availableTypes = Array.from(new Set(products.map(p => p.metadata.productType as string || 'Other'))).sort((a, b) => {
    if (a.toLowerCase() === 'window') return -1;
    if (b.toLowerCase() === 'window') return 1;
    return a.localeCompare(b);
  });
  const availableStatuses = Array.from(new Set(products.map(p => p.lifecycle_status))).sort();

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.did.toLowerCase().includes(searchTerm.toLowerCase());

    const type = p.metadata.productType as string || 'Other';
    const matchesType = selectedTypes.length === 0 || selectedTypes.includes(type);

    const matchesStatus = selectedStatuses.length === 0 || selectedStatuses.includes(p.lifecycle_status);

    return matchesSearch && matchesType && matchesStatus;
  });

  const toggleType = (type: string) => {
    setSelectedTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
    setCurrentPage(1);
  };

  const toggleStatus = (status: string) => {
    setSelectedStatuses(prev =>
      prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
    );
    setCurrentPage(1);
  };

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      {/* Top Navigation / Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3 ml-72">
              <button
                onClick={onClose ? onClose : onBack}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors mr-2"
                title="Back to Dashboard"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div className="p-2 bg-blue-100 rounded-lg">
                <Wallet className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Manufacturer Wallet</h1>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleResetData}
                className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-red-200"
                title="Reset all data and regenerate with new DIDs"
              >
                <Trash2 className="w-4 h-4" />
                <span className="hidden sm:inline">Reset Data</span>
              </button>
              {onCreateDPP && (
                <button
                  onClick={onCreateDPP}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                >
                  <Package className="w-4 h-4" />
                  <span>New Product</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-blue-50 rounded-lg">
                <Package className="w-6 h-6 text-blue-600" />
              </div>
              <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-full">Total Assets</span>
            </div>
            <div className="text-3xl font-bold text-gray-900">{stats.total}</div>
            <p className="text-sm text-gray-500 mt-1">Registered products</p>
          </div>

          <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-green-50 rounded-lg">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
              <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">Active</span>
            </div>
            <div className="text-3xl font-bold text-gray-900">{stats.active}</div>
            <p className="text-sm text-gray-500 mt-1">Currently in circulation</p>
          </div>

          <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-purple-50 rounded-lg">
                <RefreshCw className="w-6 h-6 text-purple-600" />
              </div>
              <span className="text-xs font-medium text-purple-600 bg-purple-50 px-2 py-1 rounded-full">Recycled</span>
            </div>
            <div className="text-3xl font-bold text-gray-900">{stats.recycled}</div>
            <p className="text-sm text-gray-500 mt-1">Processed end-of-life</p>
          </div>
        </div>

        {/* Main Content Layout */}
        <div className="flex flex-col lg:flex-row gap-8">

          {/* Sidebar Filters */}
          <div className="w-full lg:w-64 flex-shrink-0 space-y-8">
            {/* Search (Mobile only, or keep in sidebar?) - Keeping main search above, this is filter sidebar */}

            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4 text-gray-900 font-semibold">
                <Filter className="w-4 h-4" />
                Filters
              </div>

              {/* Product Type Filter */}
              <div className="mb-6">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Product Type</h3>
                <div className="space-y-2">
                  {availableTypes.map(type => (
                    <label key={type} className="flex items-center gap-3 cursor-pointer group">
                      <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${selectedTypes.includes(type)
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'border-gray-300 group-hover:border-blue-400 bg-white'
                        }`}>
                        {selectedTypes.includes(type) && <Check className="w-3 h-3" />}
                      </div>
                      <input
                        type="checkbox"
                        className="hidden"
                        checked={selectedTypes.includes(type)}
                        onChange={() => toggleType(type)}
                      />
                      <span className="text-sm text-gray-700 group-hover:text-gray-900 capitalize">{type}</span>
                      <span className="ml-auto text-xs text-gray-400">
                        {products.filter(p => (p.metadata.productType as string || 'Other') === type).length}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Status Filter */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Status</h3>
                <div className="space-y-2">
                  {availableStatuses.map(status => (
                    <label key={status} className="flex items-center gap-3 cursor-pointer group">
                      <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${selectedStatuses.includes(status)
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'border-gray-300 group-hover:border-blue-400 bg-white'
                        }`}>
                        {selectedStatuses.includes(status) && <Check className="w-3 h-3" />}
                      </div>
                      <input
                        type="checkbox"
                        className="hidden"
                        checked={selectedStatuses.includes(status)}
                        onChange={() => toggleStatus(status)}
                      />
                      <span className="text-sm text-gray-700 group-hover:text-gray-900 capitalize">{status}</span>
                      <span className="ml-auto text-xs text-gray-400">
                        {products.filter(p => p.lifecycle_status === status).length}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Product List Area */}
          <div className="flex-1">
            {/* Search Bar */}
            <div className="relative mb-6">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by Model or DID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm"
              />
            </div>

            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-xl border border-gray-200 border-dashed">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-50 rounded-full mb-4">
                  <Box className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-1">No products found</h3>
                <p className="text-gray-500 mb-6">Try adjusting your filters or search terms.</p>
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setSelectedTypes([]);
                    setSelectedStatuses([]);
                  }}
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  Clear all filters
                </button>
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-3">
                  {paginatedProducts.map((dpp) => (
                    <div key={dpp.id} className="group relative">
                      <DPPCard
                        dpp={dpp}
                        onClick={() => onNavigate(dpp.did, 'manufacturer-wallet')}
                        viewMode="list"
                      />
                    </div>
                  ))}
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between border-t border-gray-200 mt-6 pt-6">
                    <div className="text-sm text-gray-500">
                      Showing <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> to{' '}
                      <span className="font-medium">
                        {Math.min(currentPage * itemsPerPage, filteredProducts.length)}
                      </span>{' '}
                      of <span className="font-medium">{filteredProducts.length}</span> results
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="flex items-center gap-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        Previous
                      </button>
                      <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="flex items-center gap-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
