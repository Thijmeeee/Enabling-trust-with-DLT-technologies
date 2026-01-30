import { createContext, useContext, useState, ReactNode, useMemo, useEffect } from 'react';
import { useWallet } from './WalletContext';

export type UserRole = 'Recycler' | 'Manufacturer' | 'Manufacturer A' | 'Manufacturer B' | 'Witness' | 'Watcher' | 'Resolver' | 'Consumer' | 'Wallet User';

interface RoleContextType {
  currentRole: UserRole;
  currentRoleDID: string;
  setRole: (role: UserRole) => void;
  canSeeField: (field: string) => boolean;
  isWalletLocked: boolean;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

// Define DID for each role - exported for use in transfer ownership
export const roleDIDs: Record<UserRole, string> = {
  Recycler: 'did:webvh:example.com:roles:recycler-001',
  Manufacturer: 'did:webvh:example.com:organizations:window-manufacturer',
  'Manufacturer A': 'did:webvh:glass-solutions.com:organizations:manufacturer',
  'Manufacturer B': 'did:webvh:frame-masters.com:organizations:manufacturer',
  Witness: 'did:webvh:example.com:witnesses:witness-node-001',
  Watcher: 'did:webvh:example.com:watchers:watcher-node-001',
  Resolver: 'did:webvh:example.com:resolvers:resolver-node-001',
  Consumer: 'did:webvh:example.com:consumers:public-user',
  'Wallet User': 'did:pkh:unknown',
};

// Define what each role can see
const rolePermissions: Record<UserRole, string[]> = {
  Recycler: ['basic', 'materials', 'dimensions', 'weight', 'hazardous'],
  Manufacturer: ['basic', 'materials', 'lifecycle', 'operations', 'manufacturing', 'suppliers', 'costs'],
  'Manufacturer A': ['basic', 'materials', 'lifecycle', 'operations', 'manufacturing', 'suppliers', 'costs'],
  'Manufacturer B': ['basic', 'materials', 'lifecycle', 'operations', 'manufacturing', 'suppliers', 'costs'],
  Witness: ['basic', 'operations', 'did-events'],
  Watcher: ['basic', 'operations', 'did-events', 'monitoring', 'alerts'],
  Resolver: ['basic', 'operations', 'did-events', 'history', 'verification'],
  Consumer: ['basic', 'origin', 'maintenance', 'warranty'],
  'Wallet User': ['basic', 'materials', 'lifecycle', 'operations'],
};

export function RoleProvider({ children }: { children: ReactNode }) {
  const { isConnected, address } = useWallet();
  const [selectedRole, setSelectedRole] = useState<UserRole>('Manufacturer A');

  // Hard derivation - automatically switch to Wallet User when wallet is connected
  const isWalletCurrentlyConnected = !!(address || isConnected);
  const currentRole: UserRole = isWalletCurrentlyConnected ? 'Wallet User' : selectedRole;

  const contextValue = useMemo(() => {
    // Dynamic DID for Wallet User
    let roleDID = roleDIDs[currentRole];
    if (currentRole === 'Wallet User' && address) {
      const walletId = address.substring(2, 10).toLowerCase();
      roleDID = "did:webvh:company-" + walletId + ":user-" + walletId;
    }

    return {
      currentRole,
      currentRoleDID: roleDID,
      setRole: (role: UserRole) => {
        if (isWalletCurrentlyConnected) {
          console.warn("Role change blocked: Wallet is connected");
          return;
        }
        setSelectedRole(role);
      },
      canSeeField: (field: string): boolean => {
        const permissions = rolePermissions[currentRole];
        return permissions && permissions.includes(field);
      },
      isWalletLocked: isWalletCurrentlyConnected
    };
  }, [currentRole, isWalletCurrentlyConnected, address]);

  return (
    <RoleContext.Provider value={contextValue}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const context = useContext(RoleContext);
  if (context === undefined) {
    throw new Error('useRole must be used within a RoleProvider');
  }
  return context;
}
