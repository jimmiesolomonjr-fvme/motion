import { Sparkles } from 'lucide-react';

export default function VibeScore({ score, size = 'sm' }) {
  if (score === null || score === undefined) return null;

  const getColor = (s) => {
    if (s >= 80) return 'text-green-400';
    if (s >= 60) return 'text-yellow-400';
    if (s >= 40) return 'text-orange-400';
    return 'text-red-400';
  };

  if (size === 'lg') {
    return (
      <div className="flex flex-col items-center">
        <div className={`text-4xl font-bold ${getColor(score)}`}>{score}%</div>
        <div className="flex items-center gap-1 text-purple-glow text-sm">
          <Sparkles size={14} />
          <span>Vibe Score</span>
        </div>
      </div>
    );
  }

  return (
    <span className={`vibe-score inline-flex items-center gap-1 ${getColor(score)}`}>
      <Sparkles size={10} />
      {score}%
    </span>
  );
}
