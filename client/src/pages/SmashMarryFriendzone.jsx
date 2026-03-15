import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import AppLayout from '../components/layout/AppLayout';
import api from '../services/api';
import { ArrowLeft, Flame, Heart, HandMetal, Lock, Clock } from 'lucide-react';

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

                  <div className="flex gap-4 p-4">
                    {/* Photo */}
                    <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-dark-100">
                      {user.photo ? (
                        <img src={user.photo} alt={user.displayName} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-500 text-2xl font-bold">
                          {user.displayName?.[0]}
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-white font-bold text-base truncate">{user.displayName}</h3>
                      <p className="text-gray-400 text-sm">
                        {user.age && `${user.age}`}
                        {user.age && user.city && ' · '}
                        {user.city && user.city}
                      </p>

                      {/* Category buttons */}
                      <div className="flex gap-2 mt-2.5">
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
            {roundsLeft} round{roundsLeft !== 1 ? 's' : ''} left today
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
                      <img src={user.photo} alt={user.displayName} className="w-full h-full object-cover" />
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
              <p className="text-white font-bold">Come back tomorrow!</p>
              <p className="text-gray-400 text-sm">You've used all 3 rounds today</p>
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
            {notEnoughUsers ? 'Not enough profiles yet' : "You've played all 3 rounds today!"}
          </h2>
          <p className="text-gray-400 text-sm mb-1">
            {notEnoughUsers
              ? 'Check back when more people join.'
              : countdown
              ? `New rounds in ${countdown}`
              : 'Come back tomorrow for more rounds'}
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
    </AppLayout>
  );
}
