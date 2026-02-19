import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import Button from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { LogOut, Crown, Shield, Users, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Settings() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [blocked, setBlocked] = useState([]);

  useEffect(() => {
    api.get('/reports/blocked').then(({ data }) => setBlocked(data)).catch(() => {});
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleUnblock = async (userId) => {
    await api.delete(`/reports/block/${userId}`);
    setBlocked((prev) => prev.filter((b) => b.id !== userId));
  };

  const menuItems = [
    { icon: Crown, label: 'Premium', to: '/premium', color: 'text-gold' },
    ...(user?.isAdmin ? [{ icon: Shield, label: 'Admin Dashboard', to: '/admin', color: 'text-red-400' }] : []),
  ];

  return (
    <AppLayout>
      <h1 className="text-xl font-bold text-white mb-6">Settings</h1>

      <div className="space-y-1 mb-8">
        {menuItems.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="flex items-center justify-between p-4 rounded-xl hover:bg-dark-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <item.icon className={item.color} size={20} />
              <span className="text-white font-medium">{item.label}</span>
            </div>
            <ChevronRight className="text-gray-600" size={18} />
          </Link>
        ))}
      </div>

      {/* Blocked Users */}
      {blocked.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
            <Users size={16} /> Blocked Users
          </h2>
          <div className="space-y-2">
            {blocked.map((b) => (
              <div key={b.id} className="flex items-center justify-between p-3 bg-dark-50 rounded-xl">
                <span className="text-white text-sm">{b.profile?.displayName || 'Unknown'}</span>
                <Button variant="ghost" className="text-xs text-red-400" onClick={() => handleUnblock(b.id)}>Unblock</Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <Button variant="danger" className="w-full" onClick={handleLogout}>
        <LogOut size={16} className="inline mr-2" /> Sign Out
      </Button>
    </AppLayout>
  );
}
