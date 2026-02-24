import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { APP_VERSION } from '../../utils/constants';

const CHECK_THROTTLE_MS = 5 * 60 * 1000; // 5 minutes

export default function UpdateBanner() {
  const { user } = useAuth();
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const lastCheckRef = useRef(0);

  const checkForUpdate = useCallback(async () => {
    if (!user) return;
    const now = Date.now();
    if (now - lastCheckRef.current < CHECK_THROTTLE_MS) return;
    lastCheckRef.current = now;

    try {
      const res = await fetch(`/version.json?t=${now}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.version && data.version !== APP_VERSION) {
        setUpdateAvailable(true);
      }
    } catch {
      // Silently ignore fetch errors
    }
  }, [user]);

  useEffect(() => {
    checkForUpdate();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        setDismissed(false);
        checkForUpdate();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [checkForUpdate]);

  const handleUpdate = () => {
    window.location.reload();
  };

  if (!user || !updateAvailable || dismissed) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -40, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="fixed top-0 left-0 right-0 z-50"
      >
        <div className="bg-gradient-to-r from-dark-100 to-dark-200 border-b border-gold/20 px-4 py-2 flex items-center justify-center gap-3">
          <RefreshCw size={14} className="text-gold flex-shrink-0" />
          <span className="text-xs text-gray-300">A new version is available</span>
          <button
            onClick={handleUpdate}
            className="px-3 py-0.5 bg-gold text-black text-xs font-bold rounded-full hover:bg-gold/90 transition-colors"
          >
            Update
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="text-gray-500 hover:text-white flex-shrink-0 ml-1"
          >
            <X size={14} />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
