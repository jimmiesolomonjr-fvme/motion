import { useState, useEffect } from 'react';
import { DollarSign, X, Loader2, Clock, CheckCircle, XCircle } from 'lucide-react';
import api from '../../services/api';

const TIP_AMOUNTS = [
  { cents: 100, label: '$1' },
  { cents: 300, label: '$3' },
  { cents: 500, label: '$5' },
  { cents: 1000, label: '$10' },
];

export default function TipModal({ storyId, creatorId, creatorName, onClose }) {
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pendingTip, setPendingTip] = useState(null);
  const [checkingPending, setCheckingPending] = useState(!!creatorId);
  const [heldConfirmation, setHeldConfirmation] = useState(false);

  // Check for existing held tip on mount
  useEffect(() => {
    if (!creatorId) return;
    api.get(`/payments/tips/pending?creatorId=${creatorId}`)
      .then(({ data }) => {
        if (data.length > 0) setPendingTip(data[0]);
      })
      .catch(() => {})
      .finally(() => setCheckingPending(false));
  }, [creatorId]);

  const handleSendTip = async () => {
    if (!selected) return;
    setLoading(true);
    setError('');
    const w = window.open('', '_blank');
    try {
      const { data } = await api.post('/payments/tip', {
        storyId,
        amount: selected,
      });
      if (data.held) {
        w.close();
        setHeldConfirmation(true);
        setLoading(false);
      } else if (data.url) {
        w.location.href = data.url;
        setLoading(false);
      } else {
        w.close();
      }
    } catch (err) {
      w.close();
      setError(err.response?.data?.error || 'Failed to start tip');
      setLoading(false);
    }
  };

  const handleComplete = async () => {
    if (!pendingTip) return;
    setLoading(true);
    setError('');
    const w = window.open('', '_blank');
    try {
      const { data } = await api.post(`/payments/tip/${pendingTip.id}/complete`);
      if (data.url) {
        w.location.href = data.url;
        setLoading(false);
      } else {
        w.close();
      }
    } catch (err) {
      w.close();
      setError(err.response?.data?.error || 'Failed to complete tip');
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!pendingTip) return;
    setLoading(true);
    setError('');
    try {
      await api.delete(`/payments/tip/${pendingTip.id}`);
      setPendingTip(null);
      setLoading(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to cancel tip');
      setLoading(false);
    }
  };

  const pendingAmountLabel = pendingTip
    ? `$${(pendingTip.amount / 100).toFixed(0)}`
    : '';

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

        {checkingPending ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={24} className="animate-spin text-gray-400" />
          </div>
        ) : heldConfirmation ? (
          /* --- Just-sent held tip confirmation --- */
          <div className="text-center py-4">
            <div className="w-14 h-14 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-3">
              <CheckCircle size={28} className="text-green-400" />
            </div>
            <p className="text-white font-semibold text-lg mb-1">Tip Sent!</p>
            <p className="text-gray-400 text-sm mb-4">
              {creatorName} has been notified to set up tips. No money has been charged yet.
            </p>
            <p className="text-xs text-gray-500">
              You can cancel anytime by reopening this tip modal.
            </p>
          </div>
        ) : pendingTip ? (
          /* --- Has existing pending (held) tip --- */
          <div className="text-center py-2">
            <div className="w-14 h-14 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-3">
              <Clock size={28} className="text-amber-400" />
            </div>
            <p className="text-white font-semibold mb-1">
              Pending {pendingAmountLabel} Tip
            </p>
            <p className="text-gray-400 text-sm mb-5">
              {pendingTip.creatorOnboarded
                ? `${creatorName} is ready! Complete your tip now.`
                : `Waiting for ${creatorName} to set up tips. No money charged yet.`}
            </p>

            {error && (
              <p className="text-red-400 text-sm text-center mb-3">{error}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleCancel}
                disabled={loading}
                className="flex-1 py-3 bg-dark-50 text-gray-300 font-bold rounded-xl text-sm hover:bg-dark-50/80 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {loading && !pendingTip.creatorOnboarded ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <XCircle size={16} />
                )}
                Cancel Tip
              </button>
              {pendingTip.creatorOnboarded && (
                <button
                  onClick={handleComplete}
                  disabled={loading}
                  className="flex-1 py-3 bg-green-500 text-white font-bold rounded-xl text-sm hover:bg-green-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <CheckCircle size={16} />
                  )}
                  Complete Tip
                </button>
              )}
            </div>
          </div>
        ) : (
          /* --- Normal tip flow (no pending tip) --- */
          <>
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
          </>
        )}

        {/* Footer */}
        <p className="text-xs text-gray-500 text-center mt-3">
          Powered by Stripe. Apple Pay & Google Pay accepted.
        </p>
      </div>
    </div>
  );
}
