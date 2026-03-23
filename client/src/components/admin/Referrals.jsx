import { useState, useEffect } from 'react';
import Avatar from '../ui/Avatar';
import api from '../../services/api';
import { Trophy, ChevronDown, ChevronUp, Edit3, Check, X, Copy } from 'lucide-react';

export default function Referrals() {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});
  const [editing, setEditing] = useState(null); // userId being edited
  const [editValue, setEditValue] = useState('');
  const [editError, setEditError] = useState('');
  const [copied, setCopied] = useState(null);

  const fetchLeaderboard = async () => {
    try {
      const { data } = await api.get('/admin/referrals');
      setLeaderboard(data);
    } catch (err) {
      console.error('Failed to fetch referral leaderboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLeaderboard(); }, []);

  const toggleExpand = (code) => {
    setExpanded((prev) => ({ ...prev, [code]: !prev[code] }));
  };

  const startEdit = (userId, currentCode) => {
    setEditing(userId);
    setEditValue(currentCode);
    setEditError('');
  };

  const cancelEdit = () => {
    setEditing(null);
    setEditValue('');
    setEditError('');
  };

  const saveCode = async (userId) => {
    try {
      setEditError('');
      await api.put(`/admin/users/${userId}/referral-code`, { code: editValue });
      setEditing(null);
      setEditValue('');
      fetchLeaderboard();
    } catch (err) {
      setEditError(err.response?.data?.error || 'Failed to update code');
    }
  };

  const copyCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 1500);
  };

  const getRankStyle = (idx) => {
    if (idx === 0) return 'text-gold';
    if (idx === 1) return 'text-gray-300';
    if (idx === 2) return 'text-amber-600';
    return 'text-gray-500';
  };

  const totalReferrals = leaderboard.reduce((sum, r) => sum + r.count, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-dark-100 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-gold">{leaderboard.length}</p>
          <p className="text-xs text-gray-400 mt-1">Referrers</p>
        </div>
        <div className="bg-dark-100 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-white">{totalReferrals}</p>
          <p className="text-xs text-gray-400 mt-1">Total Signups</p>
        </div>
      </div>

      {leaderboard.length === 0 ? (
        <div className="text-center py-12">
          <Trophy size={40} className="text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">No referrals yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {leaderboard.map((entry, idx) => (
            <div key={entry.user.referralCode} className="bg-dark-100 rounded-xl overflow-hidden">
              {/* Main row */}
              <div className="flex items-center gap-3 p-3">
                <span className={`text-lg font-bold w-8 text-center ${getRankStyle(idx)}`}>
                  {idx < 3 ? <Trophy size={18} className="inline" /> : idx + 1}
                </span>
                <Avatar src={entry.user.photos} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">
                    {entry.user.displayName || entry.user.email || 'Unknown'}
                  </p>
                  {entry.user.email && (
                    <p className="text-xs text-gray-500 truncate">{entry.user.email}</p>
                  )}
                  {/* Referral code */}
                  <div className="flex items-center gap-1.5 mt-1">
                    {editing === entry.user.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value.toUpperCase())}
                          className="bg-dark-50 text-gold text-xs font-mono px-2 py-1 rounded-lg border border-gold/30 w-32 outline-none focus:border-gold"
                          maxLength={20}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveCode(entry.user.id);
                            if (e.key === 'Escape') cancelEdit();
                          }}
                        />
                        <button onClick={() => saveCode(entry.user.id)} className="p-1 text-green-400 hover:text-green-300">
                          <Check size={14} />
                        </button>
                        <button onClick={cancelEdit} className="p-1 text-red-400 hover:text-red-300">
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="text-xs font-mono text-gold bg-gold/10 px-2 py-0.5 rounded">
                          {entry.user.referralCode}
                        </span>
                        <button
                          onClick={() => copyCode(entry.user.referralCode)}
                          className="p-0.5 text-gray-500 hover:text-white transition-colors"
                          title="Copy code"
                        >
                          {copied === entry.user.referralCode ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                        </button>
                        {entry.user.id && (
                          <button
                            onClick={() => startEdit(entry.user.id, entry.user.referralCode)}
                            className="p-0.5 text-gray-500 hover:text-gold transition-colors"
                            title="Edit code"
                          >
                            <Edit3 size={12} />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                  {editError && editing === entry.user.id && (
                    <p className="text-xs text-red-400 mt-1">{editError}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-white">{entry.count}</span>
                  <button
                    onClick={() => toggleExpand(entry.user.referralCode)}
                    className="p-1.5 rounded-lg bg-dark-50 text-gray-400 hover:text-white transition-colors"
                  >
                    {expanded[entry.user.referralCode] ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                </div>
              </div>

              {/* Expanded referrals list */}
              {expanded[entry.user.referralCode] && (
                <div className="border-t border-dark-50 px-3 py-2 space-y-1.5">
                  <p className="text-xs text-gray-500 font-medium mb-2">Referred users</p>
                  {entry.referrals.map((ref) => (
                    <div key={ref.id} className="flex items-center justify-between py-1.5 px-2 bg-dark-50/50 rounded-lg">
                      <div className="min-w-0">
                        <p className="text-sm text-white truncate">{ref.displayName || ref.email}</p>
                        <p className="text-xs text-gray-500 truncate">{ref.email}</p>
                      </div>
                      <span className="text-xs text-gray-500 whitespace-nowrap ml-2">
                        {new Date(ref.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
