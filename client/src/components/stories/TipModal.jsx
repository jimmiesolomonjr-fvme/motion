import { useState } from 'react';
import { DollarSign, X, Loader2 } from 'lucide-react';
import api from '../../services/api';

const TIP_AMOUNTS = [
  { cents: 100, label: '$1' },
  { cents: 300, label: '$3' },
  { cents: 500, label: '$5' },
  { cents: 1000, label: '$10' },
];

export default function TipModal({ storyId, creatorName, onClose }) {
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSendTip = async () => {
    if (!selected) return;
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/payments/tip', {
        storyId,
        amount: selected,
      });
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to start tip');
      setLoading(false);
    }
  };

  return (
    <div
      className="absolute inset-0 z-30 bg-black/70 flex items-end justify-center"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="w-full max-w-lg bg-dark-100 rounded-t-2xl p-6 pb-8 animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
              <DollarSign size={16} className="text-green-400" />
            </div>
            <h3 className="text-white font-semibold">
              Tip {creatorName}
            </h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* Amount buttons */}
        <div className="grid grid-cols-4 gap-3 mb-4">
          {TIP_AMOUNTS.map(({ cents, label }) => (
            <button
              key={cents}
              onClick={() => setSelected(cents)}
              className={`py-3 rounded-xl font-bold text-lg transition-all ${
                selected === cents
                  ? 'bg-green-500 text-white scale-105 shadow-lg shadow-green-500/30'
                  : 'bg-dark-50 text-gray-300 hover:bg-dark-50/80'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <p className="text-red-400 text-sm text-center mb-3">{error}</p>
        )}

        {/* Send button */}
        <button
          onClick={handleSendTip}
          disabled={!selected || loading}
          className="w-full py-3 bg-green-500 text-white font-bold rounded-xl text-sm hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Redirecting...
            </>
          ) : (
            `Send Tip${selected ? ` (${TIP_AMOUNTS.find(a => a.cents === selected)?.label})` : ''}`
          )}
        </button>

        {/* Footer */}
        <p className="text-xs text-gray-500 text-center mt-3">
          Powered by Stripe. Apple Pay & Google Pay accepted.
        </p>
      </div>
    </div>
  );
}
