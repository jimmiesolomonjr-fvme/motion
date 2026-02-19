import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import Dashboard from '../components/admin/Dashboard';
import ReportsList from '../components/admin/ReportsList';
import UserManagement from '../components/admin/UserManagement';
import VibeQuestions from '../components/admin/VibeQuestions';
import HiddenPairs from '../components/admin/HiddenPairs';
import AdminSettings from '../components/admin/AdminSettings';
import { useAuth } from '../context/AuthContext';
import { BarChart3, AlertTriangle, Users, Sparkles, EyeOff, Settings } from 'lucide-react';

export default function Admin() {
  const { user } = useAuth();
  const [tab, setTab] = useState('dashboard');

  if (!user?.isAdmin) return <Navigate to="/feed" />;

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'reports', label: 'Reports', icon: AlertTriangle },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'vibe', label: 'Vibe', icon: Sparkles },
    { id: 'hidden', label: 'Hidden', icon: EyeOff },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <AppLayout>
      <h1 className="text-xl font-bold text-white mb-4">Admin Panel</h1>

      <div className="flex gap-1 mb-6 bg-dark-50 p-1 rounded-xl">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
              tab === id ? 'bg-gold text-dark' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {tab === 'dashboard' && <Dashboard />}
      {tab === 'reports' && <ReportsList />}
      {tab === 'users' && <UserManagement />}
      {tab === 'vibe' && <VibeQuestions />}
      {tab === 'hidden' && <HiddenPairs />}
      {tab === 'settings' && <AdminSettings />}
    </AppLayout>
  );
}
