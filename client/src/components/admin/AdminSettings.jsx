import { useState, useEffect } from 'react';
import api from '../../services/api';
import { Settings, MessageCircle, Users } from 'lucide-react';

export default function AdminSettings() {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/settings').then(({ data }) => {
      setSettings(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const toggleSetting = async (key) => {
    const newValue = settings[key] === 'true' ? 'false' : 'true';
    await api.put(`/admin/settings/${key}`, { value: newValue });
    setSettings({ ...settings, [key]: newValue });
  };

  if (loading) {
    return <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Settings size={18} className="text-gold" />
        <h2 className="text-lg font-bold text-white">App Settings</h2>
      </div>

      <div className="bg-dark-100 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gold/20 flex items-center justify-center">
              <MessageCircle size={18} className="text-gold" />
            </div>
            <div>
              <p className="font-semibold text-white text-sm">Free Messaging for Steppers</p>
              <p className="text-xs text-gray-400">When on, Steppers can message without Premium</p>
            </div>
          </div>
          <button
            onClick={() => toggleSetting('freeMessaging')}
            className={`relative w-12 h-6 rounded-full transition-colors ${
              settings.freeMessaging === 'true' ? 'bg-green-500' : 'bg-dark-50'
            }`}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                settings.freeMessaging === 'true' ? 'translate-x-6' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
      </div>

      <div className="bg-dark-100 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
              <Users size={18} className="text-purple-400" />
            </div>
            <div>
              <p className="font-semibold text-white text-sm">Show Dummy Users</p>
              <p className="text-xs text-gray-400">When on, seed/test users appear in the feed</p>
            </div>
          </div>
          <button
            onClick={() => toggleSetting('showDummyUsers')}
            className={`relative w-12 h-6 rounded-full transition-colors ${
              settings.showDummyUsers === 'true' ? 'bg-green-500' : 'bg-dark-50'
            }`}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                settings.showDummyUsers === 'true' ? 'translate-x-6' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
