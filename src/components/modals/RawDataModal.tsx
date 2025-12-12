import { X, FileJson, Copy, CheckCircle } from 'lucide-react';
import { useState } from 'react';

interface RawDataModalProps {
    data: any;
    onClose: () => void;
}

export default function RawDataModal({ data, onClose }: RawDataModalProps) {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        const jsonString = JSON.stringify(data, null, 2);
        navigator.clipboard.writeText(jsonString);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const jsonString = JSON.stringify(data, null, 2);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="bg-gradient-to-r from-purple-600 to-purple-800 text-white px-6 py-4 rounded-t-lg flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <FileJson className="w-6 h-6" />
                        <h2 className="text-xl font-bold">Raw DPP Data</h2>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleCopy}
                            className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-gray-700 bg-opacity-20 dark:bg-opacity-100 hover:bg-opacity-30 dark:hover:bg-gray-600 rounded-lg transition-colors text-sm font-medium"
                        >
                            {copied ? (
                                <>
                                    <CheckCircle className="w-4 h-4" />
                                    Copied!
                                </>
                            ) : (
                                <>
                                    <Copy className="w-4 h-4" />
                                    Copy
                                </>
                            )}
                        </button>
                        <button
                            onClick={onClose}
                            className="text-white hover:text-gray-200 transition-colors p-1"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                        <div className="mb-3 flex items-center gap-2 text-sm text-gray-600 border-b border-gray-200 pb-2">
                            <FileJson className="w-4 h-4" />
                            <span className="font-medium">Complete Digital Product Passport Data Structure</span>
                        </div>
                        <pre className="text-xs font-mono text-gray-800 dark:text-gray-200 overflow-x-auto">
                            <code className="language-json">{jsonString}</code>
                        </pre>
                    </div>

                    {/* Educational Note */}
                    <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <h3 className="text-sm font-semibold text-blue-900 mb-2">About This Data</h3>
                        <p className="text-xs text-blue-800 dark:text-blue-200 leading-relaxed">
                            This is the complete, unprocessed data structure of the Digital Product Passport.
                            It includes all metadata, relationships, and verification information stored on the
                            distributed ledger. Use this view to verify data integrity and trace the complete
                            product history.
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="border-t border-gray-200 px-6 py-4 bg-gray-50">
                    <button
                        onClick={onClose}
                        className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
