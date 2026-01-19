import React, { useState } from 'react';
import { AlertTriangle, Power } from 'lucide-react';

interface DeactivateDIDModalProps {
  onClose: () => void;
  onDeactivate: (reason: string) => Promise<void>;
  loading?: boolean;
}

export default function DeactivateDIDModal({ 
  onClose, 
  onDeactivate,
  loading = false
}: DeactivateDIDModalProps) {
  const [reason, setReason] = useState('');

  const handleDeactivate = async () => {
    if (!reason.trim()) return;
    await onDeactivate(reason);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-red-100 dark:border-red-900/30 transform animate-in zoom-in-95 duration-200">
        <div className="bg-gradient-to-r from-red-600 to-rose-600 px-8 py-6">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-8 h-8 text-white" />
            <h3 className="text-2xl font-bold text-white">Deactivate Passport</h3>
          </div>
        </div>
        
        <div className="p-8">
          <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-100 dark:border-red-900/30 rounded-2xl p-5 mb-8">
            <div className="flex gap-4">
              <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0" />
              <div className="text-sm text-red-900 dark:text-red-200 leading-relaxed">
                <strong>Attention:</strong> This action is <strong>permanent</strong> and cannot be undone. The product will be marked as 'Recycled' or 'Out of Use' and the digital identity will be permanently closed.
              </div>
            </div>
          </div>

          <div className="mb-8">
            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-widest">
              Reason for deactivation <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={loading}
              placeholder="E.g. Product sent for recycling, destroyed, or end of life..."
              rows={4}
              className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-2xl focus:outline-none focus:border-red-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-white transition-all resize-none disabled:opacity-50"
            />
          </div>

          <div className="flex gap-4 justify-end mt-10">
            <button
              onClick={onClose}
              disabled={loading}
              className="px-6 py-2.5 text-gray-600 dark:text-gray-300 font-bold hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleDeactivate}
              disabled={loading || !reason.trim()}
              className="px-8 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-all font-bold disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-red-500/20 active:scale-95 flex items-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Power size={20} />
              )}
              {loading ? 'Processing...' : 'Permanently Deactivate'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
