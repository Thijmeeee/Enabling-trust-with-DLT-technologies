import { useState } from 'react';
import { X, AlertTriangle, ArrowRight } from 'lucide-react';
import { LifecycleManager } from '../../lib/operations/lifecycleManager';
import { LifecycleStatus, LifecycleStatusLabels, ValidTransitions } from '../../lib/types/lifecycle';
import { LifecycleStatusBadge } from '../shared/LifecycleStatusBadge';
import type { DPP } from '../../lib/data/localData';

interface LifecycleActionModalProps {
    isOpen: boolean;
    onClose: () => void;
    dpp: DPP;
    onUpdate: () => void;
    currentUserDid: string;
}

export function LifecycleActionModal({ isOpen, onClose, dpp, onUpdate, currentUserDid }: LifecycleActionModalProps) {
    const [selectedStatus, setSelectedStatus] = useState<LifecycleStatus | null>(null);
    const [reason, setReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const currentStatus = (dpp.lifecycle_status || 'created') as LifecycleStatus;
    const validOptions = ValidTransitions[currentStatus] || [];

    const handleTransition = async () => {
        if (!selectedStatus) return;

        setIsSubmitting(true);
        setError(null);

        try {
            const result = await LifecycleManager.transitionLifecycle(
                dpp.id,
                selectedStatus,
                currentUserDid,
                reason || `Manual transition to ${LifecycleStatusLabels[selectedStatus]}`
            );

            if (result.success) {
                onUpdate();
                onClose();
            } else {
                if (result.requiredActions?.type === 'handle_children') {
                    setError('This action requires handling sub-components (Cascade logic coming soon). For now, operation blocked.');
                } else {
                    setError(result.message);
                }
            }
        } catch (e) {
            setError('Failed to update status');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl max-w-lg w-full shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-700">

                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        Update Lifecycle Status
                    </h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-6">

                    {/* Current Status */}
                    <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Current Status</span>
                        <LifecycleStatusBadge status={currentStatus} size="lg" />
                    </div>

                    {!selectedStatus ? (
                        /* Selection View */
                        <div className="space-y-3">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Available Transitions</label>
                            {validOptions.length === 0 ? (
                                <p className="text-sm text-gray-500 italic">No further transitions available from this state.</p>
                            ) : (
                                <div className="grid grid-cols-1 gap-2">
                                    {validOptions.map(option => (
                                        <button
                                            key={option}
                                            onClick={() => setSelectedStatus(option)}
                                            className="flex items-center justify-between p-3 text-left border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors group"
                                        >
                                            <div className="flex items-center gap-3">
                                                <LifecycleStatusBadge status={option} />
                                                <span className="text-sm text-gray-600 dark:text-gray-400">
                                                    {/* Add descriptions based on status if needed */}
                                                </span>
                                            </div>
                                            <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-blue-500" />
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        /* Confirmation View */
                        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-200">
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                                <button onClick={() => setSelectedStatus(null)} className="hover:underline">Select different status</button>
                                <span>&gt;</span>
                                <span className="font-medium text-gray-900 dark:text-white">Confirm Change</span>
                            </div>

                            <div className="flex items-center justify-center py-4">
                                <LifecycleStatusBadge status={currentStatus} />
                                <ArrowRight className="w-6 h-6 mx-4 text-gray-300" />
                                <LifecycleStatusBadge status={selectedStatus} size="lg" className="shadow-lg scale-110" />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Reason for change
                                </label>
                                <textarea
                                    value={reason}
                                    onChange={e => setReason(e.target.value)}
                                    placeholder="E.g. Routine maintenance scheduled..."
                                    className="w-full h-24 p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                                />
                            </div>

                            {selectedStatus === 'recycled' && (
                                <div className="flex items-start gap-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 text-xs rounded-lg border border-yellow-200 dark:border-yellow-800">
                                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                                    <p>Warning: This action is final. If this product has active components, you will be prompted to handle them.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {error && (
                        <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4" />
                            {error}
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white transition-colors"
                    >
                        Cancel
                    </button>
                    {selectedStatus && (
                        <button
                            onClick={handleTransition}
                            disabled={isSubmitting || !reason.trim()}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg shadow-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? 'Updating...' : 'Confirm Update'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
