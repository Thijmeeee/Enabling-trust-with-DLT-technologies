import { useWallet } from '../lib/utils/WalletContext';
import { Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { hybridDataStore as enhancedDB } from '../lib/data/hybridDataStore';


export default function WalletConnectButton() {
    const { connect, disconnect, isConnected, isConnecting, address, error } = useWallet();
    const [did, setDid] = useState<string | null>(null);

    useEffect(() => {
        // If connected, determine the DID
        if (isConnected && address) {
            // For now, we simulate a DID based on the address if one isn't found
            // Real implementation would look up in registry
            const shortAddr = address.substring(2, 10).toLowerCase();

            // Check if we have a robust DID for this user
            // This is a placeholder for the actual identity resolution logic
            setDid(`did:webvh:company-${shortAddr}:user-${shortAddr}`);
        } else {
            setDid(null);
        }
    }, [isConnected, address]);

    if (isConnected && address && did) {
        return (
            <div className="flex flex-col items-end">
                <button
                    onClick={disconnect}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-100 to-orange-50 hover:from-orange-200 hover:to-orange-100 border border-orange-200 rounded-xl transition-all shadow-sm group"
                    title="Disconnect Wallet"
                >
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <img
                        src="/images/MetaMask_Fox.svg.png"
                        alt="MetaMask"
                        className="w-4 h-4 object-contain mr-2"
                    />
                    <div className="flex flex-col items-start">
                        <span className="text-xs font-semibold text-orange-900 leading-tight">Connected</span>
                        <span className="text-[10px] font-mono text-orange-700/80 leading-tight">
                            {address.substring(0, 6)}...{address.substring(address.length - 4)}
                        </span>
                    </div>
                </button>
                <div className="mt-1 mr-1 text-[10px] font-mono text-gray-500 bg-white/80 px-2 py-0.5 rounded border border-gray-100">
                    {did}
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-end">
            <button
                onClick={connect}
                disabled={isConnecting}
                className="flex items-center gap-4 px-8 py-3 bg-black hover:bg-gray-800 text-white font-bold text-lg rounded-full transition-all transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-70 disabled:cursor-not-allowed border border-transparent hover:border-gray-700 shadow-lg"
            >
                {isConnecting ? (
                    <Loader2 className="w-8 h-8 animate-spin text-white" />
                ) : (
                    <img
                        src="/images/MetaMask_Fox.svg.png"
                        alt="MetaMask"
                        className="w-8 h-8 object-contain"
                    />
                )}
                <span className="tracking-wide text-xl font-medium">{isConnecting ? 'Connecting...' : 'Connect with MetaMask'}</span>
            </button>
            {error && (
                <span className="text-xs text-red-500 mt-2 font-medium bg-red-50 px-2 py-1 rounded">
                    {error}
                </span>
            )}
        </div>
    );
}
