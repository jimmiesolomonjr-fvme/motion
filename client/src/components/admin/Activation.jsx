import { useState, useEffect } from 'react';
import api from '../../services/api';
import { Zap, RefreshCw, ArrowUpCircle } from 'lucide-react';

const STATUS_COLORS = {
  PENDING: 'bg-yellow-500/20 text-yellow-400',
  NUDGED: 'bg-blue-500/20 text-blue-400',
  MESSAGED: 'bg-green-500/20 text-green-400',
  REPLIED: 'bg-emerald-500/20 text-emerald-400',
  EXPIRED: 'bg-gray-500/20 text-gray-400',
};

export default function Activation() {
  const [data, setData] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      api.get('/admin/activation'),
      api.get('/admin/activation/metrics'),
    ]).then(([{ data: d }, { data: m }]) => {
      setData(d);
      setMetrics(m);
    }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const handleNudge = async (userId) => {
    try {
      await api.post(`/admin/activation/${userId}/nudge`);
      fetchData();
    } catch {}
  };

  const handleBoost = async (userId) => {
    try {
      await api.post(`/admin/activation/${userId}/boost`);
      fetchData();
    } catch {}
  };

  const timeAgo = (date) => {
    if (!date) return '-';
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  if (loading && !data) {
    return <p className="text-gray-500 text-center py-8">Loading...</p>;
  }

  return (
    <div className="space-y-6">
      {/* Metrics Row */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-dark-100 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-green-400">{metrics.messaged}%</p>
            <p className="text-xs text-gray-500">Received 1st Msg</p>
          </div>
          <div className="bg-dark-100 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-blue-400">{metrics.medianTimeMin}m</p>
            <p className="text-xs text-gray-500">Median Time</p>
          </div>
          <div className="bg-dark-100 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-emerald-400">{metrics.replied}%</p>
            <p className="text-xs text-gray-500">Replied</p>
          </div>
          <div className="bg-dark-100 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-gold">{metrics.nudgeConversion}%</p>
            <p className="text-xs text-gray-500">Nudge Conversion</p>
          </div>
        </div>
      )}

      {/* Stats Row */}
      {data?.stats && (
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {[
            { label: 'New 24h', value: data.stats.newUsers24h, color: 'text-white' },
            { label: 'Onboarded', value: data.stats.onboardingComplete, color: 'text-blue-400' },
            { label: 'Waiting', value: data.stats.waiting, color: 'text-yellow-400' },
            { label: 'Messaged', value: data.stats.messaged, color: 'text-green-400' },
            { label: 'Replied', value: data.stats.replied, color: 'text-emerald-400' },
            { label: 'Expired', value: data.stats.expired, color: 'text-gray-400' },
          ].map((s) => (
            <div key={s.label} className="bg-dark-100 rounded-xl p-3 text-center">
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Activations Table */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-400">Recent Activations</h3>
          <button onClick={fetchData} className="text-xs text-gold flex items-center gap-1">
            <RefreshCw size={12} /> Refresh
          </button>
        </div>

        {data?.activations?.length === 0 && (
          <p className="text-gray-500 text-sm text-center py-6">No activations yet</p>
        )}

        {data?.activations?.map((a) => (
          <div key={a.id} className="bg-dark-100 rounded-xl p-3 flex items-center gap-3">
            {a.photo ? (
              <img src={a.photo} alt="" className="w-10 h-10 rounded-full object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-dark-50 flex items-center justify-center text-lg">
                &#x1f464;
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-white truncate">{a.displayName}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[a.activationStatus] || 'bg-dark-50 text-gray-400'}`}>
                  {a.activationStatus}
                </span>
              </div>
              <p className="text-xs text-gray-500">
                {a.role} · {a.city || 'No city'} · Nudges: {a.nudgeCount} · {timeAgo(a.createdAt)}
              </p>
            </div>
            <div className="flex gap-1.5">
              <button
                onClick={() => handleNudge(a.userId)}
                className="p-2 bg-blue-500/10 rounded-lg hover:bg-blue-500/20 transition-colors"
                title="Nudge responders"
              >
                <Zap size={14} className="text-blue-400" />
              </button>
              <button
                onClick={() => handleBoost(a.userId)}
                className="p-2 bg-green-500/10 rounded-lg hover:bg-green-500/20 transition-colors"
                title="Reset & boost"
              >
                <ArrowUpCircle size={14} className="text-green-400" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
