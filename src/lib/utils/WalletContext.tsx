import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { ethers } from 'ethers';

// Extend window interface for Ethereum provider
declare global {
    interface Window {
        ethereum?: any;
    }
}

interface WalletContextType {
    address: string | null;
    chainId: string | null;
    isConnected: boolean;
    isConnecting: boolean;
    provider: ethers.BrowserProvider | null;
    signer: ethers.JsonRpcSigner | null;
    connect: () => Promise<void>;
    disconnect: () => void;
    error: string | null;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
    const [address, setAddress] = useState<string | null>(null);
    const [chainId, setChainId] = useState<string | null>(null);
    const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
    const [signer, setSigner] = useState<ethers.JsonRpcSigner | null>(null);
    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Initialize provider on mount
    useEffect(() => {
        if (window.ethereum) {
            const browserProvider = new ethers.BrowserProvider(window.ethereum);
            setProvider(browserProvider);

            // Check if already connected
            browserProvider.listAccounts().then(accounts => {
                if (accounts.length > 0) {
                    handleAccountsChanged(accounts.map(a => a.address));
                }
            }).catch(console.error);

            // Setup listeners
            window.ethereum.on('accountsChanged', (accounts: string[]) => handleAccountsChanged(accounts));
            window.ethereum.on('chainChanged', (id: string) => setChainId(id));
            window.ethereum.on('disconnect', () => handleDisconnect());

            return () => {
                window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
                window.ethereum.removeListener('chainChanged', setChainId);
                window.ethereum.removeListener('disconnect', handleDisconnect);
            };
        }
    }, []);

    const handleAccountsChanged = async (accounts: string[]) => {
        console.log('[WalletContext] handleAccountsChanged:', accounts);
        if (accounts.length > 0) {
            setAddress(accounts[0]);
            if (window.ethereum) {
                const p = new ethers.BrowserProvider(window.ethereum);
                const s = await p.getSigner();
                setProvider(p);
                setSigner(s);
                setError(null);
                console.log('[WalletContext] Success - Address set:', accounts[0]);
            }
        } else {
            handleDisconnect();
        }
    };

    const handleDisconnect = () => {
        setAddress(null);
        setSigner(null);
        // removing chainId logic to avoid flicker if just swtiching accounts
    };

    const connect = async () => {
        if (!window.ethereum) {
            setError("MetaMask is not installed!");
            window.open('https://metamask.io/download/', '_blank');
            return;
        }

        setIsConnecting(true);
        setError(null);

        try {
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            await handleAccountsChanged(accounts);
        } catch (err: any) {
            console.error("Wallet connection error:", err);
            setError(err.message || "Failed to connect wallet");
        } finally {
            setIsConnecting(false);
        }
    };

    const disconnect = () => {
        // Cannot programmatically disconnect MetaMask, but we can clear local state
        handleDisconnect();
    };

    return (
        <WalletContext.Provider value={{
            address,
            chainId,
            isConnected: !!address,
            isConnecting,
            provider,
            signer,
            connect,
            disconnect,
            error
        }}>
            {children}
        </WalletContext.Provider>
    );
}

export function useWallet() {
    const context = useContext(WalletContext);
    if (context === undefined) {
        throw new Error('useWallet must be used within a WalletProvider');
    }
    return context;
}
