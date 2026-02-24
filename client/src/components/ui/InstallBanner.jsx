import { useState, useEffect, useRef } from 'react';
import { Download, X, Share } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const DISMISS_KEY = 'motion_install_dismissed';
const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

function isDismissedRecently() {
  const ts = localStorage.getItem(DISMISS_KEY);
  if (!ts) return false;
  return Date.now() - Number(ts) < COOLDOWN_MS;
}

export default function InstallBanner({ vibeShowing }) {
  const { user } = useAuth();
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isIOSDevice, setIsIOSDevice] = useState(false);
  const promptRef = useRef(null);

  // Listen for beforeinstallprompt (Android/Chrome)
  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      promptRef.current = e;
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Determine visibility
  useEffect(() => {
    if (!user?.hasProfile) return;
    if (isStandalone()) return;
    if (isDismissedRecently()) return;

    if (isIOS()) {
      setIsIOSDevice(true);
      setShowBanner(true);
    } else if (deferredPrompt) {
      setShowBanner(true);
    }
  }, [user, deferredPrompt]);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setShowBanner(false);
  };

  const handleInstall = async () => {
    if (promptRef.current) {
      promptRef.current.prompt();
      const result = await promptRef.current.userChoice;
      if (result.outcome === 'accepted') {
        localStorage.setItem(DISMISS_KEY, 'permanent');
      }
      promptRef.current = null;
      setDeferredPrompt(null);
    }
    setShowBanner(false);
  };

  if (!showBanner || vibeShowing) return null;

  return (
    <div className="max-w-lg mx-auto px-4 pt-2">
      <div className="bg-gradient-to-r from-gold/20 to-amber-500/20 border border-gold/30 rounded-2xl p-3 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-gold/20 flex items-center justify-center flex-shrink-0">
          <Download className="text-gold" size={18} />
        </div>
        <div className="flex-1 min-w-0">
          {isIOSDevice ? (
            <>
              <p className="text-sm font-semibold text-white">Install Motion</p>
              <p className="text-xs text-gray-400">
                Tap <Share size={12} className="inline text-blue-400 -mt-0.5" /> then "Add to Home Screen"
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-white">Install Motion</p>
              <p className="text-xs text-gray-400">Add to your home screen for the best experience</p>
            </>
          )}
        </div>
        {!isIOSDevice && (
          <button
            onClick={handleInstall}
            className="px-3 py-1.5 bg-gold text-black text-xs font-bold rounded-full flex-shrink-0 hover:bg-gold/90 transition-colors"
          >
            Install
          </button>
        )}
        <button
          onClick={dismiss}
          className="text-gray-500 hover:text-white flex-shrink-0"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
