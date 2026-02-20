import { useState } from 'react';
import api from '../../services/api';
import { Megaphone, Send, CheckCircle, AlertCircle } from 'lucide-react';

export default function Broadcast() {
  const [content, setContent] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [confirming, setConfirming] = useState(false);

  const roleLabel = targetRole === 'STEPPER' ? 'Steppers' : targetRole === 'BADDIE' ? 'Baddies' : 'Everyone';

  const handleSend = async () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }

    setLoading(true);
    setConfirming(false);
    setResult(null);
    try {
      const payload = { content };
      if (targetRole) payload.targetRole = targetRole;
      const { data } = await api.post('/admin/broadcast', payload);
      setResult({ success: true, message: `Message sent to ${data.sent} users` });
      setContent('');
    } catch (err) {
      setResult({ success: false, message: err.response?.data?.error || 'Failed to send broadcast' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Megaphone size={18} className="text-gold" />
        <h2 className="text-lg font-bold text-white">Broadcast Message</h2>
      </div>

      <div className="bg-dark-100 rounded-xl p-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Target Audience</label>
          <select
            value={targetRole}
            onChange={(e) => { setTargetRole(e.target.value); setConfirming(false); }}
            className="w-full bg-dark-50 text-white rounded-lg px-3 py-2 text-sm border border-dark-50 focus:border-gold focus:outline-none"
          >
            <option value="">Everyone</option>
            <option value="STEPPER">Steppers Only</option>
            <option value="BADDIE">Baddies Only</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Message</label>
          <textarea
            value={content}
            onChange={(e) => { setContent(e.target.value); setConfirming(false); }}
            placeholder="Type your broadcast message..."
            rows={4}
            className="w-full bg-dark-50 text-white rounded-lg px-3 py-2 text-sm border border-dark-50 focus:border-gold focus:outline-none resize-none"
          />
        </div>

        {confirming && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
            <p className="text-yellow-400 text-sm">
              Send this message to <strong>{roleLabel}</strong>? This cannot be undone.
            </p>
          </div>
        )}

        {result && (
          <div className={`flex items-center gap-2 rounded-lg p-3 ${
            result.success ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'
          }`}>
            {result.success ? <CheckCircle size={16} className="text-green-400" /> : <AlertCircle size={16} className="text-red-400" />}
            <p className={`text-sm ${result.success ? 'text-green-400' : 'text-red-400'}`}>{result.message}</p>
          </div>
        )}

        <button
          onClick={handleSend}
          disabled={!content.trim() || loading}
          className={`flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-sm font-semibold transition-colors ${
            confirming
              ? 'bg-yellow-500 text-dark hover:bg-yellow-400'
              : 'bg-gold text-dark hover:bg-gold/90'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-dark border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <Send size={14} />
              {confirming ? `Confirm Send to ${roleLabel}` : 'Send Broadcast'}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
