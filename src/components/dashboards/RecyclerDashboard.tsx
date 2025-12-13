import { useState, useEffect } from 'react';
import {
  Search,
  QrCode,
  Package,
  Layers,
  Square,
  AlertTriangle,
  CheckCircle,
  Recycle,
  ArrowRight,
  ArrowLeft,
  Info,
  Trash2
} from 'lucide-react';
import { enhancedDB } from '../../lib/data/enhancedDataStore';
import type { DPP } from '../../lib/data/localData';

interface RecyclerDashboardProps {
  onNavigate: (did: string) => void;
}

export default function RecyclerDashboard({ onNavigate }: RecyclerDashboardProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState<DPP | null>(null);
  const [components, setComponents] = useState<DPP[]>([]);
  const [searching, setSearching] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [allWindows, setAllWindows] = useState<DPP[]>([]);
  const [isRecycling, setIsRecycling] = useState(false);

  useEffect(() => {
    loadAllWindows();
  }, []);

  async function loadAllWindows() {
    try {
      const allDpps = await enhancedDB.getAllDPPs();
      // Show all main products (windows), sorted by model number (Window 1, Window 2, etc.)
      const mainProducts = allDpps
        .filter(dpp => dpp.type === 'main')
        .sort((a, b) => {
          // Extract number from model name (e.g., "Window 1" -> 1)
          const numA = parseInt(a.model.match(/\d+/)?.[0] || '0');
          const numB = parseInt(b.model.match(/\d+/)?.[0] || '0');
          return numA - numB; // Sort ascending (1, 2, 3...)
        });
      setAllWindows(mainProducts);
    } catch (error) {
      console.error('Error loading windows:', error);
    }
  }

  async function handleSearch() {
    if (!searchQuery.trim()) return;

    setSearching(true);
    setNotFound(false);
    setSearchResult(null);
    setComponents([]);

    try {
      // Search by DID or model name
      const allDpps = await enhancedDB.getAllDPPs();

      const found = allDpps.find(dpp =>
        dpp.did.toLowerCase().includes(searchQuery.toLowerCase()) ||
        dpp.model.toLowerCase().includes(searchQuery.toLowerCase())
      );

      if (found) {
        setSearchResult(found);

        // If it's a main product, get its components
        if (found.type === 'main') {
          const relationships = await enhancedDB.getRelationshipsByParent(found.did);
          const componentDids = relationships.map(r => r.child_did);
          const componentDpps = allDpps.filter(dpp => componentDids.includes(dpp.did));
          setComponents(componentDpps);
        }
      } else {
        setNotFound(true);
      }
    } catch (error) {
      console.error('Error searching:', error);
      setNotFound(true);
    } finally {
      setSearching(false);
    }
  }

  function getMaterialInfo(dpp: DPP) {
    const productType = (dpp.metadata?.productType as string || '').toLowerCase();

    if (productType.includes('glass')) {
      const thickness = dpp.metadata?.thickness || '4mm';
      return {
        icon: Layers,
        material: 'Glass',
        recyclable: true,
        instructions: `Glass container - Thickness: ${thickness}. Ensure no frame residue attached`,
        color: 'sky',
        thickness
      };
    }

    if (productType.includes('frame')) {
      const material = (dpp.metadata?.material as string || 'Aluminium');
      return {
        icon: Square,
        material: material,
        recyclable: true,
        instructions: material.toLowerCase().includes('aluminium')
          ? 'Metal container - Keep aluminium separate from steel'
          : 'Wood waste - Check for paint/coating',
        color: 'purple',
        thickness: null
      };
    }

    return {
      icon: Package,
      material: 'Mixed',
      recyclable: true,
      instructions: 'Disassemble components and sort separately',
      color: 'blue',
      thickness: null
    };
  }

  function handleSelectProduct(dpp: DPP) {
    setSearchQuery(dpp.did);
    setSearchResult(dpp);
    setNotFound(false);
    // Load components if main product
    if (dpp.type === 'main') {
      enhancedDB.getRelationshipsByParent(dpp.did).then(async (relationships) => {
        const allDpps = await enhancedDB.getAllDPPs();
        const componentDids = relationships.map(r => r.child_did);
        const componentDpps = allDpps.filter(d => componentDids.includes(d.did));
        setComponents(componentDpps);
      });
    }
  }

  function handleBackToQuickAccess() {
    setSearchResult(null);
    setComponents([]);
    setSearchQuery('');
    setNotFound(false);
  }

  async function handleMarkAsRecycled() {
    if (!searchResult) return;

    setIsRecycling(true);
    try {
      // Update lifecycle status to end_of_life for main product
      await enhancedDB.updateDPP(searchResult.id, {
        lifecycle_status: 'end_of_life'
      });

      // Create recycling event for main product
      await enhancedDB.insertAttestation({
        dpp_id: searchResult.id,
        did: searchResult.did,
        attestation_type: 'recycling_completed',
        witness_did: 'did:webvh:recycler.local:operator-1',
        signature: `recycling-sig-${Date.now()}`,
        attestation_data: {
          description: 'Product marked as recycled - End of Life',
          recycled_by: 'Recycler Operator',
          recycling_facility: 'Local Recycling Center',
          lifecycle_change: 'active -> end_of_life'
        }
      });

      // Also update and create events for components
      for (const comp of components) {
        await enhancedDB.updateDPP(comp.id, {
          lifecycle_status: 'end_of_life'
        });

        await enhancedDB.insertAttestation({
          dpp_id: comp.id,
          did: comp.did,
          attestation_type: 'recycling_completed',
          witness_did: 'did:webvh:recycler.local:operator-1',
          signature: `recycling-sig-comp-${Date.now()}-${comp.id}`,
          attestation_data: {
            description: `Component recycled as part of ${searchResult.model}`,
            parent_product: searchResult.did,
            recycled_by: 'Recycler Operator',
            recycling_facility: 'Local Recycling Center',
            lifecycle_change: 'active -> end_of_life'
          }
        });
      }

      // Update local state
      setSearchResult({ ...searchResult, lifecycle_status: 'end_of_life' });
      setComponents(components.map(c => ({ ...c, lifecycle_status: 'end_of_life' })));

      // Refresh the windows list
      await loadAllWindows();

      alert(`✓ ${searchResult.model} and ${components.length} component(s) have been marked as recycled (End of Life)!\n\nRecycling events have been logged.`);
    } catch (error) {
      console.error('Error marking as recycled:', error);
      alert('Error updating lifecycle status');
    } finally {
      setIsRecycling(false);
    }
  }

  return (
    <div className="min-h-screen bg-green-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-700 to-green-800 text-white">
        <div className="max-w-3xl mx-auto px-6 py-8">
          <div className="flex items-center gap-3 mb-2">
            <Recycle className="w-8 h-8" />
            <h1 className="text-2xl font-bold">Recycler Portal</h1>
          </div>
          <p className="text-green-100">Search a product to view material information</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 -mt-6">
        {/* Search Bar - Prominent */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 mb-6">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Enter DID or product name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="w-full pl-12 pr-4 py-4 text-lg border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={searching || !searchQuery.trim()}
              className="px-6 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 text-white rounded-xl font-medium transition-colors flex items-center gap-2"
            >
              {searching ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Search className="w-5 h-5" />
                  Search
                </>
              )}
            </button>
          </div>

          <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
            <button
              onClick={() => alert('QR Scanner would open here')}
              className="flex items-center gap-1 hover:text-green-600 transition-colors"
            >
              <QrCode className="w-4 h-4" />
              Scan QR code
            </button>
          </div>
        </div>

        {/* Not Found */}
        {notFound && (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-8 text-center mb-6 border border-green-200 dark:border-green-700">
            <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Product not found</h3>
            <p className="text-gray-500 dark:text-gray-400 mt-1">Check the DID or product name and try again</p>
          </div>
        )}

        {/* Search Result */}
        {searchResult && (
          <div className="space-y-4 mb-6">
            {/* Back Button */}
            <button
              onClick={handleBackToQuickAccess}
              className="flex items-center gap-2 text-green-700 hover:text-green-800 font-medium transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Quick Access
            </button>

            {/* Main Product Card */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-green-200 dark:border-green-700 overflow-hidden">
              <div className="bg-gradient-to-r from-green-600 to-green-700 px-6 py-4 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green-100 text-sm">Product found</p>
                    <h2 className="text-xl font-bold">{searchResult.model}</h2>
                  </div>
                  <CheckCircle className="w-8 h-8" />
                </div>
              </div>

              <div className="p-6">
                {/* Product Details Grid */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Type</p>
                    <p className="font-medium text-gray-900 dark:text-white">{searchResult.type === 'main' ? 'Main Product (Window)' : 'Component'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Lifecycle Status</p>
                    <p className={`font-medium capitalize ${searchResult.lifecycle_status === 'end_of_life' ? 'text-red-600' : 'text-green-600'}`}>
                      {searchResult.lifecycle_status === 'end_of_life' ? '♻️ End of Life' : searchResult.lifecycle_status}
                    </p>
                  </div>
                </div>

                {/* Dimensions & Additional Info */}
                {searchResult.metadata && (
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-4 space-y-3">
                    <h4 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                      <Info className="w-4 h-4 text-green-600 dark:text-green-400" />
                      Product Specifications
                    </h4>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      {searchResult.metadata.dimensions ? (
                        <div>
                          <p className="text-gray-500 dark:text-gray-400">Dimensions</p>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {(searchResult.metadata.dimensions as { width?: number; height?: number; unit?: string }).width} x {(searchResult.metadata.dimensions as { width?: number; height?: number; unit?: string }).height} {(searchResult.metadata.dimensions as { width?: number; height?: number; unit?: string }).unit || 'mm'}
                          </p>
                        </div>
                      ) : null}
                      {searchResult.metadata.glazing_type ? (
                        <div>
                          <p className="text-gray-500 dark:text-gray-400">Glass Type</p>
                          <p className="font-medium text-gray-900 dark:text-white">{String(searchResult.metadata.glazing_type)}</p>
                        </div>
                      ) : null}
                      {searchResult.metadata.frame_material ? (
                        <div>
                          <p className="text-gray-500 dark:text-gray-400">Frame Material</p>
                          <p className="font-medium text-gray-900 dark:text-white">{String(searchResult.metadata.frame_material)}</p>
                        </div>
                      ) : null}
                      {searchResult.metadata.productType ? (
                        <div>
                          <p className="text-gray-500 dark:text-gray-400">Product Type</p>
                          <p className="font-medium text-gray-900 dark:text-white capitalize">{String(searchResult.metadata.productType)}</p>
                        </div>
                      ) : null}
                    </div>
                    {searchResult.metadata.description ? (
                      <div className="pt-2 border-t border-gray-200 dark:border-gray-600">
                        <p className="text-gray-500 dark:text-gray-400 text-sm">Description</p>
                        <p className="text-sm text-gray-700 dark:text-gray-300">{String(searchResult.metadata.description)}</p>
                      </div>
                    ) : null}
                  </div>
                )}

                <button
                  onClick={() => onNavigate(searchResult.did)}
                  className="w-full py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-gray-700 dark:text-gray-200 font-medium transition-colors flex items-center justify-center gap-2"
                >
                  View full DPP
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Materials Breakdown */}
            {components.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-green-200 dark:border-green-700 overflow-hidden">
                <div className="px-6 py-4 border-b border-green-100 dark:border-green-800 flex items-center gap-2">
                  <Layers className="w-5 h-5 text-green-500" />
                  <h3 className="font-semibold text-gray-900 dark:text-white">Materials & Components</h3>
                </div>

                <div className="divide-y divide-gray-100">
                  {components.map((comp) => {
                    const info = getMaterialInfo(comp);
                    const Icon = info.icon;

                    return (
                      <div key={comp.id} className="p-4">
                        <div className="flex items-start gap-4">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center bg-${info.color}-100`}>
                            <Icon className={`w-6 h-6 text-${info.color}-600`} />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <h4 className="font-medium text-gray-900 dark:text-white">{comp.model}</h4>
                              {info.recyclable && (
                                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <Recycle className="w-3 h-3" />
                                  Recyclable
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Material: {info.material}</p>
                            <div className="flex items-start gap-2 p-3 bg-green-50 dark:bg-green-900/30 rounded-lg">
                              <Info className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                              <p className="text-sm text-gray-700 dark:text-gray-300">{info.instructions}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Mark as Recycled Button */}
            {searchResult.lifecycle_status !== 'end_of_life' ? (
              <button
                onClick={handleMarkAsRecycled}
                disabled={isRecycling}
                className="w-full py-4 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
              >
                {isRecycling ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-5 h-5" />
                    Mark as Recycled (End of Life)
                  </>
                )}
              </button>
            ) : (
              <div className="w-full py-4 bg-gray-100 text-gray-600 rounded-xl font-medium flex items-center justify-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                Already Recycled
              </div>
            )}
          </div>
        )}

        {/* Quick Access - All Windows */}
        {!searchResult && !notFound && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-green-200 dark:border-green-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-green-100 dark:border-green-800 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-white">Quick Access - All Windows</h3>
              <span className="text-sm text-gray-500 dark:text-gray-400">{allWindows.length} products</span>
            </div>
            <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
              {allWindows.length === 0 ? (
                <div className="px-6 py-8 text-center text-gray-500">
                  <Package className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p>No products found</p>
                </div>
              ) : (
                allWindows.map((dpp) => (
                  <button
                    key={dpp.id}
                    onClick={() => handleSelectProduct(dpp)}
                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-green-50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <Package className={`w-8 h-8 ${dpp.lifecycle_status === 'end_of_life' ? 'text-gray-400' : 'text-green-500'}`} />
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{dpp.model}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 font-mono">{dpp.did.slice(0, 35)}...</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {dpp.lifecycle_status === 'end_of_life' && (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">♻️ Recycled</span>
                      )}
                      <ArrowRight className="w-5 h-5 text-green-500" />
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
