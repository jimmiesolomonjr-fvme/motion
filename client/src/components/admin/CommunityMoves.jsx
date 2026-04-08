import { useState, useEffect } from 'react';
import api from '../../services/api';
import { Sparkles, Play, Trash2, Clock, Users, MapPin, AlertTriangle } from 'lucide-react';
import { optimizeCloudinaryUrl } from '../../utils/cloudinaryUrl';

export default function CommunityMoves() {
  const [moves, setMoves] = useState([]);
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState(null);

  useEffect(() => {
    Promise.all([
      api.get('/admin/community-moves'),
      api.get('/admin/community-moves/pipeline-runs'),
    ]).then(([movesRes, runsRes]) => {
      setMoves(movesRes.data);
      setRuns(runsRes.data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleRunPipeline = async () => {
    setRunning(true);
    setRunResult(null);
    try {
      const { data } = await api.post('/admin/community-moves/run-pipeline');
      setRunResult(data);
      // Refresh data
      const [movesRes, runsRes] = await Promise.all([
        api.get('/admin/community-moves'),
        api.get('/admin/community-moves/pipeline-runs'),
      ]);
      setMoves(movesRes.data);
      setRuns(runsRes.data);
    } catch (err) {
      setRunResult({ status: 'FAILED', errors: [err.response?.data?.error || 'Failed'] });
    } finally {
      setRunning(false);
    }
  };

  const handleUnpublish = async (moveId) => {
    try {
      await api.delete(`/admin/community-moves/${moveId}`);
      setMoves((prev) => prev.map((m) => m.id === moveId ? { ...m, isActive: false, status: 'CANCELLED' } : m));
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to unpublish');
    }
  };

  if (loading) {
    return <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin" /></div>;
  }

  const activeMoves = moves.filter((m) => m.isActive);
  const inactiveMoves = moves.filter((m) => !m.isActive);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-purple-400" />
          <h2 className="text-lg font-bold text-white">Community Moves</h2>
        </div>
        <button
          onClick={handleRunPipeline}
          disabled={running}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-500 text-white text-sm font-semibold rounded-lg hover:bg-purple-600 disabled:opacity-50 transition-colors"
        >
          <Play size={14} />
          {running ? 'Running...' : 'Run Pipeline'}
        </button>
      </div>

      {/* Run result */}
      {runResult && (
        <div className={`p-3 rounded-xl text-sm ${
          runResult.status === 'SUCCESS' ? 'bg-green-500/10 border border-green-500/20 text-green-400'
            : runResult.status === 'SKIPPED' ? 'bg-gray-500/10 border border-gray-500/20 text-gray-400'
            : 'bg-red-500/10 border border-red-500/20 text-red-400'
        }`}>
          <p className="font-medium">{runResult.status}: {runResult.movesCreated || 0} moves created</p>
          {runResult.errors?.length > 0 && (
            <ul className="mt-1 text-xs">
              {runResult.errors.map((e, i) => <li key={i}>- {e}</li>)}
            </ul>
          )}
        </div>
      )}

      {/* Active moves */}
      <h3 className="text-sm font-bold text-white uppercase tracking-wide">Active ({activeMoves.length})</h3>
      {activeMoves.length === 0 ? (
        <p className="text-sm text-gray-500">No active community moves</p>
      ) : (
        activeMoves.map((move) => (
          <div key={move.id} className="bg-dark-100 rounded-xl p-4">
            <div className="flex items-start gap-3">
              {move.photo && (
                <img src={optimizeCloudinaryUrl(move.photo, { width: 120 })} alt="" className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-white text-sm truncate">{move.title}</h4>
                <div className="flex flex-wrap gap-2 text-xs text-gray-400 mt-1">
                  <span className="flex items-center gap-0.5"><Users size={12} /> {move.poolCount} in pool</span>
                  <span className="flex items-center gap-0.5"><Sparkles size={12} /> {move.pairingCount} pairings</span>
                  <span className="flex items-center gap-0.5"><MapPin size={12} /> {move.location}</span>
                </div>
                {move.vibeTagsCommunity?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {move.vibeTagsCommunity.map((tag) => (
                      <span key={tag} className="px-1.5 py-0.5 bg-purple-500/20 text-purple-400 text-[10px] rounded-full">{tag}</span>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={() => handleUnpublish(move.id)}
                className="p-1.5 text-gray-500 hover:text-red-400 transition-colors"
                title="Unpublish"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))
      )}

      {/* Inactive moves */}
      {inactiveMoves.length > 0 && (
        <>
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mt-6">Inactive ({inactiveMoves.length})</h3>
          {inactiveMoves.map((move) => (
            <div key={move.id} className="bg-dark-100/50 rounded-xl p-3 opacity-60">
              <p className="text-sm text-gray-400 truncate">{move.title}</p>
              <p className="text-xs text-gray-600">{move.poolCount} pool | {move.communityMatchCount} matches | {move.status}</p>
            </div>
          ))}
        </>
      )}

      {/* Pipeline runs */}
      <h3 className="text-sm font-bold text-white uppercase tracking-wide mt-6 flex items-center gap-1.5">
        <Clock size={14} /> Pipeline Runs
      </h3>
      {runs.length === 0 ? (
        <p className="text-sm text-gray-500">No pipeline runs yet</p>
      ) : (
        runs.map((run) => (
          <div key={run.id} className="bg-dark-100 rounded-xl p-3 flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
              run.status === 'SUCCESS' ? 'bg-green-500' : run.status === 'PARTIAL' ? 'bg-amber-500' : 'bg-red-500'
            }`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-sm">
                <span className={run.status === 'SUCCESS' ? 'text-green-400' : run.status === 'PARTIAL' ? 'text-amber-400' : 'text-red-400'}>
                  {run.status}
                </span>
                <span className="text-gray-500">{run.movesCreated} moves, {run.venuesFetched} venues</span>
              </div>
              <p className="text-xs text-gray-600">{new Date(run.createdAt).toLocaleString()} ({run.duration}ms)</p>
              {run.errors?.length > 0 && (
                <p className="text-xs text-red-400/70 mt-0.5 truncate">{run.errors[0]}</p>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
