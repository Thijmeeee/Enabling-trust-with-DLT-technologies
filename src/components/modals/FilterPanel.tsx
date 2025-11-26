import { useState, useEffect } from 'react';
import { Search, Filter, X, ChevronDown, Square, Maximize, ArrowUpDown } from 'lucide-react';
import { PRODUCT_SCHEMAS } from '../../lib/schemas/productSchema';

type FilterPanelProps = {
  onFilterChange: (filters: FilterState) => void;
  stats?: {
    byProductType: Record<string, number>;
    byStatus: Record<string, number>;
  };
};

export type FilterState = {
  text: string;
  type: 'all' | 'main' | 'component';
  productType: string;
  componentSubType: 'glass' | 'frame' | '';
  status: string;
  owner: string;
  sortBy: 'date' | 'name' | 'trustScore' | 'warranty';
  sortOrder: 'asc' | 'desc';
};

export function FilterPanel({ onFilterChange, stats }: FilterPanelProps) {
  const [filters, setFilters] = useState<FilterState>({
    text: '',
    type: 'all',
    productType: '',
    componentSubType: '',
    status: '',
    owner: '',
    sortBy: 'date',
    sortOrder: 'desc',
  });
  
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  useEffect(() => {
    const debounce = setTimeout(() => {
      onFilterChange(filters);
    }, 300);
    
    return () => clearTimeout(debounce);
  }, [filters, onFilterChange]);
  
  const updateFilter = (key: keyof FilterState, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };
  
  const clearFilters = () => {
    setFilters({
      text: '',
      type: 'all',
      productType: '',
      componentSubType: '',
      status: '',
      owner: '',
      sortBy: 'date',
      sortOrder: 'desc',
    });
  };
  
  const activeFilterCount = Object.entries(filters).filter(([key, value]) => 
    key !== 'text' && key !== 'sortBy' && key !== 'sortOrder' && value && value !== 'all'
  ).length;
  
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={filters.text}
          onChange={(e) => updateFilter('text', e.target.value)}
          placeholder="Search by model, dimensions, batch number..."
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>
      
      {/* Quick Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">Type:</span>
          {['all', 'main', 'component'].map((type) => (
            <button
              key={type}
              onClick={() => {
                updateFilter('type', type);
                if (type !== 'component') {
                  updateFilter('componentSubType', '');
                }
              }}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                filters.type === type
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {type === 'all' ? 'All' : type === 'main' ? 'Main' : 'Component'}
            </button>
          ))}
        </div>
        
        {/* Component Sub-Type Filter (only visible when type is 'component') */}
        {filters.type === 'component' && (
          <div className="flex items-center gap-2 pl-4 border-l border-gray-300">
            <button
              onClick={() => updateFilter('componentSubType', 'glass')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                filters.componentSubType === 'glass'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Square className="w-3.5 h-3.5" />
              Glass
            </button>
            <button
              onClick={() => updateFilter('componentSubType', 'frame')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                filters.componentSubType === 'frame'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Maximize className="w-3.5 h-3.5" />
              Frame
            </button>
            {filters.componentSubType && (
              <button
                onClick={() => updateFilter('componentSubType', '')}
                className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:text-gray-800"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
        
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="ml-auto flex items-center gap-1 px-3 py-1 text-sm font-medium text-gray-700 hover:text-gray-900"
        >
          <Filter className="w-4 h-4" />
          Advanced
          {activeFilterCount > 0 && (
            <span className="ml-1 px-2 py-0.5 bg-blue-600 text-white rounded-full text-xs">
              {activeFilterCount}
            </span>
          )}
          <ChevronDown className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
        </button>
        
        {activeFilterCount > 0 && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 px-3 py-1 text-sm text-red-600 hover:text-red-700"
          >
            <X className="w-4 h-4" />
            Remove filters
          </button>
        )}
      </div>
      
      {/* Advanced Filters */}
      {showAdvanced && (
        <div className="space-y-4 pt-4 border-t border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Product Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Product Type
              </label>
              <select
                value={filters.productType}
                onChange={(e) => updateFilter('productType', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All types</option>
                {Object.keys(PRODUCT_SCHEMAS).map((type) => (
                  <option key={type} value={type}>
                    {PRODUCT_SCHEMAS[type].name}
                    {stats?.byProductType[type] && ` (${stats.byProductType[type]})`}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Lifecycle Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Lifecycle Status
              </label>
              <select
                value={filters.status}
                onChange={(e) => updateFilter('status', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="installed">Installed</option>
                <option value="storage">Storage</option>
                <option value="archived">Archived</option>
                <option value="manufactured">Manufactured</option>
                <option value="in_transit">In Transit</option>
                <option value="maintenance">Maintenance</option>
                <option value="end_of_life">End of Life</option>
              </select>
            </div>
            
            {/* Owner */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Owner
              </label>
              <input
                type="text"
                value={filters.owner}
                onChange={(e) => updateFilter('owner', e.target.value)}
                placeholder="Filter by owner DID..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Sort Options */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sort By
              </label>
              <select
                value={filters.sortBy}
                onChange={(e) => updateFilter('sortBy', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="date">Date Created</option>
                <option value="name">Product Name</option>
                <option value="trustScore">Trust Score</option>
                <option value="warranty">Warranty Status</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sort Order
              </label>
              <select
                value={filters.sortOrder}
                onChange={(e) => updateFilter('sortOrder', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="desc">Newest First</option>
                <option value="asc">Oldest First</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
