import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import Button from '../components/ui/Button';
import Input, { Textarea } from '../components/ui/Input';
import LocationAutocomplete from '../components/ui/LocationAutocomplete';
import Modal from '../components/ui/Modal';
import VibeScore from '../components/vibe-check/VibeScore';
import { BadgeCheck, MapPin, Heart, Flag, Ban, Edit3, Camera, Crown, Sparkles, X, MessageCircle, ChevronDown, Plus, Trash2, Check, Zap, Flame, Calendar } from 'lucide-react';
import { isOnline } from '../utils/formatters';
import { REPORT_REASONS } from '../utils/constants';
import { detectFace } from '../utils/faceDetection';
import CreateStory from '../components/stories/CreateStory';

export default function Profile() {
  const { userId } = useParams();
  const { user: currentUser, refreshUser } = useAuth();
  const navigate = useNavigate();
  const isOwnProfile = !userId || userId === currentUser?.id;

  const [profile, setProfile] = useState(null);
  const [vibeScore, setVibeScore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [reportModal, setReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDetails, setReportDetails] = useState('');
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [liked, setLiked] = useState(false);
  const [freeMessaging, setFreeMessaging] = useState(true);

  // Prompt editing state
  const [availablePrompts, setAvailablePrompts] = useState([]);
  const [editPrompts, setEditPrompts] = useState([]);
  const [nudgeDismissed, setNudgeDismissed] = useState(() => sessionStorage.getItem('profileNudgeDismissed') === 'true');
  const [showCreateStory, setShowCreateStory] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [moveHistory, setMoveHistory] = useState(null);
  const [openDropdown, setOpenDropdown] = useState(null); // index of open prompt dropdown
  const dropdownRefs = useRef([]);

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      try {
        const endpoint = isOwnProfile ? '/users/profile' : `/users/profile/${userId}`;
        const { data } = await api.get(endpoint);
        setProfile(data);
        setEditForm({ displayName: data.displayName, bio: data.bio || '', city: data.city, lookingFor: data.lookingFor || '' });
        setEditPrompts((data.profilePrompts || []).map((p) => ({ prompt: p.prompt, answer: p.answer })));

        if (!isOwnProfile) {
          const [scoreRes, likeRes, payRes] = await Promise.all([
            api.get(`/vibe/score/${userId}`),
            api.get(`/likes/check/${userId}`),
            api.get('/payments/status').catch(() => ({ data: {} })),
          ]);
          setVibeScore(scoreRes.data.score);
          setLiked(likeRes.data.hasLiked);
          if (payRes.data.freeMessaging !== undefined) setFreeMessaging(payRes.data.freeMessaging);

          // Fetch move history for Steppers
          if (data.role === 'STEPPER') {
            api.get(`/moves/history/${userId}`).then(({ data: hist }) => setMoveHistory(hist)).catch(() => {});
          }

          // Track profile view (fire and forget)
          api.post(`/users/profile/${userId}/view`).catch(() => {});
        }
      } catch {
        navigate('/feed');
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [userId]);

  // Close prompt dropdown on outside click
  useEffect(() => {
    if (openDropdown === null) return;
    const handleClick = (e) => {
      if (dropdownRefs.current[openDropdown] && !dropdownRefs.current[openDropdown].contains(e.target)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [openDropdown]);

  // Fetch available prompts when entering edit mode
  useEffect(() => {
    if (editing && availablePrompts.length === 0) {
      api.get('/users/prompts').then(({ data }) => {
        setAvailablePrompts(data.prompts);
      }).catch(() => {});
    }
  }, [editing]);

  const handleSave = async () => {
    try {
      await api.post('/users/profile', { ...editForm, age: profile.age });

      // Save prompts
      const validPrompts = editPrompts.filter((p) => p.prompt && p.answer?.trim());
      await api.put('/users/prompts', { prompts: validPrompts });

      setProfile({ ...profile, ...editForm, profilePrompts: validPrompts });
      setEditing(false);
      refreshUser();
    } catch (err) {
      console.error('Save error:', err);
    }
  };

  const handleReport = async () => {
    if (!reportReason) return;
    try {
      await api.post('/reports', { reportedId: userId, reason: reportReason, details: reportDetails });
      setReportModal(false);
      setReportReason('');
      setReportDetails('');
    } catch (err) {
      console.error('Report error:', err);
    }
  };

  const handleBlock = async () => {
    try {
      await api.post('/reports/block', { blockedId: userId });
      navigate('/feed');
    } catch (err) {
      console.error('Block error:', err);
    }
  };

  const handleLike = async () => {
    try {
      const { data } = await api.post(`/likes/${userId}`);
      setLiked(true);
    } catch (err) {
      console.error('Like error:', err);
    }
  };

  const handlePhotoDelete = async (index) => {
    try {
      const { data } = await api.delete(`/users/photos/${index}`);
      setProfile({ ...profile, photos: data.photos });
      setSelectedPhotoIndex(0);
    } catch (err) {
      console.error('Delete photo error:', err);
    }
  };

  const handlePhotoUpload = async (e) => {
    const files = e.target.files;
    if (!files.length) return;
    setPhotoError('');

    // First photo must contain a face
    if (photos.length === 0) {
      const hasFace = await detectFace(files[0]);
      if (!hasFace) {
        setPhotoError('Your first photo must clearly show your face');
        e.target.value = '';
        return;
      }
    }

    const formData = new FormData();
    Array.from(files).forEach((f) => formData.append('photos', f));
    try {
      const { data } = await api.post('/users/photos', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setProfile({ ...profile, photos: data.photos });
    } catch (err) {
      console.error('Upload error:', err);
    }
  };

  const addPromptSlot = () => {
    if (editPrompts.length < 2) {
      setEditPrompts([...editPrompts, { prompt: '', answer: '' }]);
    }
  };

  const removePromptSlot = (index) => {
    setEditPrompts(editPrompts.filter((_, i) => i !== index));
  };

  const updatePromptSlot = (index, field, value) => {
    setEditPrompts(editPrompts.map((p, i) => i === index ? { ...p, [field]: value } : p));
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

  if (!profile) return null;

  const photos = profile.photos || [];
  const prompts = profile.profilePrompts || [];
  const showNudge = isOwnProfile && !editing && !nudgeDismissed && (photos.length < 2 || prompts.length === 0);

  const getLastOnlineLabel = () => {
    if (isOwnProfile || !profile.lastOnline) return null;
    const diff = Date.now() - new Date(profile.lastOnline).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 5) return 'Online now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 48) return `${hrs}h ago`;
    return null; // beyond 48h, don't show
  };

  const lastOnlineLabel = getLastOnlineLabel();

  return (
    <AppLayout>
      {/* Completion Nudge - top of page */}
      {showNudge && (
        <div className="bg-gold/10 border border-gold/20 rounded-xl p-4 relative mb-4">
          <button
            onClick={() => { setNudgeDismissed(true); sessionStorage.setItem('profileNudgeDismissed', 'true'); }}
            className="absolute top-2 right-2 text-gray-500 hover:text-white"
          >
            <X size={14} />
          </button>
          <h3 className="text-sm font-bold text-gold mb-2">Complete Your Profile</h3>
          <ul className="text-xs text-gray-400 space-y-1">
            {photos.length < 2 && <li>Add at least 2 photos to stand out</li>}
            {prompts.length === 0 && <li>Answer profile prompts to show your personality</li>}
          </ul>
          <button
            onClick={() => setEditing(true)}
            className="mt-3 text-xs text-gold font-semibold hover:underline"
          >
            Edit Profile
          </button>
        </div>
      )}

      {/* Photo Gallery */}
      {editing ? (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-300 mb-2">Photos ({photos.length}/6)</label>
          <div className={`grid grid-cols-3 gap-2${photos.length < 2 ? ' ring-2 ring-gold/50 rounded-xl p-1' : ''}`}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="relative aspect-square rounded-xl overflow-hidden">
                {photos[i] ? (
                  <>
                    <img src={photos[i]} alt="" className="w-full h-full object-cover" />
                    <button
                      onClick={() => handlePhotoDelete(i)}
                      className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/70 hover:bg-red-500 rounded-full flex items-center justify-center transition-colors"
                    >
                      <X className="text-white" size={12} />
                    </button>
                  </>
                ) : (
                  <label className="w-full h-full bg-dark-100 border-2 border-dashed border-dark-50 hover:border-gold/40 flex flex-col items-center justify-center cursor-pointer transition-colors">
                    <Plus className="text-gray-500" size={24} />
                    <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                  </label>
                )}
              </div>
            ))}
          </div>
          {photos.length < 2 && (
            <p className="text-xs text-gold/70 mt-1.5">Add at least 2 photos to stand out</p>
          )}
          {photoError && <p className="text-red-400 text-sm mt-2">{photoError}</p>}
        </div>
      ) : (
        <>
          <div className="relative rounded-2xl overflow-hidden mb-4">
            {photos.length > 0 ? (
              <img src={photos[selectedPhotoIndex] || photos[0]} alt="" className="w-full aspect-[3/4] object-cover" />
            ) : (
              <div className="w-full aspect-[3/4] bg-dark-50 flex items-center justify-center">
                <span className="text-6xl">👤</span>
              </div>
            )}

            {lastOnlineLabel && (
              <div className={`absolute top-3 left-3 px-2.5 py-1 rounded-full text-xs font-semibold ${
                lastOnlineLabel === 'Online now' ? 'bg-green-500/90 text-white' : 'bg-black/70 text-gray-200'
              }`}>
                {lastOnlineLabel}
              </div>
            )}

            {isOwnProfile && (
              <label className="absolute bottom-3 right-3 w-10 h-10 bg-gold rounded-full flex items-center justify-center cursor-pointer">
                <Camera className="text-dark" size={18} />
                <input type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} />
              </label>
            )}
          </div>

          {/* Photo thumbnails */}
          {photos.length > 1 && (
            <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
              {photos.map((p, i) => (
                <img
                  key={i}
                  src={p}
                  alt=""
                  onClick={() => setSelectedPhotoIndex(i)}
                  className={`w-16 h-16 rounded-lg object-cover flex-shrink-0 cursor-pointer transition-opacity ${
                    i === selectedPhotoIndex ? 'ring-2 ring-gold' : 'opacity-60 hover:opacity-100'
                  }`}
                />
              ))}
            </div>
          )}
          {photoError && <p className="text-red-400 text-sm mb-4">{photoError}</p>}
        </>
      )}

      {/* Profile Info */}
      <div className="space-y-4">
        {editing ? (
          <div className="space-y-3">
            <Input label="Display Name" value={editForm.displayName} onChange={(e) => setEditForm({ ...editForm, displayName: e.target.value })} />
            <Textarea label="Bio" value={editForm.bio} onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })} />
            <LocationAutocomplete label="City" name="city" value={editForm.city} onChange={(e) => setEditForm({ ...editForm, city: e.target.value })} />
            <Input label="Looking For" value={editForm.lookingFor} onChange={(e) => setEditForm({ ...editForm, lookingFor: e.target.value })} />

            {/* Profile Prompts Edit */}
            <div className={editPrompts.length === 0 ? 'ring-2 ring-gold/50 rounded-xl p-1' : ''}>
              <label className="block text-sm font-medium text-gray-300 mb-2">Profile Prompts (max 2)</label>
              {editPrompts.length === 0 && (
                <p className="text-xs text-gold/70 mb-2">Add prompts to show your personality</p>
              )}
              <div className="space-y-3">
                {editPrompts.map((ep, i) => (
                  <div key={i} className="bg-dark-100 rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 relative" ref={(el) => (dropdownRefs.current[i] = el)}>
                        <button
                          type="button"
                          onClick={() => setOpenDropdown(openDropdown === i ? null : i)}
                          className="w-full bg-dark-50 text-sm rounded-lg px-3 py-2 border border-dark-50 hover:border-gold/30 outline-none flex items-center justify-between transition-colors"
                        >
                          <span className={ep.prompt ? 'text-white' : 'text-gray-500'}>
                            {ep.prompt || 'Select a prompt...'}
                          </span>
                          <ChevronDown size={14} className={`text-gray-500 transition-transform ${openDropdown === i ? 'rotate-180' : ''}`} />
                        </button>
                        {openDropdown === i && (
                          <div className="absolute left-0 right-0 top-full mt-1 bg-dark-100 border border-dark-50 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto">
                            {availablePrompts.map((p) => {
                              const isUsed = editPrompts.some((ep2, j) => j !== i && ep2.prompt === p);
                              const isSelected = ep.prompt === p;
                              return (
                                <button
                                  key={p}
                                  type="button"
                                  disabled={isUsed}
                                  onClick={() => {
                                    if (!isUsed) {
                                      updatePromptSlot(i, 'prompt', p);
                                      setOpenDropdown(null);
                                    }
                                  }}
                                  className={`w-full text-left px-4 py-3 text-sm transition-colors flex items-center justify-between ${
                                    isUsed
                                      ? 'opacity-40 cursor-not-allowed text-gray-500'
                                      : isSelected
                                        ? 'text-gold bg-dark-50'
                                        : 'text-gray-300 hover:text-white hover:bg-dark-50 cursor-pointer'
                                  }`}
                                >
                                  <span>{p}</span>
                                  {isSelected && <Check size={14} className="text-gold" />}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      <button onClick={() => removePromptSlot(i)} className="ml-2 text-gray-500 hover:text-red-400">
                        <Trash2 size={16} />
                      </button>
                    </div>
                    {ep.prompt && (
                      <input
                        type="text"
                        value={ep.answer}
                        onChange={(e) => updatePromptSlot(i, 'answer', e.target.value)}
                        placeholder="Your answer..."
                        className="w-full bg-dark-50 text-white text-sm rounded-lg px-3 py-2 border border-dark-50 focus:border-gold/50 outline-none"
                        maxLength={150}
                      />
                    )}
                  </div>
                ))}
                {editPrompts.length < 2 && (
                  <button
                    onClick={addPromptSlot}
                    className="w-full py-2 border border-dashed border-dark-50 rounded-xl text-sm text-gray-500 hover:text-gold hover:border-gold/30 flex items-center justify-center gap-1 transition-colors"
                  >
                    <Plus size={14} /> Add Prompt
                  </button>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setEditing(false)}>Cancel</Button>
              <Button variant="gold" className="flex-1" onClick={handleSave}>Save</Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-white">{profile.displayName}, {profile.age}</h1>
                  {profile.isVerified && <BadgeCheck className="text-blue-400" size={20} />}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className={profile.role === 'STEPPER' ? 'badge-stepper' : 'badge-baddie'}>
                    {profile.role === 'STEPPER' ? <><Crown size={10} className="inline mr-1" />Stepper</> : <><Sparkles size={10} className="inline mr-1" />Baddie</>}
                  </span>
                  {profile.isPlug && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-xs font-semibold">
                      <Zap size={10} /> The Plug
                    </span>
                  )}
                  <span className="flex items-center gap-1 text-sm text-gray-400">
                    <MapPin size={14} /> {profile.city}
                  </span>
                </div>
              </div>
              {!isOwnProfile && vibeScore !== null && <VibeScore score={vibeScore} size="lg" />}
            </div>

            {profile.bio && <p className="text-gray-300 leading-relaxed">{profile.bio}</p>}
            {profile.lookingFor && (
              <div>
                <h3 className="text-sm font-semibold text-gray-400 mb-1">Looking for</h3>
                <p className="text-white">{profile.lookingFor}</p>
              </div>
            )}

            {/* Profile Prompts Display */}
            {prompts.length > 0 && (
              <div className="space-y-3">
                {prompts.map((p, i) => (
                  <div key={i} className="border-l-2 border-purple-accent/50 bg-purple-accent/5 rounded-r-xl p-3">
                    <p className="text-xs text-gray-500 italic mb-1">{p.prompt}</p>
                    <p className="text-white font-medium text-sm">{p.answer}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Move History (Stepper profiles, viewed by others) */}
            {!isOwnProfile && moveHistory && moveHistory.completedCount > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Flame size={16} className="text-gold" />
                  <h3 className="text-sm font-semibold text-gray-300">Moves ({moveHistory.completedCount} completed)</h3>
                </div>
                <div className="space-y-2">
                  {moveHistory.recentMoves.map((m, i) => (
                    <div key={i} className="flex items-center gap-3 p-2.5 bg-dark-100 rounded-xl">
                      <Calendar size={14} className="text-gold flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">{m.title}</p>
                        <p className="text-gray-500 text-xs">
                          {new Date(m.date).toLocaleDateString()} · {m.location}
                          {m.category && ` · ${m.category.charAt(0) + m.category.slice(1).toLowerCase()}`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            {isOwnProfile ? (
              <div className="space-y-2">
                <Button variant="outline" className="w-full" onClick={() => setEditing(true)}>
                  <Edit3 size={16} className="inline mr-2" /> Edit Profile
                </Button>
                <Button variant="ghost" className="w-full text-gold" onClick={() => setShowCreateStory(true)}>
                  <Camera size={16} className="inline mr-2" /> Add to Story
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {liked ? (
                  <Button variant="outline" className="w-full text-pink-400 border-pink-400/30" disabled>
                    <Heart size={16} className="inline mr-2" fill="currentColor" /> Liked
                  </Button>
                ) : (
                  <Button variant="gold" className="w-full" onClick={handleLike}>
                    <Heart size={16} className="inline mr-2" /> Like
                  </Button>
                )}
                {((currentUser?.role === 'BADDIE' && profile.role === 'STEPPER') ||
                  (currentUser?.role === 'STEPPER' && profile.role === 'BADDIE' && (freeMessaging || currentUser?.isPremium))) && (
                  <Button variant="outline" className="w-full" onClick={async () => {
                    try {
                      const { data } = await api.post(`/messages/start/${userId}`);
                      navigate(`/chat/${data.id}`);
                    } catch (err) {
                      console.error('Start conversation error:', err);
                    }
                  }}>
                    <MessageCircle size={16} className="inline mr-2" /> Message
                  </Button>
                )}
                <div className="flex gap-2">
                  <Button variant="ghost" className="flex-1 text-sm" onClick={() => setReportModal(true)}>
                    <Flag size={14} className="inline mr-1" /> Report
                  </Button>
                  <Button variant="ghost" className="flex-1 text-sm text-red-400" onClick={handleBlock}>
                    <Ban size={14} className="inline mr-1" /> Block
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Report Modal */}
      <Modal isOpen={reportModal} onClose={() => setReportModal(false)} title="Report User">
        <div className="space-y-3">
          <div className="space-y-2">
            {REPORT_REASONS.map((r) => (
              <button
                key={r.value}
                onClick={() => setReportReason(r.value)}
                className={`w-full text-left p-3 rounded-xl text-sm transition-colors ${
                  reportReason === r.value ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-dark-100 text-gray-400'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <Textarea placeholder="Additional details (optional)..." value={reportDetails} onChange={(e) => setReportDetails(e.target.value)} />
          <Button variant="danger" className="w-full" onClick={handleReport} disabled={!reportReason}>
            Submit Report
          </Button>
        </div>
      </Modal>

      {isOwnProfile && (
        <CreateStory
          isOpen={showCreateStory}
          onClose={() => setShowCreateStory(false)}
        />
      )}
    </AppLayout>
  );
}
