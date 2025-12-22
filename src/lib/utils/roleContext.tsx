import { createContext, useContext, useState, ReactNode } from 'react';

export type UserRole = 'Recycler' | 'Manufacturer' | 'Manufacturer A' | 'Manufacturer B' | 'Supervisor' | 'Witness' | 'Watcher' | 'Resolver' | 'Consumer';

interface RoleContextType {
  currentRole: UserRole;
  currentRoleDID: string;
  setRole: (role: UserRole) => void;
  canSeeField: (field: string) => boolean;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

// Define DID for each role - exported for use in transfer ownership
export const roleDIDs: Record<UserRole, string> = {
  Recycler: 'did:webvh:example.com:roles:recycler-001',
  Manufacturer: 'did:webvh:example.com:organizations:window-manufacturer',
  'Manufacturer A': 'did:webvh:glass-solutions.com:organizations:manufacturer',
  'Manufacturer B': 'did:webvh:frame-masters.com:organizations:manufacturer',
  Supervisor: 'did:webvh:example.com:roles:supervisor-001',
  Witness: 'did:webvh:example.com:witnesses:witness-node-001',
  Watcher: 'did:webvh:example.com:watchers:watcher-node-001',
  Resolver: 'did:webvh:example.com:resolvers:resolver-node-001',
  Consumer: 'did:webvh:example.com:consumers:public-user',
};

// Define what each role can see
const rolePermissions: Record<UserRole, string[]> = {
  Recycler: ['basic', 'materials', 'dimensions', 'weight', 'hazardous'],
  Manufacturer: ['basic', 'materials', 'lifecycle', 'operations', 'manufacturing', 'suppliers', 'costs'],
  'Manufacturer A': ['basic', 'materials', 'lifecycle', 'operations', 'manufacturing', 'suppliers', 'costs'],
  'Manufacturer B': ['basic', 'materials', 'lifecycle', 'operations', 'manufacturing', 'suppliers', 'costs'],
  Supervisor: ['basic', 'materials', 'lifecycle', 'operations', 'manufacturing', 'suppliers', 'costs', 'sensitive', 'all'],
  Witness: ['basic', 'operations', 'did-events'],
  Watcher: ['basic', 'operations', 'did-events', 'monitoring', 'alerts'],
  Resolver: ['basic', 'operations', 'did-events', 'history', 'verification'],
  Consumer: ['basic', 'origin', 'maintenance', 'warranty'],
};

export function RoleProvider({ children }: { children: ReactNode }) {
  const [currentRole, setCurrentRole] = useState<UserRole>('Manufacturer A');

  const setRole = (role: UserRole) => {
    setCurrentRole(role);
  };

  const canSeeField = (field: string): boolean => {
    const permissions = rolePermissions[currentRole];
    return permissions.includes('all') || permissions.includes(field);
  };

  const currentRoleDID = roleDIDs[currentRole];

  return (
    <RoleContext.Provider value={{ currentRole, currentRoleDID, setRole, canSeeField }}>
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
