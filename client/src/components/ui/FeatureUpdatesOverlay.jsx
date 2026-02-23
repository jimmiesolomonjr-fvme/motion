import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { APP_VERSION } from '../../utils/constants';
import FEATURE_UPDATES from '../../config/featureUpdates';

export default function FeatureUpdatesOverlay() {
  const { user } = useAuth();
  const [show, setShow] = useState(false);

  const update = FEATURE_UPDATES[APP_VERSION];

  useEffect(() => {
    if (!user?.hasProfile || !update) return;
    const lastSeen = localStorage.getItem('motion_last_seen_version');
    if (lastSeen !== APP_VERSION) {
      setShow(true);
    }
  }, [user, update]);

  const dismiss = () => {
    localStorage.setItem('motion_last_seen_version', APP_VERSION);
    setShow(false);
  };

  if (!show || !update) return null;

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
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={dismiss} />

          {/* Sheet */}
          <motion.div
            className="relative w-full max-w-lg bg-dark-100 rounded-t-3xl p-6 pb-8 max-h-[85vh] overflow-y-auto"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            {/* Handle */}
            <div className="w-10 h-1 bg-gray-600 rounded-full mx-auto mb-5" />

            {/* Header */}
            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-gold/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <Sparkles className="text-gold" size={24} />
              </div>
              <h2 className="text-xl font-bold text-white mb-1">What's New on Motion</h2>
              <p className="text-sm text-gray-400">{update.subtitle}</p>
            </div>

            {/* Feature Cards */}
            <div className="space-y-3 mb-6">
              {update.features.map((feature, i) => (
                <motion.div
                  key={feature.title}
                  className="flex items-start gap-3 p-3.5 bg-dark/60 rounded-xl border border-dark-50"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.08 }}
                >
                  <div className={`w-10 h-10 ${feature.bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                    <feature.icon className={feature.color} size={20} />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold text-sm">{feature.title}</h3>
                    <p className="text-gray-400 text-xs mt-0.5">{feature.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* CTA */}
            <button
              onClick={dismiss}
              className="w-full btn-gold py-3 text-base font-bold rounded-xl"
            >
              Got It
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
