import React, { useState } from 'react';
import { FileEdit } from 'lucide-react';

interface UpdateDIDModalProps {
  onClose: () => void;
  onUpdate: (data: { 
    updateType: 'service' | 'metadata'; 
    selectedServiceType?: string; 
    serviceEndpoint?: string; 
    description?: string;
  }) => Promise<void>;
  loading?: boolean;
  initialType?: 'service' | 'metadata';
}

export default function UpdateDIDModal({ 
  onClose, 
  onUpdate,
  loading = false,
  initialType = 'metadata'
}: UpdateDIDModalProps) {
  const [updateType, setUpdateType] = useState<'service' | 'metadata'>(initialType);
  const [selectedServiceType, setSelectedServiceType] = useState('ProductPassport');
  const [updateServiceEndpoint, setUpdateServiceEndpoint] = useState('');
  const [updateDescription, setUpdateDescription] = useState('');

  const handleUpdate = async () => {
    await onUpdate({
      updateType,
      selectedServiceType: updateType === 'service' ? selectedServiceType : undefined,
      serviceEndpoint: updateType === 'service' ? updateServiceEndpoint : undefined,
      description: updateType === 'metadata' ? updateDescription : undefined
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-gray-100 dark:border-gray-700 transform animate-in zoom-in-95 duration-200">
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-8 py-6">
          <div className="flex items-center gap-3">
            <FileEdit className="w-8 h-8 text-white" />
            <h3 className="text-2xl font-bold text-white">Update Product Information</h3>
          </div>
        </div>
        
        <div className="p-8">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-8 leading-relaxed">
            Choose what you would like to update in this digital product passport. This change will be cryptographically signed and recorded.
          </p>

          {/* Update Type Selection */}
          <div className="mb-8">
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-4 uppercase tracking-wider">
              What would you like to update?
            </label>
            <div className="grid grid-cols-1 gap-4">
              <label className={`flex items-start gap-4 p-5 border-2 rounded-2xl cursor-pointer transition-all ${
                updateType === 'service' 
                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 shadow-md shadow-emerald-500/10' 
                  : 'border-gray-100 dark:border-gray-700 hover:border-emerald-200 dark:hover:border-emerald-800'
              }`}>
                <input
                  type="radio"
                  name="updateType"
                  value="service"
                  checked={updateType === 'service'}
                  onChange={() => setUpdateType('service')}
                  className="mt-1.5 text-emerald-600 accent-emerald-600 h-4 w-4"
                />
                <div>
                  <span className="font-bold text-gray-900 dark:text-white text-lg">📡 Service Endpoint</span>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Change where product-specific data or APIs can be found.
                  </p>
                </div>
              </label>
              
              <label className={`flex items-start gap-4 p-5 border-2 rounded-2xl cursor-pointer transition-all ${
                updateType === 'metadata' 
                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 shadow-md shadow-emerald-500/10' 
                  : 'border-gray-100 dark:border-gray-700 hover:border-emerald-200 dark:hover:border-emerald-800'
              }`}>
                <input
                  type="radio"
                  name="updateType"
                  value="metadata"
                  checked={updateType === 'metadata'}
                  onChange={() => setUpdateType('metadata')}
                  className="mt-1.5 text-emerald-600 accent-emerald-600 h-4 w-4"
                />
                <div>
                  <span className="font-bold text-gray-900 dark:text-white text-lg">📝 Documentation & Notes</span>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Add an official note or description to the identity.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Service Endpoint Options */}
          {updateType === 'service' && (
            <div className="space-y-6 bg-gray-50 dark:bg-gray-900/50 p-6 rounded-2xl border border-gray-100 dark:border-gray-800">
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-widest">
                  Service Type
                </label>
                <select
                  value={selectedServiceType}
                  onChange={(e) => setSelectedServiceType(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:border-emerald-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white transition-colors"
                >
                  <option value="ProductPassport">📦 Product Passport API</option>
                  <option value="Documentation">📄 Product Documentation</option>
                  <option value="SupportService">🛠️ Support & Warranty Service</option>
                  <option value="RecyclingInfo">♻️ Recycling Information</option>
                  <option value="ManufacturerInfo">🏭 Manufacturer Information</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-widest">
                  New URL (Endpoint)
                </label>
                <input
                  type="url"
                  value={updateServiceEndpoint}
                  onChange={(e) => setUpdateServiceEndpoint(e.target.value)}
                  placeholder="https://example.com/api/products"
                  className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:border-emerald-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white transition-colors"
                />
              </div>
            </div>
          )}

          {/* Metadata/Documentation Options */}
          {updateType === 'metadata' && (
            <div className="space-y-6 bg-gray-50 dark:bg-gray-900/50 p-6 rounded-2xl border border-gray-100 dark:border-gray-800">
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-widest">
                  Note Type
                </label>
                <select
                  onChange={(e) => setUpdateDescription(e.target.value ? `${e.target.value}: ` : '')}
                  className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:border-emerald-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white transition-colors"
                >
                  <option value="">-- Choose a type --</option>
                  <option value="Certification Update">✅ Certification Updated</option>
                  <option value="Product Modification">🔧 Product Modification</option>
                  <option value="Compliance Update">📋 Compliance Check</option>
                  <option value="Documentation Change">📝 Documentation Change</option>
                  <option value="General Note">📌 General Note</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-widest">
                  Description
                </label>
                <textarea
                  value={updateDescription}
                  onChange={(e) => setUpdateDescription(e.target.value)}
                  placeholder="Provide details about the change here..."
                  rows={4}
                  className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:border-emerald-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white transition-all resize-none"
                />
              </div>
            </div>
          )}

          <div className="flex gap-4 justify-end mt-10">
            <button
              onClick={onClose}
              disabled={loading}
              className="px-6 py-2.5 text-gray-600 dark:text-gray-300 font-bold hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleUpdate}
              disabled={loading || (updateType === 'service' && !updateServiceEndpoint) || (updateType === 'metadata' && !updateDescription)}
              className="px-8 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all font-bold disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/20 active:scale-95 flex items-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <FileEdit size={20} />
              )}
              {loading ? 'Updating...' : 'Confirm Update'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
