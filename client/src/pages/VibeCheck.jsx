import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import AppLayout from '../components/layout/AppLayout';
import QuestionCard from '../components/vibe-check/QuestionCard';
import StreakCelebration from '../components/vibe-check/StreakCelebration';
import api from '../services/api';
import { Sparkles, Flame } from 'lucide-react';

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

export default function VibeCheck() {
  const navigate = useNavigate();
  const [questions, setQuestions] = useState([]);
  const [remaining, setRemaining] = useState(0);
  const [resetsAt, setResetsAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [answered, setAnswered] = useState(0);
  const [vibeStreak, setVibeStreak] = useState(0);
  const [topMatches, setTopMatches] = useState([]);
  const [vibeMatch, setVibeMatch] = useState(null);
  const [streakMilestone, setStreakMilestone] = useState(null);

  const countdown = useCountdown(resetsAt);

  const fetchTopMatches = async () => {
    try {
      const { data } = await api.get('/vibe/top-matches');
      setTopMatches(data.matches || []);
    } catch {}
  };

  useEffect(() => {
    fetchQuestions();
    fetchTopMatches();
  }, []);

  const fetchQuestions = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/vibe/questions');
      setQuestions(data.questions);
      setRemaining(data.remaining);
      if (data.vibeStreak !== undefined) setVibeStreak(data.vibeStreak);
      if (data.resetsAt) setResetsAt(data.resetsAt);
    } catch (err) {
      console.error('Vibe error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAnswer = async (questionId, answer) => {
    try {
      const { data } = await api.post('/vibe/answer', { questionId, answer });
      setQuestions((prev) => prev.filter((q) => q.id !== questionId));
      setAnswered((prev) => prev + 1);
      setRemaining((prev) => prev - 1);
      if (data.vibeStreak !== undefined) {
        const prev = vibeStreak;
        setVibeStreak(data.vibeStreak);
        if (data.vibeStreak !== prev && [7, 14, 30].includes(data.vibeStreak)) {
          setStreakMilestone(data.vibeStreak);
        }
      }
      if (data.vibeMatch) setVibeMatch(data.vibeMatch);
      fetchTopMatches();
    } catch (err) {
      console.error('Answer error:', err);
    }
  };

  const handleSayHey = async (userId) => {
    try {
      const { data } = await api.post(`/messages/start/${userId}`, { content: 'Hey! We vibe! 💜' });
      setVibeMatch(null);
      navigate(`/chat/${data.id}`);
    } catch (err) {
      console.error('Say hey error:', err);
      setVibeMatch(null);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="text-center mb-6">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Sparkles className="text-purple-glow" size={20} />
          <h1 className="text-xl font-bold text-white">Vibe Check</h1>
          {vibeStreak > 0 && (
            <span className="flex items-center gap-1 text-orange-400 text-sm font-bold ml-1">
              <Flame size={16} />
              {vibeStreak}
            </span>
          )}
        </div>
        <p className="text-gray-400 text-sm">Answer questions to find your best matches</p>
        <p className="text-xs text-gray-500 mt-1">{remaining} questions remaining today</p>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-dark-50 rounded-full h-1.5 mb-6">
        <motion.div
          className="bg-gradient-purple h-1.5 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${(answered / 25) * 100}%` }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        />
      </div>

      {questions.length > 0 ? (
        <AnimatePresence mode="wait">
          <QuestionCard
            key={questions[0].id}
            question={questions[0]}
            onAnswer={handleAnswer}
          />
        </AnimatePresence>
      ) : (
        <div className="text-center py-16">
          <div className="w-20 h-20 rounded-full bg-purple-accent/20 flex items-center justify-center mx-auto mb-4">
            <Sparkles className="text-purple-glow" size={32} />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">
            {remaining === 0 ? "You're all caught up!" : 'No more questions'}
          </h3>
          <p className="text-gray-400 text-sm">
            {remaining === 0
              ? countdown
                ? `New questions in ${countdown}`
                : 'Come back later for more Vibe Check questions'
              : 'New questions are added regularly'}
          </p>
        </div>
      )}

      {/* Top 3 Vibe Matches */}
      {topMatches.length > 0 && (
        <div className="mt-8">
          <h3 className="text-sm font-semibold text-gray-400 mb-3 text-center">Top Vibe Matches</h3>
          <div className="flex justify-center gap-4">
            {topMatches.map((match, i) => (
              <motion.div
                key={match.userId}
                layoutId={`match-${match.userId}`}
                onClick={() => navigate(`/profile/${match.userId}`)}
                className="flex flex-col items-center cursor-pointer"
              >
                <div className={`relative w-16 h-16 rounded-full overflow-hidden ${i === 0 ? 'ring-2 ring-gold' : 'ring-1 ring-gray-600'}`}>
                  {match.photo ? (
                    <img src={match.photo} alt={match.displayName} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-dark-50 flex items-center justify-center text-gray-500 text-lg font-bold">
                      {match.displayName?.[0]}
                    </div>
                  )}
                </div>
                {i === 0 && (
                  <span className="text-[10px] text-gold font-bold mt-0.5">Best Match</span>
                )}
                <span className="text-xs text-white mt-0.5 truncate max-w-[70px]">{match.displayName}</span>
                <span className="text-xs text-purple-glow font-bold">{match.score}%</span>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* "You're Vibing" Popup */}
      <AnimatePresence>
        {vibeMatch && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
            onClick={() => setVibeMatch(null)}
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className="bg-dark-50 rounded-3xl p-8 text-center max-w-sm w-full border border-purple-accent/30"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-20 h-20 rounded-full overflow-hidden mx-auto mb-4 ring-2 ring-purple-glow">
                {vibeMatch.photo ? (
                  <img src={vibeMatch.photo} alt={vibeMatch.displayName} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-dark-100 flex items-center justify-center text-2xl font-bold text-gray-500">
                    {vibeMatch.displayName?.[0]}
                  </div>
                )}
              </div>
              <h3 className="text-lg font-bold text-white mb-1">You're vibing with</h3>
              <p className="text-purple-glow font-bold text-xl mb-6">{vibeMatch.displayName}!</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setVibeMatch(null)}
                  className="flex-1 py-3 rounded-xl bg-dark-100 border border-gray-600 text-gray-300 font-bold"
                >
                  Dismiss
                </button>
                <button
                  onClick={() => handleSayHey(vibeMatch.userId)}
                  className="flex-1 py-3 rounded-xl bg-gold text-dark font-bold"
                >
                  Say Hey
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Streak Milestone Celebration */}
      <AnimatePresence>
        {streakMilestone && (
          <StreakCelebration
            days={streakMilestone}
            onDone={() => setStreakMilestone(null)}
          />
        )}
      </AnimatePresence>
    </AppLayout>
  );
}
