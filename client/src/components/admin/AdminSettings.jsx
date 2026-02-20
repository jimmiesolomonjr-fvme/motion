import { useState, useEffect } from 'react';
import api from '../../services/api';
import { Settings, MessageCircle, Users, FileText } from 'lucide-react';

const DEFAULT_STEPPER_MSG = `Welcome to Motion, King! 👑\n\nYou're officially a Stepper. Here's how to get started:\n\n• Browse Baddies in the Feed and send a Like\n• Post a Move to invite Baddies to link up\n• Complete your profile to stand out\n\nLet's get it! 🚀`;
const DEFAULT_BADDIE_MSG = `Welcome to Motion, Queen! ✨\n\nYou're officially a Baddie. Here's how to get started:\n\n• Browse the Feed and Like a Stepper you're feeling\n• Check out Moves to see what Steppers are planning\n• Complete your profile so they notice you\n\nTime to shine! 💅`;

export default function AdminSettings() {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [stepperMsg, setStepperMsg] = useState('');
  const [baddieMsg, setBaddieMsg] = useState('');
  const [showStepperMsg, setShowStepperMsg] = useState(false);
  const [showBaddieMsg, setShowBaddieMsg] = useState(false);
  const [savingMsg, setSavingMsg] = useState(null);

  useEffect(() => {
    api.get('/admin/settings').then(({ data }) => {
      setSettings(data);
      setStepperMsg(data.welcomeMessageStepper || DEFAULT_STEPPER_MSG);
      setBaddieMsg(data.welcomeMessageBaddie || DEFAULT_BADDIE_MSG);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const toggleSetting = async (key) => {
    const newValue = settings[key] === 'true' ? 'false' : 'true';
    await api.put(`/admin/settings/${key}`, { value: newValue });
    setSettings({ ...settings, [key]: newValue });
  };

  const saveWelcomeMessage = async (key, value) => {
    setSavingMsg(key);
    try {
      await api.put(`/admin/settings/${key}`, { value });
      setSettings({ ...settings, [key]: value });
    } catch (err) {
      console.error('Save welcome message error:', err);
    } finally {
      setSavingMsg(null);
    }
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

      {/* Welcome Message — Steppers */}
      <div className="bg-dark-100 rounded-xl p-4">
        <button
          onClick={() => setShowStepperMsg(!showStepperMsg)}
          className="flex items-center justify-between w-full"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gold/20 flex items-center justify-center">
              <FileText size={18} className="text-gold" />
            </div>
            <div className="text-left">
              <p className="font-semibold text-white text-sm">Welcome Message — Steppers</p>
              <p className="text-xs text-gray-400">Sent to new Steppers on signup</p>
            </div>
          </div>
          <span className={`text-gray-500 text-xs transition-transform ${showStepperMsg ? 'rotate-180' : ''}`}>▼</span>
        </button>
        {showStepperMsg && (
          <div className="mt-3 space-y-2">
            <textarea
              value={stepperMsg}
              onChange={(e) => setStepperMsg(e.target.value)}
              rows={6}
              className="w-full bg-dark-50 text-white text-sm rounded-lg px-3 py-2 border border-dark-50 focus:border-gold/50 outline-none resize-none"
            />
            <button
              onClick={() => saveWelcomeMessage('welcomeMessageStepper', stepperMsg)}
              disabled={savingMsg === 'welcomeMessageStepper'}
              className="px-4 py-1.5 bg-gold text-dark text-sm font-semibold rounded-lg hover:bg-gold/90 disabled:opacity-50 transition-colors"
            >
              {savingMsg === 'welcomeMessageStepper' ? 'Saving...' : 'Save'}
            </button>
          </div>
        )}
      </div>

      {/* Welcome Message — Baddies */}
      <div className="bg-dark-100 rounded-xl p-4">
        <button
          onClick={() => setShowBaddieMsg(!showBaddieMsg)}
          className="flex items-center justify-between w-full"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
              <FileText size={18} className="text-purple-400" />
            </div>
            <div className="text-left">
              <p className="font-semibold text-white text-sm">Welcome Message — Baddies</p>
              <p className="text-xs text-gray-400">Sent to new Baddies on signup</p>
            </div>
          </div>
          <span className={`text-gray-500 text-xs transition-transform ${showBaddieMsg ? 'rotate-180' : ''}`}>▼</span>
        </button>
        {showBaddieMsg && (
          <div className="mt-3 space-y-2">
            <textarea
              value={baddieMsg}
              onChange={(e) => setBaddieMsg(e.target.value)}
              rows={6}
              className="w-full bg-dark-50 text-white text-sm rounded-lg px-3 py-2 border border-dark-50 focus:border-gold/50 outline-none resize-none"
            />
            <button
              onClick={() => saveWelcomeMessage('welcomeMessageBaddie', baddieMsg)}
              disabled={savingMsg === 'welcomeMessageBaddie'}
              className="px-4 py-1.5 bg-purple-accent text-white text-sm font-semibold rounded-lg hover:bg-purple-accent/90 disabled:opacity-50 transition-colors"
            >
              {savingMsg === 'welcomeMessageBaddie' ? 'Saving...' : 'Save'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
