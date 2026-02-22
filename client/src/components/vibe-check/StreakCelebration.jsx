import { useEffect } from 'react';
import { motion } from 'framer-motion';

const PARTICLE_COLORS = ['#FFD700', '#A855F7', '#EC4899', '#F97316', '#34D399', '#60A5FA'];

function Particle({ index, total }) {
  const angle = (index / total) * 360;
  const rad = (angle * Math.PI) / 180;
  const distance = 120 + Math.random() * 40;
  const size = 6 + Math.random() * 6;
  const color = PARTICLE_COLORS[index % PARTICLE_COLORS.length];

  return (
    <motion.div
      initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
      animate={{
        x: Math.cos(rad) * distance,
        y: Math.sin(rad) * distance,
        scale: 0,
        opacity: 0,
      }}
      transition={{ duration: 1.2, ease: 'easeOut' }}
      className="absolute rounded-full"
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        top: '50%',
        left: '50%',
        marginTop: -size / 2,
        marginLeft: -size / 2,
      }}
    />
  );
}

export default function StreakCelebration({ days, onDone }) {
  useEffect(() => {
    const timer = setTimeout(onDone, 2000);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none"
    >
      <div className="relative">
        {/* Particles */}
        {Array.from({ length: 12 }).map((_, i) => (
          <Particle key={i} index={i} total={12} />
        ))}

        {/* Center badge */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          exit={{ scale: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 15, delay: 0.1 }}
          className="bg-dark-50 border-2 border-orange-400 rounded-2xl px-6 py-4 text-center shadow-lg shadow-orange-400/20"
        >
          <span className="text-3xl">🔥</span>
          <p className="text-orange-400 font-bold text-lg mt-1">{days} Day Streak!</p>
        </motion.div>
      </div>
    </motion.div>
  );
}
