import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import AppLayout from '../components/layout/AppLayout';
import api from '../services/api';
import { ArrowLeft, Flame, Heart, HandMetal, Lock, Clock, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { optimizeCloudinaryUrl } from '../utils/cloudinaryUrl';

const CATEGORIES = [
  { key: 'smash', label: 'Smash', emoji: '🔥', color: 'bg-red-500', border: 'border-red-500', text: 'text-red-400', bg: 'bg-red-500/10' },
  { key: 'marry', label: 'Marry', emoji: '💍', color: 'bg-yellow-500', border: 'border-yellow-500', text: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  { key: 'friendzone', label: 'Friendzone', emoji: '👋', color: 'bg-blue-500', border: 'border-blue-500', text: 'text-blue-400', bg: 'bg-blue-500/10' },
];

function useCountdown(resetsAt) {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    if (!resetsAt) return;
    const target = new Date(resetsAt).getTime();

    const tick = () => {
      const diff = target - Date.now();
      if (diff <= 0) {
        setTimeLeft('');
        return;
      }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${h}h ${m}m ${s}s`);
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [resetsAt]);

  return timeLeft;
}

export default function SmashMarryFriendzone() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState('loading'); // loading | game | results | limited
  const [users, setUsers] = useState([]);
  const [assignments, setAssignments] = useState({}); // { userId: 'smash' | 'marry' | 'friendzone' }
  const [roundsLeft, setRoundsLeft] = useState(0);
  const [resetsAt, setResetsAt] = useState(null);
  const [stats, setStats] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [notEnoughUsers, setNotEnoughUsers] = useState(false);
  const [enlargedPhoto, setEnlargedPhoto] = useState(null);

  const countdown = useCountdown(resetsAt);

  const fetchRound = async () => {
    setPhase('loading');
    setAssignments({});
    try {
      const { data } = await api.get('/smf/round');
      if (data.limited) {
        setResetsAt(data.resetsAt);
        setRoundsLeft(0);
        setNotEnoughUsers(!!data.notEnoughUsers);
        setPhase('limited');
        fetchStats();
      } else {
        setUsers(data.users);
        setRoundsLeft(data.roundsLeft);
        setPhase('game');
      }
    } catch (err) {
      console.error('SMF fetch error:', err);
      setPhase('limited');
    }
  };

  const fetchStats = async () => {
    try {
      const { data } = await api.get('/smf/stats');
      setStats(data);
    } catch {}
  };

  useEffect(() => {
    fetchRound();
    fetchStats();
  }, []);

  const assignedCategories = new Set(Object.values(assignments));

  const handleAssign = (userId, category) => {
    setAssignments((prev) => {
      const next = { ...prev };
      // If this user already has a category, remove it
      if (next[userId] === category) {
        delete next[userId];
        return next;
      }
      // If another user has this category, remove theirs
      for (const [uid, cat] of Object.entries(next)) {
        if (cat === category) delete next[uid];
      }
      next[userId] = category;
      return next;
    });
  };

  const allAssigned = Object.keys(assignments).length === 3;

  const handleSubmit = async () => {
    if (!allAssigned || submitting) return;
    setSubmitting(true);
    try {
      const picks = Object.entries(assignments).map(([userId, pick]) => ({ userId, pick }));
      const { data } = await api.post('/smf/round', { picks });
      setRoundsLeft(data.roundsLeft);
      setPhase('results');
      fetchStats();
    } catch (err) {
      console.error('SMF submit error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePlayAgain = () => {
    if (roundsLeft > 0) {
      fetchRound();
    }
  };

  const getCategoryForUser = (userId) => {
    const pick = assignments[userId];
    return CATEGORIES.find((c) => c.key === pick);
  };

  return (
    <AppLayout>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/vibe')} className="text-gray-400 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-white">Smash Marry Friendzone</h1>
          <p className="text-gray-400 text-xs">Rate 3 profiles each round</p>
        </div>
        <span className="ml-auto text-lg">🔥💍👋</span>
      </div>

      {/* Loading */}
      {phase === 'loading' && (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Game Phase */}
      {phase === 'game' && (
        <div>
          <p className="text-center text-gray-400 text-sm mb-4">
            Assign each profile: one Smash, one Marry, one Friendzone
          </p>

          <div className="space-y-4">
            {users.map((user, i) => {
              const cat = getCategoryForUser(user.id);
              return (
                <motion.div
                  key={user.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className={`relative bg-dark-50 rounded-2xl overflow-hidden border transition-all ${
                    cat ? cat.border : 'border-gray-700/50'
                  }`}
                >
                  {/* Badge */}
                  <AnimatePresence>
                    {cat && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        className={`absolute top-3 right-3 z-10 ${cat.color} text-white text-xs font-bold px-2.5 py-1 rounded-full`}
                      >
                        {cat.emoji} {cat.label}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="flex gap-3 p-3">
                    {/* Photo */}
                    <div
                      className="w-28 h-28 rounded-xl overflow-hidden flex-shrink-0 bg-dark-100 cursor-pointer active:scale-95 transition-transform"
                      onClick={() => user.photos?.length > 0 && setEnlargedPhoto({ photos: user.photos, name: user.displayName, index: 0 })}
                    >
                      {user.photo ? (
                        <img src={optimizeCloudinaryUrl(user.photo, { width: 224, crop: 'fill' })} alt={user.displayName} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-500 text-3xl font-bold">
                          {user.displayName?.[0]}
                        </div>
                      )}
                    </div>

                    {/* Info + Buttons */}
                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                      <div>
                        <h3 className="text-white font-bold text-base truncate">{user.displayName}</h3>
                        <p className="text-gray-400 text-sm">
                          {user.age && `${user.age}`}
                          {user.age && user.city && ' · '}
                          {user.city && user.city}
                        </p>
                      </div>

                      {/* Category buttons */}
                      <div className="flex gap-1.5 mt-2">
                        {CATEGORIES.map((c) => {
                          const isSelected = assignments[user.id] === c.key;
                          const isTaken = assignedCategories.has(c.key) && !isSelected;
                          return (
                            <button
                              key={c.key}
                              onClick={() => !isTaken && handleAssign(user.id, c.key)}
                              disabled={isTaken}
                              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                isSelected
                                  ? `${c.color} text-white`
                                  : isTaken
                                  ? 'bg-dark-100 text-gray-600 cursor-not-allowed'
                                  : `${c.bg} ${c.text} hover:opacity-80`
                              }`}
                            >
                              {c.emoji} {c.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Submit button */}
          <AnimatePresence>
            {allAssigned && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="mt-6"
              >
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="w-full py-3.5 rounded-xl bg-gold text-dark font-bold text-base disabled:opacity-50 transition-all"
                >
                  {submitting ? 'Locking in...' : 'Lock it in 🔒'}
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <p className="text-center text-gray-500 text-xs mt-4">
            {roundsLeft} round{roundsLeft !== 1 ? 's' : ''} left
          </p>
        </div>
      )}

      {/* Results Phase */}
      {phase === 'results' && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="text-4xl mb-3">🔥💍👋</div>
          <h2 className="text-xl font-bold text-white mb-1">Round Complete!</h2>
          <p className="text-gray-400 text-sm mb-6">Here's how you rated them:</p>

          <div className="space-y-3 mb-8">
            {users.map((user) => {
              const cat = getCategoryForUser(user.id);
              return (
                <motion.div
                  key={user.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`flex items-center gap-3 p-3 rounded-xl ${cat?.bg || 'bg-dark-50'} border ${cat?.border || 'border-gray-700/50'}`}
                >
                  <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 bg-dark-100">
                    {user.photo ? (
                      <img src={optimizeCloudinaryUrl(user.photo, { width: 96, crop: 'fill' })} alt={user.displayName} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-500 font-bold">
                        {user.displayName?.[0]}
                      </div>
                    )}
                  </div>
                  <span className="text-white font-medium flex-1 text-left truncate">{user.displayName}</span>
                  <span className={`${cat?.color || 'bg-gray-600'} text-white text-xs font-bold px-3 py-1 rounded-full`}>
                    {cat?.emoji} {cat?.label}
                  </span>
                </motion.div>
              );
            })}
          </div>

          {roundsLeft > 0 ? (
            <button
              onClick={handlePlayAgain}
              className="w-full py-3.5 rounded-xl bg-gold text-dark font-bold text-base"
            >
              Play Again? ({roundsLeft} round{roundsLeft !== 1 ? 's' : ''} left)
            </button>
          ) : (
            <div className="bg-dark-50 rounded-xl p-4 border border-gray-700/50">
              <Clock size={24} className="text-gray-400 mx-auto mb-2" />
              <p className="text-white font-bold">Come back soon!</p>
              <p className="text-gray-400 text-sm">You've used all 3 rounds — more in a few hours</p>
            </div>
          )}
        </motion.div>
      )}

      {/* Limited Phase */}
      {phase === 'limited' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-8"
        >
          <div className="w-20 h-20 rounded-full bg-dark-50 flex items-center justify-center mx-auto mb-4">
            {notEnoughUsers ? (
              <HandMetal className="text-gray-400" size={32} />
            ) : (
              <Clock className="text-gray-400" size={32} />
            )}
          </div>
          <h2 className="text-lg font-bold text-white mb-2">
            {notEnoughUsers ? 'Not enough profiles yet' : "You've played all 3 rounds!"}
          </h2>
          <p className="text-gray-400 text-sm mb-1">
            {notEnoughUsers
              ? 'Check back when more people join.'
              : countdown
              ? `New rounds in ${countdown}`
              : 'More rounds coming soon'}
          </p>
        </motion.div>
      )}

      {/* Stats */}
      {stats && (stats.smashCount > 0 || stats.marryCount > 0 || stats.friendzoneCount > 0) && (
        <div className="mt-8 bg-dark-50 rounded-2xl p-4 border border-gray-700/50">
          <h3 className="text-sm font-semibold text-gray-400 mb-3 text-center">Your Ratings from Others</h3>
          <div className="flex justify-around">
            <div className="text-center">
              <div className="text-2xl mb-1">🔥</div>
              <div className="text-white font-bold text-lg">{stats.smashCount}</div>
              <div className="text-gray-500 text-xs">Smash</div>
            </div>
            <div className="text-center">
              <div className="text-2xl mb-1">💍</div>
              <div className="text-white font-bold text-lg">{stats.marryCount}</div>
              <div className="text-gray-500 text-xs">Marry</div>
            </div>
            <div className="text-center">
              <div className="text-2xl mb-1">👋</div>
              <div className="text-white font-bold text-lg">{stats.friendzoneCount}</div>
              <div className="text-gray-500 text-xs">Friendzone</div>
            </div>
          </div>
        </div>
      )}
      {/* Enlarged photo gallery overlay */}
      <AnimatePresence>
        {enlargedPhoto && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/95 z-50 flex flex-col"
            onClick={() => setEnlargedPhoto(null)}
          >
            {/* Close button — large tap target */}
            <button
              onClick={(e) => { e.stopPropagation(); setEnlargedPhoto(null); }}
              className="absolute right-4 z-10 w-10 h-10 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center text-white active:bg-white/30 transition-colors"
              style={{ top: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}
            >
              <X size={22} />
            </button>

            {/* Photo count */}
            {enlargedPhoto.photos.length > 1 && (
              <div
                className="absolute left-1/2 -translate-x-1/2 z-10 bg-black/60 text-white text-xs font-bold px-3 py-1 rounded-full"
                style={{ top: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}
              >
                {enlargedPhoto.index + 1} / {enlargedPhoto.photos.length}
              </div>
            )}

            {/* Scrollable gallery */}
            <div className="flex-1 flex items-center justify-center overflow-hidden" onClick={(e) => e.stopPropagation()}>
              {/* Left arrow */}
              {enlargedPhoto.index > 0 && (
                <button
                  onClick={() => setEnlargedPhoto((prev) => ({ ...prev, index: prev.index - 1 }))}
                  className="absolute left-2 z-10 w-10 h-10 rounded-full bg-black/50 flex items-center justify-center text-white/80 hover:text-white"
                >
                  <ChevronLeft size={24} />
                </button>
              )}

              {/* Right arrow */}
              {enlargedPhoto.index < enlargedPhoto.photos.length - 1 && (
                <button
                  onClick={() => setEnlargedPhoto((prev) => ({ ...prev, index: prev.index + 1 }))}
                  className="absolute right-2 z-10 w-10 h-10 rounded-full bg-black/50 flex items-center justify-center text-white/80 hover:text-white"
                >
                  <ChevronRight size={24} />
                </button>
              )}

              {/* Main photo with peek of next/prev */}
              <div
                className="w-full h-full flex items-center justify-center px-4 relative"
                onTouchStart={(e) => { e.currentTarget._touchX = e.touches[0].clientX; }}
                onTouchEnd={(e) => {
                  const dx = e.changedTouches[0].clientX - (e.currentTarget._touchX || 0);
                  if (dx < -50 && enlargedPhoto.index < enlargedPhoto.photos.length - 1) {
                    setEnlargedPhoto((prev) => ({ ...prev, index: prev.index + 1 }));
                  } else if (dx > 50 && enlargedPhoto.index > 0) {
                    setEnlargedPhoto((prev) => ({ ...prev, index: prev.index - 1 }));
                  }
                }}
              >
                {/* Peek left */}
                {enlargedPhoto.index > 0 && (
                  <div
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-8 h-48 rounded-r-xl overflow-hidden opacity-30 cursor-pointer"
                    onClick={() => setEnlargedPhoto((prev) => ({ ...prev, index: prev.index - 1 }))}
                  >
                    <img src={optimizeCloudinaryUrl(enlargedPhoto.photos[enlargedPhoto.index - 1], { width: 64 })} alt="" className="w-full h-full object-cover" />
                  </div>
                )}

                <AnimatePresence mode="wait">
                  <motion.img
                    key={enlargedPhoto.index}
                    initial={{ opacity: 0, x: 50 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -50 }}
                    transition={{ duration: 0.2 }}
                    src={optimizeCloudinaryUrl(enlargedPhoto.photos[enlargedPhoto.index], { width: 800 })}
                    alt={enlargedPhoto.name}
                    className="max-w-full max-h-[75vh] rounded-2xl object-contain"
                  />
                </AnimatePresence>

                {/* Peek right */}
                {enlargedPhoto.index < enlargedPhoto.photos.length - 1 && (
                  <div
                    className="absolute right-0 top-1/2 -translate-y-1/2 w-8 h-48 rounded-l-xl overflow-hidden opacity-30 cursor-pointer"
                    onClick={() => setEnlargedPhoto((prev) => ({ ...prev, index: prev.index + 1 }))}
                  >
                    <img src={optimizeCloudinaryUrl(enlargedPhoto.photos[enlargedPhoto.index + 1], { width: 64 })} alt="" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>
            </div>

            {/* Bottom: name + dot indicators + close hint */}
            <div className="pb-8 text-center" onClick={(e) => e.stopPropagation()}>
              <p className="text-white font-bold text-lg mb-3">{enlargedPhoto.name}</p>
              {enlargedPhoto.photos.length > 1 && (
                <div className="flex justify-center gap-1.5 mb-4">
                  {enlargedPhoto.photos.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setEnlargedPhoto((prev) => ({ ...prev, index: i }))}
                      className={`w-2 h-2 rounded-full transition-all ${
                        i === enlargedPhoto.index ? 'bg-gold w-4' : 'bg-white/30'
                      }`}
                    />
                  ))}
                </div>
              )}
              <button
                onClick={() => setEnlargedPhoto(null)}
                className="text-gray-500 text-xs"
              >
                Tap anywhere to close
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </AppLayout>
  );
}
