import { ShieldCheck, Link2, CheckCircle, Server, Layers, AlertCircle, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { useRole } from '../lib/utils/roleContext';

interface DIDWebVHStatusPanelProps {
    did: string;
}

export default function DIDWebVHStatusPanel({ did }: DIDWebVHStatusPanelProps) {
    const { currentRole } = useRole();
    const isSupervisor = currentRole === 'Supervisor';
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <div className="bg-white rounded-lg border-2 border-purple-200 shadow-sm mb-6">
            {/* Clickable Header */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-purple-50 transition-colors rounded-t-lg"
            >
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-gradient-to-br from-purple-500 to-purple-700 rounded-lg shadow-lg">
                        <ShieldCheck className="w-6 h-6 text-white" />
                    </div>
                    <div className="text-left">
                        <h2 className="text-2xl font-bold text-gray-900">DID:webvh Technology</h2>
                        <p className="text-sm text-gray-600">Understanding the Verification Mechanism</p>
                    </div>
                </div>
                <div className="ml-4">
                    {isExpanded ? (
                        <ChevronUp className="w-6 h-6 text-gray-600" />
                    ) : (
                        <ChevronDown className="w-6 h-6 text-gray-600" />
                    )}
                </div>
            </button>

            {/* Collapsible Content */}
            {isExpanded && (
                <div className="px-6 pb-6 pt-2">
                    {/* DID Identifier Display */}
                    <div className="bg-gradient-to-r from-purple-50 via-blue-50 to-purple-50 border-2 border-purple-300 rounded-lg p-4 mb-6">
                        <div className="flex items-center gap-2 mb-2">
                            <Link2 className="w-5 h-5 text-purple-600" />
                            <span className="text-sm font-bold text-purple-900 uppercase tracking-wide">Decentralized Identifier</span>
                        </div>
                        <p className="text-base text-gray-900 font-mono break-all leading-relaxed bg-white p-3 rounded border border-purple-200">
                            {did}
                        </p>
                        <p className="text-xs text-gray-600 mt-2">
                            This unique identifier is cryptographically verifiable and permanently recorded on the blockchain.
                        </p>
                    </div>

                    {/* Visual Flow Diagram */}
                    <div className="mb-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                            <Layers className="w-5 h-5 text-purple-600" />
                            How It Works
                        </h3>

                        <div className="flex items-center gap-4 bg-gray-50 p-6 rounded-lg border border-gray-200">
                            {/* Step 1: Hash-Chained Log */}
                            <div className="flex-1">
                                <div className="bg-blue-100 border-2 border-blue-400 rounded-lg p-4 text-center">
                                    <Server className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                                    <div className="font-semibold text-blue-900 text-sm mb-1">Hash-Chained Log</div>
                                    <div className="text-xs text-blue-700">Web Server Storage</div>
                                </div>
                            </div>

                            {/* Arrow */}
                            <div className="flex flex-col items-center">
                                <div className="text-gray-400 font-bold text-2xl">→</div>
                                <div className="text-xs text-gray-500 mt-1">Anchored</div>
                            </div>

                            {/* Step 2: Ethereum Blockchain */}
                            <div className="flex-1">
                                <div className="bg-purple-100 border-2 border-purple-400 rounded-lg p-4 text-center">
                                    <ShieldCheck className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                                    <div className="font-semibold text-purple-900 text-sm mb-1">Ethereum Blockchain</div>
                                    <div className="text-xs text-purple-700">Immutable Record</div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
                            <p className="text-sm text-blue-900 leading-relaxed">
                                <strong>The Mechanism:</strong> DID:webvh creates a cryptographic hash chain of all changes,
                                stored on a web server for efficiency. Critical checkpoints are anchored to Ethereum,
                                ensuring tamper-proof verification without blockchain overhead for every update.
                            </p>
                        </div>
                    </div>

                    {/* Status Indicator */}
                    <div className="mb-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                            <Info className="w-5 h-5 text-purple-600" />
                            Current Implementation Status
                        </h3>

                        <div className="grid grid-cols-2 gap-4">
                            {/* Current Mode */}
                            <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <AlertCircle className="w-5 h-5 text-yellow-600" />
                                    <span className="font-semibold text-yellow-900">Current Mode</span>
                                </div>
                                <div className="text-2xl font-bold text-yellow-700 mb-1">Simulation</div>
                                <p className="text-xs text-yellow-700">
                                    Running in development with simulated blockchain anchoring
                                </p>
                            </div>

                            {/* Target Mode */}
                            <div className="bg-green-50 border-2 border-green-400 rounded-lg p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <CheckCircle className="w-5 h-5 text-green-600" />
                                    <span className="font-semibold text-green-900">Target Mode</span>
                                </div>
                                <div className="text-2xl font-bold text-green-700 mb-1">Production</div>
                                <p className="text-xs text-green-700">
                                    Full integration with Ethereum mainnet for live anchoring
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Supervisor-Specific Compliance Check */}
                    {isSupervisor && (
                        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-lg p-5">
                            <div className="flex items-start gap-3">
                                <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
                                <div>
                                    <h4 className="font-bold text-green-900 text-lg mb-2">Regulatory Compliance</h4>
                                    <p className="text-sm text-green-800 leading-relaxed mb-3">
                                        This DID:webvh implementation adheres to the <strong>EU Digital Product Passport Regulation</strong>
                                        and the <strong>eIDAS 2.0 framework</strong> for digital identity verification. The system ensures:
                                    </p>
                                    <ul className="space-y-2 text-sm text-green-800">
                                        <li className="flex items-start gap-2">
                                            <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                                            <span>Cryptographic verifiability of all product data</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                                            <span>Immutable audit trail for lifecycle events</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                                            <span>Compliance with EU Construction Products Regulation (CPR 305/2011)</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                                            <span>Support for cross-border product traceability</span>
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Educational Footer for Manufacturers */}
                    {!isSupervisor && (
                        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                            <h4 className="font-semibold text-purple-900 mb-2 text-sm">Why This Matters for Manufacturers</h4>
                            <p className="text-xs text-purple-800 leading-relaxed">
                                DID:webvh provides you with a <strong>verifiable digital identity</strong> for every product.
                                This builds trust with buyers, enables instant proof of authenticity, and creates a permanent
                                record that protects against counterfeiting and fraud. Your products gain a digital certificate
                                that travels with them throughout their entire lifecycle.
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
