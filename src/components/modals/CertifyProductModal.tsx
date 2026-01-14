import React, { useState } from 'react';
import { Award, ShieldCheck, ClipboardCheck, X } from 'lucide-react';

interface CertifyProductModalProps {
  onClose: () => void;
  onCertify: (data: {
    inspector: string;
    certificateType: string;
    notes: string;
    status: string;
  }) => Promise<void>;
  loading?: boolean;
}

export default function CertifyProductModal({ 
  onClose, 
  onCertify,
  loading = false
}: CertifyProductModalProps) {
  const [inspector, setInspector] = useState('');
  const [certificateType, setCertificateType] = useState('Safety Inspection');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('certified');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onCertify({
      inspector,
      certificateType,
      notes,
      status
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-gray-100 dark:border-gray-700 transform animate-in zoom-in-95 duration-200">
        <div className="bg-gradient-to-r from-amber-500 to-orange-600 px-8 py-6 flex justify-between items-center">
          <div className="flex items-center gap-3 text-white">
            <Award className="w-8 h-8" />
            <h3 className="text-2xl font-bold">Product Certification</h3>
          </div>
          <button 
            onClick={onClose}
            className="text-white/80 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-8">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-8 leading-relaxed">
            Record an official inspection or certification in the digital passport. This action adds an immutable proof to the history.
          </p>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider">
                Inspection Body / Inspector
              </label>
              <input
                type="text"
                value={inspector}
                onChange={(e) => setInspector(e.target.value)}
                placeholder="E.g. TUV Rheinland, John Smith"
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:border-amber-500 dark:focus:border-amber-500 outline-none transition-all dark:text-white"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider">
                Certificate Type
              </label>
              <select
                value={certificateType}
                onChange={(e) => setCertificateType(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:border-amber-500 dark:focus:border-amber-500 outline-none transition-all dark:text-white"
              >
                <option value="Safety Inspection">Safety Inspection</option>
                <option value="Quality Standard">Quality Standard (ISO)</option>
                <option value="Sustainability Certificate">Sustainability Certificate</option>
                <option value="Maintenance Check">Maintenance Check</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider">
                New Product Status
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setStatus('active')}
                  className={`py-2 px-4 rounded-xl border-2 transition-all font-medium ${
                    status === 'active' 
                      ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' 
                      : 'border-gray-100 dark:border-gray-700 text-gray-500 hover:border-amber-200'
                  }`}
                >
                  Active (Standard)
                </button>
                <button
                  type="button"
                  onClick={() => setStatus('certified')}
                  className={`py-2 px-4 rounded-xl border-2 transition-all font-medium ${
                    status === 'certified' 
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' 
                      : 'border-gray-100 dark:border-gray-700 text-gray-500 hover:border-emerald-200'
                  }`}
                >
                  Certified
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider">
                Comments / Result
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Describe the findings of the inspection..."
                rows={3}
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:border-amber-500 dark:focus:border-amber-500 outline-none transition-all dark:text-white resize-none"
                required
              />
            </div>
          </div>

          <div className="mt-10 flex gap-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-4 rounded-2xl border-2 border-gray-100 dark:border-gray-700 text-gray-600 dark:text-gray-400 font-bold hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-2 flex items-center justify-center gap-3 px-10 py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold hover:shadow-lg hover:shadow-amber-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98]"
            >
              {loading ? (
                <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <ClipboardCheck className="w-6 h-6" />
                  Record Inspection
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
