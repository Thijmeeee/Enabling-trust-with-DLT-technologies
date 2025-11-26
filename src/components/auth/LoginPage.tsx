import { useState } from 'react';
import { Shield, User, Factory, Recycle, Eye, FileCheck, Activity } from 'lucide-react';

type UserRole = 'manufacturer' | 'operator' | 'recycler' | 'supervisor' | 'witness' | 'watcher';

interface LoginPageProps {
  onLogin: (role: UserRole, username: string) => void;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [username, setUsername] = useState('');

  const roles = [
    {
      id: 'manufacturer' as UserRole,
      name: 'Manufacturer',
      description: 'Create and manage product DPPs',
      icon: Factory,
      color: 'blue',
    },
    {
      id: 'operator' as UserRole,
      name: 'Operator',
      description: 'Operate and maintain products',
      icon: User,
      color: 'green',
    },
    {
      id: 'recycler' as UserRole,
      name: 'Recycler',
      description: 'Process end-of-life products',
      icon: Recycle,
      color: 'purple',
    },
    {
      id: 'supervisor' as UserRole,
      name: 'Supervisor',
      description: 'Monitor and audit all activities',
      icon: Eye,
      color: 'orange',
    },
    {
      id: 'witness' as UserRole,
      name: 'Witness Node',
      description: 'Validate and sign DID events',
      icon: FileCheck,
      color: 'emerald',
    },
    {
      id: 'watcher' as UserRole,
      name: 'Watcher Node',
      description: 'Monitor integrity and detect anomalies',
      icon: Activity,
      color: 'rose',
    },
  ];

  const handleLogin = () => {
    if (selectedRole && username.trim()) {
      onLogin(selectedRole, username.trim());
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-full mb-4">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">DPP Platform</h1>
          <p className="text-gray-600">Select your role to access the Digital Product Passport system</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Choose Your Role</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {roles.map((role) => {
              const Icon = role.icon;
              const isSelected = selectedRole === role.id;
              
              return (
                <button
                  key={role.id}
                  onClick={() => setSelectedRole(role.id)}
                  className={`p-6 rounded-xl border-2 transition-all text-left ${
                    isSelected
                      ? `border-${role.color}-600 bg-${role.color}-50`
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`p-3 rounded-lg ${
                        isSelected ? `bg-${role.color}-600` : `bg-${role.color}-100`
                      }`}
                    >
                      <Icon className={`w-6 h-6 ${isSelected ? 'text-white' : `text-${role.color}-600`}`} />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 mb-1">{role.name}</h3>
                      <p className="text-sm text-gray-600">{role.description}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            />
          </div>

          <button
            onClick={handleLogin}
            disabled={!selectedRole || !username.trim()}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Login
          </button>
        </div>

        <div className="text-center text-sm text-gray-500">
          <p>Demo Mode - No actual authentication required</p>
        </div>
      </div>
    </div>
  );
}
