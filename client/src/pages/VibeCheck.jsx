import { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import AppLayout from '../components/layout/AppLayout';
import QuestionCard from '../components/vibe-check/QuestionCard';
import api from '../services/api';
import { Sparkles } from 'lucide-react';

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
  const [questions, setQuestions] = useState([]);
  const [remaining, setRemaining] = useState(0);
  const [resetsAt, setResetsAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [answered, setAnswered] = useState(0);

  const countdown = useCountdown(resetsAt);

  useEffect(() => {
    fetchQuestions();
  }, []);

  const fetchQuestions = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/vibe/questions');
      setQuestions(data.questions);
      setRemaining(data.remaining);
      if (data.resetsAt) setResetsAt(data.resetsAt);
    } catch (err) {
      console.error('Vibe error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAnswer = async (questionId, answer) => {
    try {
      await api.post('/vibe/answer', { questionId, answer });
      setQuestions((prev) => prev.filter((q) => q.id !== questionId));
      setAnswered((prev) => prev + 1);
      setRemaining((prev) => prev - 1);
    } catch (err) {
      console.error('Answer error:', err);
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
        </div>
        <p className="text-gray-400 text-sm">Answer questions to find your best matches</p>
        <p className="text-xs text-gray-500 mt-1">{remaining} questions remaining today</p>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-dark-50 rounded-full h-1.5 mb-6">
        <div
          className="bg-gradient-purple h-1.5 rounded-full transition-all duration-500"
          style={{ width: `${(answered / 10) * 100}%` }}
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
                : 'Come back tomorrow for more Vibe Check questions'
              : 'New questions are added regularly'}
          </p>
        </div>
      )}
    </AppLayout>
  );
}
