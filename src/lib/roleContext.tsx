import { createContext, useContext, useState, ReactNode } from 'react';

export type UserRole = 'Operator' | 'Recycler' | 'Manufacturer' | 'Supervisor';

interface RoleContextType {
  currentRole: UserRole;
  currentRoleDID: string;
  setRole: (role: UserRole) => void;
  canSeeField: (field: string) => boolean;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

// Define DID for each role
const roleDIDs: Record<UserRole, string> = {
  Operator: 'did:webvh:example.com:roles:operator-001',
  Recycler: 'did:webvh:example.com:roles:recycler-001',
  Manufacturer: 'did:webvh:example.com:organizations:window-manufacturer',
  Supervisor: 'did:webvh:example.com:roles:supervisor-001',
};

// Define what each role can see
const rolePermissions: Record<UserRole, string[]> = {
  Operator: ['basic', 'materials', 'lifecycle', 'operations'],
  Recycler: ['basic', 'materials', 'dimensions', 'weight'],
  Manufacturer: ['basic', 'materials', 'lifecycle', 'operations', 'manufacturing', 'suppliers', 'costs'],
  Supervisor: ['basic', 'materials', 'lifecycle', 'operations', 'manufacturing', 'suppliers', 'costs', 'sensitive', 'all'],
};

export function RoleProvider({ children }: { children: ReactNode }) {
  const [currentRole, setCurrentRole] = useState<UserRole>('Operator');

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
