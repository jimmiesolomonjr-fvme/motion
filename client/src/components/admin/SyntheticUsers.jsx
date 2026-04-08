import { useState, useEffect, useRef } from 'react';
import api from '../../services/api';
import { Bot, Power, PowerOff, Trash2, Play, ChevronDown, ChevronUp, Activity, MessageCircle, Heart, MapPin, BarChart3, Upload, X, Camera } from 'lucide-react';
import ImageCropper from '../ui/ImageCropper';

export default function SyntheticUsers() {
  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [expandedDetail, setExpandedDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [purging, setPurging] = useState(false);
  const [showPurgeConfirm, setShowPurgeConfirm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importJson, setImportJson] = useState('');
  const [importError, setImportError] = useState('');
  const [importing, setImporting] = useState(false);
  const [cropSrc, setCropSrc] = useState(null);
  const [cropIndex, setCropIndex] = useState(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const photoInputRef = useRef(null);

  const fetchData = async () => {
    try {
      const [overviewRes, usersRes, analyticsRes] = await Promise.all([
        api.get('/admin/synthetic/overview'),
        api.get('/admin/synthetic/users'),
        api.get('/admin/synthetic/analytics'),
      ]);
      setOverview(overviewRes.data);
      setUsers(usersRes.data);
      setAnalytics(analyticsRes.data);
    } catch (err) {
      console.error('Failed to load synthetic data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const toggleUser = async (id, currentActive) => {
    try {
      await api.put(`/admin/synthetic/users/${id}/toggle`);
      setUsers(users.map((u) => u.id === id ? { ...u, isActive: !currentActive } : u));
    } catch (err) {
      console.error('Toggle error:', err);
    }
  };

  const activateUser = async (id) => {
    try {
      await api.post(`/admin/synthetic/users/${id}/activate`);
      setUsers(users.map((u) => u.id === id ? { ...u, isActive: true } : u));
    } catch (err) {
      console.error('Activate error:', err);
    }
  };

  const expandUser = async (id) => {
    if (expandedId === id) {
      setExpandedId(null);
      setExpandedDetail(null);
      return;
    }
    try {
      const { data } = await api.get(`/admin/synthetic/users/${id}`);
      setExpandedDetail(data);
      setExpandedId(id);
    } catch (err) {
      console.error('Detail error:', err);
    }
  };

  const handlePurge = async () => {
    setPurging(true);
    try {
      const { data } = await api.delete('/admin/synthetic/purge');
      alert(`Purged ${data.purged} synthetic users`);
      setShowPurgeConfirm(false);
      fetchData();
    } catch (err) {
      console.error('Purge error:', err);
    } finally {
      setPurging(false);
    }
  };

  const handleImport = async () => {
    setImportError('');
    setImporting(true);
    try {
      const persona = JSON.parse(importJson);
      await api.post('/admin/synthetic/import', { persona });
      setShowImport(false);
      setImportJson('');
      fetchData();
    } catch (err) {
      setImportError(err.response?.data?.error || err.message || 'Invalid JSON');
    } finally {
      setImporting(false);
    }
  };

  const handlePhotoSlotClick = (index) => {
    setCropIndex(index);
    photoInputRef.current?.click();
  };

  const handlePhotoFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCropSrc(reader.result);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleCropComplete = async (blob) => {
    if (cropIndex === null || !expandedDetail) return;
    setPhotoUploading(true);
    try {
      const form = new FormData();
      form.append('photo', blob, 'photo.webp');
      const { data } = await api.post(
        `/admin/synthetic/users/${expandedId}/photos?index=${cropIndex}`,
        form,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      setExpandedDetail((d) => ({ ...d, photos: data.photos, photo: data.photos[0] || null }));
      setUsers((prev) => prev.map((u) => u.id === expandedId ? { ...u, photo: data.photos[0] || null } : u));
    } catch (err) {
      console.error('Photo upload error:', err);
    } finally {
      setPhotoUploading(false);
      setCropSrc(null);
      setCropIndex(null);
    }
  };

  const handlePhotoDelete = async (index) => {
    if (!expandedDetail) return;
    try {
      const { data } = await api.delete(`/admin/synthetic/users/${expandedId}/photos/${index}`);
      setExpandedDetail((d) => ({ ...d, photos: data.photos, photo: data.photos[0] || null }));
      setUsers((prev) => prev.map((u) => u.id === expandedId ? { ...u, photo: data.photos[0] || null } : u));
    } catch (err) {
      console.error('Photo delete error:', err);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bot size={18} className="text-cyan-400" />
          <h2 className="text-lg font-bold text-white">Synthetic Users</h2>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/20 text-cyan-400 text-xs font-semibold rounded-lg hover:bg-cyan-500/30 transition-colors"
          >
            <Upload size={12} /> Import
          </button>
          <button
            onClick={() => setShowPurgeConfirm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 text-red-400 text-xs font-semibold rounded-lg hover:bg-red-500/30 transition-colors"
          >
            <Trash2 size={12} /> Purge All
          </button>
        </div>
      </div>

      {/* Overview Cards */}
      {overview && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total', value: overview.total, icon: Bot, color: 'cyan' },
            { label: 'Active Today', value: overview.activeToday, icon: Activity, color: 'green' },
            { label: 'Actions Today', value: overview.actionsToday, icon: Play, color: 'purple' },
            { label: 'Messages', value: overview.messagesToday, icon: MessageCircle, color: 'blue' },
            { label: 'Likes', value: overview.likesToday, icon: Heart, color: 'pink' },
            { label: 'Moves', value: overview.movesToday, icon: MapPin, color: 'gold' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-dark-100 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-7 h-7 rounded-lg bg-${color === 'gold' ? 'gold' : color + '-500'}/20 flex items-center justify-center`}>
                  <Icon size={14} className={color === 'gold' ? 'text-gold' : `text-${color}-400`} />
                </div>
                <span className="text-xs text-gray-400">{label}</span>
              </div>
              <p className="text-lg font-bold text-white">{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Analytics */}
      {analytics && (
        <div className="bg-dark-100 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 size={14} className="text-cyan-400" />
            <span className="text-sm font-semibold text-white">Synthetic-to-Real Ratio (7 days)</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Messages', data: analytics.messages },
              { label: 'Likes', data: analytics.likes },
              { label: 'Vibe Answers', data: analytics.vibeAnswers },
            ].map(({ label, data }) => (
              <div key={label} className="text-center">
                <p className="text-xs text-gray-400 mb-1">{label}</p>
                <p className="text-sm font-bold text-white">{data.synthetic} / {data.real}</p>
                <p className="text-xs text-gray-500">ratio: {data.ratio}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* User List */}
      <div className="space-y-2">
        {users.map((u) => (
          <div key={u.id} className="bg-dark-100 rounded-xl overflow-hidden">
            <div className="p-3 flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer" onClick={() => expandUser(u.id)}>
                <div className="w-10 h-10 rounded-full bg-dark-50 flex items-center justify-center flex-shrink-0">
                  {u.photo ? (
                    <img src={u.photo} alt="" className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <Bot size={18} className="text-gray-500" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white truncate">{u.displayName}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                      u.role === 'STEPPER' ? 'bg-blue-500/20 text-blue-400' : 'bg-pink-500/20 text-pink-400'
                    }`}>{u.role}</span>
                    <span className={`w-2 h-2 rounded-full ${u.isActive ? 'bg-green-400' : 'bg-gray-600'}`} />
                  </div>
                  <p className="text-xs text-gray-500">{u.city} &middot; {u.actionCount} actions</p>
                </div>
                {expandedId === u.id ? <ChevronUp size={14} className="text-gray-500" /> : <ChevronDown size={14} className="text-gray-500" />}
              </div>
              <div className="flex items-center gap-1.5 ml-2">
                {!u.isActive && (
                  <button
                    onClick={() => activateUser(u.id)}
                    className="p-1.5 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors"
                    title="Activate + run cycle"
                  >
                    <Play size={12} />
                  </button>
                )}
                <button
                  onClick={() => toggleUser(u.id, u.isActive)}
                  className={`p-1.5 rounded-lg transition-colors ${
                    u.isActive ? 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30' : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                  }`}
                  title={u.isActive ? 'Deactivate' : 'Activate'}
                >
                  {u.isActive ? <PowerOff size={12} /> : <Power size={12} />}
                </button>
              </div>
            </div>

            {/* Expanded Detail */}
            {expandedId === u.id && expandedDetail && (
              <div className="px-3 pb-3 border-t border-dark-50">
                {/* Photos Grid */}
                <div className="mt-3">
                  <p className="text-xs font-semibold text-gray-400 mb-2">Photos</p>
                  <div className="grid grid-cols-4 gap-2">
                    {Array.from({ length: 4 }).map((_, i) => {
                      const photo = expandedDetail.photos?.[i];
                      return (
                        <div key={i} className="relative aspect-square rounded-lg overflow-hidden bg-dark-50">
                          {photo ? (
                            <>
                              <img
                                src={photo}
                                alt=""
                                className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity"
                                onClick={() => handlePhotoSlotClick(i)}
                              />
                              <button
                                onClick={() => handlePhotoDelete(i)}
                                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 flex items-center justify-center hover:bg-red-500/80 transition-colors"
                              >
                                <X size={10} className="text-white" />
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => handlePhotoSlotClick(i)}
                              className="w-full h-full flex flex-col items-center justify-center gap-1 hover:bg-dark-100 transition-colors"
                              disabled={i > (expandedDetail.photos?.length || 0)}
                            >
                              <Camera size={14} className="text-gray-600" />
                              <span className="text-[9px] text-gray-600">Add</span>
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handlePhotoFileChange}
                  />
                </div>

                {/* Memory Stream */}
                {expandedDetail.memoryStream?.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs font-semibold text-gray-400 mb-1">Recent Memory</p>
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {expandedDetail.memoryStream.slice(-5).reverse().map((m, i) => (
                        <div key={i} className="text-xs text-gray-500">
                          <span className="text-gray-600">{new Date(m.timestamp).toLocaleString()}</span> — {m.actions?.join(', ')}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent Actions */}
                {expandedDetail.actions?.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs font-semibold text-gray-400 mb-1">Recent Actions</p>
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {expandedDetail.actions.slice(0, 15).map((a) => (
                        <div key={a.id} className="flex items-center gap-2 text-xs">
                          <span className="text-cyan-400 font-mono">{a.actionType}</span>
                          {a.targetUserId && <span className="text-gray-600 truncate">target: {a.targetUserId.slice(0, 8)}...</span>}
                          <span className="text-gray-700 ml-auto flex-shrink-0">{new Date(a.createdAt).toLocaleTimeString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Emotional State */}
                {expandedDetail.emotionalState && (
                  <div className="mt-3">
                    <p className="text-xs font-semibold text-gray-400 mb-1">State</p>
                    <div className="flex gap-2 flex-wrap">
                      {Object.entries(expandedDetail.emotionalState).map(([k, v]) => (
                        <span key={k} className="text-xs bg-dark-50 text-gray-400 px-2 py-0.5 rounded-full">
                          {k}: {typeof v === 'number' ? v.toFixed(2) : String(v)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {users.length === 0 && (
          <div className="text-center py-8 text-gray-500 text-sm">
            No synthetic users found. Run <code className="bg-dark-50 px-1.5 py-0.5 rounded text-cyan-400">npm run seed:synthetic</code> to create them.
          </div>
        )}
      </div>

      {/* Purge Confirmation Modal */}
      {showPurgeConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-100 rounded-2xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-bold text-white mb-2">Purge All Synthetic Users?</h3>
            <p className="text-sm text-gray-400 mb-4">
              This will permanently delete all {users.length} synthetic users and their associated data (messages, likes, matches, moves, notifications, etc.). This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowPurgeConfirm(false)}
                className="flex-1 py-2 bg-dark-50 text-gray-300 rounded-lg text-sm font-semibold hover:bg-dark transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handlePurge}
                disabled={purging}
                className="flex-1 py-2 bg-red-500 text-white rounded-lg text-sm font-semibold hover:bg-red-600 disabled:opacity-50 transition-colors"
              >
                {purging ? 'Purging...' : 'Purge All'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImport && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-100 rounded-2xl p-6 max-w-lg w-full">
            <h3 className="text-lg font-bold text-white mb-2">Import Synthetic User</h3>
            <p className="text-xs text-gray-400 mb-3">Paste a persona JSON object. Must include email, role, displayName, bio, age, city, personaConfig, dailySchedule.</p>
            <textarea
              value={importJson}
              onChange={(e) => setImportJson(e.target.value)}
              placeholder='{ "email": "...", "role": "STEPPER", ... }'
              rows={10}
              className="w-full bg-dark-50 text-white text-xs font-mono rounded-lg px-3 py-2 border border-dark-50 focus:border-cyan-500/50 outline-none resize-none mb-2"
            />
            {importError && <p className="text-xs text-red-400 mb-2">{importError}</p>}
            <div className="flex gap-2">
              <button
                onClick={() => { setShowImport(false); setImportJson(''); setImportError(''); }}
                className="flex-1 py-2 bg-dark-50 text-gray-300 rounded-lg text-sm font-semibold hover:bg-dark transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={importing || !importJson.trim()}
                className="flex-1 py-2 bg-cyan-500 text-dark rounded-lg text-sm font-semibold hover:bg-cyan-400 disabled:opacity-50 transition-colors"
              >
                {importing ? 'Importing...' : 'Import'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Photo Cropper Modal */}
      {cropSrc && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-100 rounded-2xl p-4 max-w-md w-full">
            <h3 className="text-sm font-bold text-white mb-3">Crop Photo</h3>
            {photoUploading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <ImageCropper
                imageSrc={cropSrc}
                aspect={1}
                onCropComplete={handleCropComplete}
                onCancel={() => { setCropSrc(null); setCropIndex(null); }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
