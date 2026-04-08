import { useState, useEffect } from 'react';
import { Heart, X, Clock, MapPin, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Modal from '../ui/Modal';
import Avatar from '../ui/Avatar';

export default function PairingModal({ pairing, onClose, onRespond }) {
  const [timeLeft, setTimeLeft] = useState('');
  const [responding, setResponding] = useState(false);

  useEffect(() => {
    if (!pairing?.pairing?.expiresAt) return;

    const update = () => {
      const diff = new Date(pairing.pairing.expiresAt).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft('Expired');
        return;
      }
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      setTimeLeft(`${hours}h ${mins}m left`);
    };

    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [pairing?.pairing?.expiresAt]);

  if (!pairing) return null;

  const matchedUser = pairing.matchedUser || pairing.pairing?.matchedUser;
  const pairingId = pairing.pairing?.id || pairing.pairingId;
  const moveTitle = pairing.moveTitle || '';

  const handleRespond = async (accepted) => {
    if (responding) return;
    setResponding(true);
    try {
      await onRespond(pairingId, accepted);
    } finally {
      setResponding(false);
    }
  };

  return (
    <Modal isOpen={!!pairing} onClose={onClose} title="">
      <div className="text-center py-2 relative overflow-hidden">
        {/* Sparkle burst */}
        <AnimatePresence>
          <div className="absolute inset-0 pointer-events-none">
            {Array.from({ length: 8 }).map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-1.5 h-1.5 rounded-full bg-purple-400"
                initial={{ x: '50%', y: '40%', scale: 0, opacity: 1 }}
                animate={{
                  x: `${50 + (Math.cos((i * 45) * Math.PI / 180) * 35)}%`,
                  y: `${40 + (Math.sin((i * 45) * Math.PI / 180) * 35)}%`,
                  scale: [0, 1.2, 0],
                  opacity: [1, 1, 0],
                }}
                transition={{ duration: 0.7, delay: i * 0.05, ease: 'easeOut' }}
              />
            ))}
          </div>
        </AnimatePresence>

        <div className="w-16 h-16 rounded-full mx-auto mb-3 ring-4 ring-purple-400/30 overflow-hidden">
          <Avatar
            src={matchedUser?.photos || matchedUser?.profile?.photos}
            name={matchedUser?.displayName || matchedUser?.profile?.displayName}
            size="lg"
          />
        </div>

        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 15, delay: 0.1 }}
        >
          <Sparkles className="text-purple-400 mx-auto mb-2" size={24} />
        </motion.div>

        <h3 className="text-xl font-bold text-white mb-1">You&apos;ve Been Paired!</h3>
        <p className="text-gray-400 text-sm mb-1">
          You and <span className="text-purple-400 font-semibold">
            {matchedUser?.displayName || matchedUser?.profile?.displayName || 'someone'}
          </span>
        </p>
        {moveTitle && (
          <p className="text-xs text-gray-500 mb-3 flex items-center justify-center gap-1">
            <MapPin size={12} /> {moveTitle}
          </p>
        )}

        {/* Timer */}
        {timeLeft && (
          <div className="flex items-center justify-center gap-1.5 mb-4">
            <Clock size={14} className="text-gray-500" />
            <span className="text-xs text-gray-500">{timeLeft}</span>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => handleRespond(false)}
            disabled={responding}
            className="flex-1 px-4 py-2.5 bg-dark-100 text-gray-300 rounded-xl font-semibold text-sm hover:bg-dark-50 transition-colors disabled:opacity-50"
          >
            Pass
          </button>
          <button
            onClick={() => handleRespond(true)}
            disabled={responding}
            className="flex-1 px-4 py-2.5 bg-gradient-to-r from-purple-500 to-gold text-white rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Heart size={16} /> Let&apos;s Go
          </button>
        </div>
      </div>
    </Modal>
  );
}
