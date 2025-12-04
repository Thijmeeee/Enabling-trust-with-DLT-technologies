import { useState, useEffect, useCallback } from 'react';
import { Package, RefreshCw, Grid, List as ListIcon } from 'lucide-react';
import { enhancedDB } from '../../lib/data/enhancedDataStore';
import { FilterPanel, FilterState } from '../modals/FilterPanel';
import { DPPCard } from '../dpp/DPPCard';
import { generateMixedTestData } from '../../lib/operations/bulkOperations';
import type { DPP } from '../../lib/data/localData';

type ViewMode = 'grid' | 'list';

export default function EnhancedDashboard({ 
  onNavigate,
  onCreateDPP
}: { 
  onNavigate: (did: string) => void;
  onCreateDPP?: () => void;
}) {
  const [filteredDpps, setFilteredDpps] = useState<DPP[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const itemsPerPage = 20;
  
  useEffect(() => {
    loadData();
  }, []);
  
  const loadData = async () => {
    setLoading(true);
    const allDpps = await enhancedDB.getAllDPPs();
    const statsData = await enhancedDB.getStats();
    
    // Sort: main products first, then components
    const sorted = [...allDpps].sort((a, b) => {
      if (a.type === 'main' && b.type !== 'main') return -1;
      if (a.type !== 'main' && b.type === 'main') return 1;
      return 0;
    });
    
    setFilteredDpps(sorted);
    setStats(statsData);
    setTotalResults(sorted.length);
    setLoading(false);
  };
  
  const handleFilterChange = useCallback(async (filters: FilterState) => {
    setLoading(true);
    
    const query: any = {};
    
    if (filters.text) query.text = filters.text;
    if (filters.type !== 'all') query.type = filters.type;
    if (filters.productType) query.productType = filters.productType;
    if (filters.componentSubType) query.componentSubType = filters.componentSubType;
    if (filters.status) query.status = filters.status;
    if (filters.owner) query.owner = filters.owner;
    
    query.limit = itemsPerPage;
    query.offset = (currentPage - 1) * itemsPerPage;
    
    const result = await enhancedDB.searchDPPs(query);
    
    // Sort: main products first, then components
    const sorted = [...result.dpps].sort((a, b) => {
      if (a.type === 'main' && b.type !== 'main') return -1;
      if (a.type !== 'main' && b.type === 'main') return 1;
      return 0;
    });
    
    setFilteredDpps(sorted);
    setTotalResults(result.total);
    setLoading(false);
  }, [currentPage]);
  
  const handleGenerateTestData = async () => {
    if (!confirm('This will generate 90 test products. Continue?')) return;
    
    setLoading(true);
    try {
      await generateMixedTestData();
      await loadData();
      alert('Test data generated successfully!');
    } catch (error) {
      alert('Error generating data: ' + error);
    }
    setLoading(false);
  };
  
  const handleClearAll = async () => {
    if (!confirm('DELETE ALL data? This cannot be undone!')) return;
    
    await enhancedDB.clearAll();
    await loadData();
  };
  
  const totalPages = Math.ceil(totalResults / itemsPerPage);
  
  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <Package className="w-8 h-8 text-blue-600" />
                 Product DPP Dashboard
              </h1>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center gap-2"
              >
                {viewMode === 'grid' ? <ListIcon className="w-4 h-4" /> : <Grid className="w-4 h-4" />}
                {viewMode === 'grid' ? 'List' : 'Grid'}
              </button>
              
              {onCreateDPP && (
                <button
                  onClick={onCreateDPP}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2"
                >
                  <Package className="w-4 h-4" />
                  Create DPP
                </button>
              )}
              
              <button
                onClick={handleGenerateTestData}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Test Data
              </button>
            </div>
          </div>
          
          {/* Stats */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-sm text-blue-600 font-medium">Total DPPs</p>
                <p className="text-2xl font-bold text-blue-900">{stats.totalDPPs}</p>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <p className="text-sm text-green-600 font-medium">Main Products</p>
                <p className="text-2xl font-bold text-green-900">{stats.mainProducts}</p>
              </div>
              <div className="bg-purple-50 rounded-lg p-4">
                <p className="text-sm text-purple-600 font-medium">Components</p>
                <p className="text-2xl font-bold text-purple-900">{stats.components}</p>
              </div>
              <div className="bg-orange-50 rounded-lg p-4">
                <p className="text-sm text-orange-600 font-medium">Product Types</p>
                <p className="text-2xl font-bold text-orange-900">
                  {Object.keys(stats.byProductType).length}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Filters */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <FilterPanel onFilterChange={handleFilterChange} stats={stats} />
      </div>
      
      {/* Results */}
      <div className="max-w-7xl mx-auto px-4 pb-6">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-600">
            {totalResults} results found
            {totalResults !== stats?.totalDPPs && ` (filtered from ${stats?.totalDPPs})`}
          </p>
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="text-sm text-gray-600">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          )}
        </div>
        
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredDpps.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <Package className="w-16 h-16 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600 mb-4">No DPPs found</p>
            <button
              onClick={handleGenerateTestData}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
            >
              Generate test data
            </button>
          </div>
        ) : (
          <div className={viewMode === 'grid' 
            ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
            : 'space-y-2'
          }>
            {filteredDpps.map((dpp) => (
              <DPPCard
                key={dpp.id}
                dpp={dpp}
                onClick={() => onNavigate(dpp.did)}
                viewMode={viewMode}
              />
            ))}
          </div>
        )}
      </div>
      
      {/* Debug Actions */}
      <div className="max-w-7xl mx-auto px-4 pb-6">
        <button
          onClick={handleClearAll}
          className="text-sm text-red-600 hover:text-red-700 underline"
        >
          Clear all data (debug)
        </button>
      </div>
    </div>
  );
}
