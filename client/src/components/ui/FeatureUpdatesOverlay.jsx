import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Ruler, Moon, Video, Tag } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { APP_VERSION } from '../../utils/constants';

const FEATURES = [
  {
    icon: Ruler,
    color: 'text-gold',
    bg: 'bg-gold/10',
    title: 'Height, Weight & Occupation',
    description: 'New profile fields so people get the full picture.',
  },
  {
    icon: Moon,
    color: 'text-purple-400',
    bg: 'bg-purple-400/10',
    title: 'AfterDark Vibe Questions',
    description: 'Spicy new questions for late-night vibes.',
  },
  {
    icon: Video,
    color: 'text-blue-400',
    bg: 'bg-blue-400/10',
    title: 'Video Stories',
    description: 'Share short video stories that disappear in 24 hours.',
  },
  {
    icon: Tag,
    color: 'text-green-400',
    bg: 'bg-green-400/10',
    title: 'Looking For Tags',
    description: 'Tags to show exactly what you\'re looking for.',
  },
];

export default function FeatureUpdatesOverlay() {
  const { user } = useAuth();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!user?.hasProfile) return;
    const lastSeen = localStorage.getItem('motion_last_seen_version');
    if (lastSeen !== APP_VERSION) {
      setShow(true);
    }
  }, [user]);

  const dismiss = () => {
    localStorage.setItem('motion_last_seen_version', APP_VERSION);
    setShow(false);
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
              <p className="text-sm text-gray-400">We've been cooking. Here's what's fresh.</p>
            </div>

            {/* Feature Cards */}
            <div className="space-y-3 mb-6">
              {FEATURES.map((feature, i) => (
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
