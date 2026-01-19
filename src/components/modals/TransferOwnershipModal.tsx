import React, { useState } from 'react';
import { roleDIDs, type UserRole } from '../../lib/utils/roleContext';

interface TransferOwnershipModalProps {
  currentOwnerDID: string;
  onClose: () => void;
  onTransfer: (newOwnerDID: string) => Promise<void>;
  loading?: boolean;
}

export default function TransferOwnershipModal({ 
  currentOwnerDID, 
  onClose, 
  onTransfer,
  loading = false
}: TransferOwnershipModalProps) {
  const [newOwnerDID, setNewOwnerDID] = useState('');

  const handleTransfer = async () => {
    if (!newOwnerDID) return;
    await onTransfer(newOwnerDID);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-8 border border-gray-100 dark:border-gray-700 transform animate-in zoom-in-95 duration-200">
        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Transfer Ownership</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 leading-relaxed">
          Select the new owner for this product. This role will receive full control over the digital product passport.
        </p>

        {/* Role Dropdown */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            New Owner Role
          </label>
          <select
            value={newOwnerDID}
            onChange={(e) => setNewOwnerDID(e.target.value)}
            disabled={loading}
            className="w-full px-4 py-3 border-2 border-gray-100 dark:border-gray-700 rounded-xl focus:outline-none focus:border-blue-500 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white transition-colors disabled:opacity-50"
          >
            <option value="">-- Choose a role --</option>
            {(Object.keys(roleDIDs) as UserRole[])
              .filter(role => roleDIDs[role] !== currentOwnerDID)
              .map(role => (
                <option key={role} value={roleDIDs[role]}>
                  {role}
                </option>
              ))
            }
          </select>
        </div>

        {/* Show selected DID */}
        {newOwnerDID && (
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/30 rounded-xl border border-blue-100 dark:border-blue-800 transition-colors">
            <span className="text-xs font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider">Selected DID:</span>
            <p className="text-xs font-mono text-blue-600 dark:text-blue-400 break-all mt-2 leading-relaxed">
              {newOwnerDID}
            </p>
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-6 py-2.5 text-gray-600 dark:text-gray-300 font-semibold hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleTransfer}
            disabled={!newOwnerDID || loading}
            className="px-8 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all font-bold disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/20 active:scale-95 flex items-center gap-2"
          >
            {loading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            {loading ? 'Processing...' : 'Transfer'}
          </button>
        </div>
      </div>
    </div>
  );
}
