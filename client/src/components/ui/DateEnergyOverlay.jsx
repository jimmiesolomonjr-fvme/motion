import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { APP_VERSION, DATE_ENERGY_OPTIONS } from '../../utils/constants';
import api from '../../services/api';

const STORAGE_KEY = 'motion_date_energy_ts';
const COOLDOWN_MS = 4 * 60 * 60 * 1000; // 4 hours

export default function DateEnergyOverlay() {
  const { user } = useAuth();
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user?.hasProfile) return;
    // Don't show if FeatureUpdatesOverlay hasn't been dismissed for this version yet
    const lastSeen = localStorage.getItem('motion_last_seen_version');
    if (lastSeen !== APP_VERSION) return;
    // Only show every 4 hours
    const lastAsked = parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10);
    if (Date.now() - lastAsked < COOLDOWN_MS) return;
    setShow(true);
  }, [user]);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
    setShow(false);
  };

  const selectEnergy = async (value) => {
    setSaving(true);
    try {
      await api.put('/users/energy', { energy: value });
    } catch (err) {
      console.error('Set energy error:', err);
    }
    setSaving(false);
    dismiss();
  };

  const skip = () => {
    dismiss();
  };

  if (!show) return null;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-end justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={skip} />

          {/* Sheet */}
          <motion.div
            className="relative w-full max-w-lg bg-dark-100/95 backdrop-blur-xl rounded-t-3xl p-6 pb-8"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            {/* Handle */}
            <div className="w-10 h-1 bg-gray-600 rounded-full mx-auto mb-5" />

            {/* Header */}
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-white mb-1">What's your energy?</h2>
              <p className="text-sm text-gray-400">Let people know your vibe right now</p>
            </div>

            {/* Energy Options */}
            <div className="space-y-2.5 mb-6">
              {DATE_ENERGY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => selectEnergy(opt.value)}
                  disabled={saving}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border ${opt.border} ${opt.bg} transition-all active:scale-[0.98] disabled:opacity-50`}
                >
                  <span className="text-2xl">{opt.emoji}</span>
                  <span className={`font-semibold text-sm ${opt.color}`}>{opt.value}</span>
                </button>
              ))}
            </div>

            {/* Skip */}
            <button
              onClick={skip}
              className="w-full text-center text-sm text-gray-500 hover:text-gray-300 transition-colors"
            >
              Skip for now
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
