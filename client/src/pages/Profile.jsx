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
import { BadgeCheck, MapPin, Heart, Flag, Ban, Edit3, Camera, Crown, Sparkles, X, MessageCircle, Plus, Trash2, Check, Zap, Flame, Calendar, VolumeX, Volume2, Music, Play, Pause, Ruler, Briefcase } from 'lucide-react';
import { isOnline } from '../utils/formatters';
import { REPORT_REASONS, HEIGHT_FEET, HEIGHT_INCHES, WEIGHT_OPTIONS, OCCUPATION_OPTIONS, LOOKING_FOR_TAGS } from '../utils/constants';
import { detectFace } from '../utils/faceDetection';
import { isVideoUrl, getVideoDuration } from '../utils/mediaUtils';
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
  const [trimNotice, setTrimNotice] = useState('');
  const [moveHistory, setMoveHistory] = useState(null);
  const [promptModalOpen, setPromptModalOpen] = useState(false);
  const [modalPrompt, setModalPrompt] = useState({ prompt: '', answer: '' });
  const [videoMuted, setVideoMuted] = useState(true);
  const videoRef = useRef(null);
  const [songPlaying, setSongPlaying] = useState(false);
  const audioRef = useRef(null);
  const [songModalOpen, setSongModalOpen] = useState(false);
  const [songForm, setSongForm] = useState({ songTitle: '', songArtist: '', songPreviewUrl: '' });

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      try {
        const endpoint = isOwnProfile ? '/users/profile' : `/users/profile/${userId}`;
        const { data } = await api.get(endpoint);
        setProfile(data);
        setEditForm({ displayName: data.displayName, bio: data.bio || '', city: data.city, lookingFor: data.lookingFor || '', height: data.height || '', weight: data.weight || '', occupation: data.occupation || '', lookingForTags: data.lookingForTags || [] });
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
      await api.post('/users/profile', { ...editForm, age: profile.age, lookingForTags: editForm.lookingForTags || [] });

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
      await api.post(`/likes/${userId}`);
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
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setPhotoError('');
    setTrimNotice('');

    // Check video count (max 3)
    const existingVideoCount = photos.filter(isVideoUrl).length;
    const newVideoCount = files.filter(f => f.type.startsWith('video/')).length;
    if (existingVideoCount + newVideoCount > 3) {
      setPhotoError('Maximum 3 videos allowed');
      e.target.value = '';
      return;
    }

    // First photo must contain a face (only check images)
    if (photos.length === 0 && files.length > 0 && !files[0].type.startsWith('video/')) {
      const hasFace = await detectFace(files[0]);
      if (!hasFace) {
        setPhotoError('Your first photo must clearly show your face');
        e.target.value = '';
        return;
      }
    }

    // Check video durations — show trim notice for >15s
    for (const f of files) {
      if (f.type.startsWith('video/')) {
        const duration = await getVideoDuration(f);
        if (duration > 15) {
          setTrimNotice('Video will be trimmed to 15 seconds');
          break;
        }
      }
    }

    const formData = new FormData();
    files.forEach((f) => formData.append('photos', f));
    try {
      const { data } = await api.post('/users/photos', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setProfile({ ...profile, photos: data.photos });
      setTrimNotice('');
    } catch (err) {
      setPhotoError(err.response?.data?.error || 'Upload failed');
    }
  };

  const toggleSongPlay = () => {
    if (!audioRef.current) return;
    if (songPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setSongPlaying(!songPlaying);
  };

  const handleSongSave = async () => {
    try {
      await api.post('/users/profile', {
        displayName: profile.displayName,
        age: profile.age,
        city: profile.city,
        songTitle: songForm.songTitle,
        songArtist: songForm.songArtist,
        songPreviewUrl: songForm.songPreviewUrl,
      });
      setProfile({
        ...profile,
        songTitle: songForm.songTitle || null,
        songArtist: songForm.songArtist || null,
        songPreviewUrl: songForm.songPreviewUrl || null,
      });
      setSongModalOpen(false);
    } catch (err) {
      console.error('Song save error:', err);
    }
  };

  const handleSongDelete = async () => {
    try {
      await api.delete('/users/profile-song');
      setProfile({ ...profile, songTitle: null, songArtist: null, songPreviewUrl: null });
      if (audioRef.current) audioRef.current.pause();
      setSongPlaying(false);
    } catch (err) {
      console.error('Song delete error:', err);
    }
  };

  const addPromptSlot = () => {
    if (editPrompts.length < 3) {
      setModalPrompt({ prompt: '', answer: '' });
      setPromptModalOpen(true);
    }
  };

  const removePromptSlot = (index) => {
    setEditPrompts(editPrompts.filter((_, i) => i !== index));
  };

  const handleModalSave = () => {
    if (!modalPrompt.prompt || !modalPrompt.answer?.trim()) return;
    setEditPrompts([...editPrompts, { prompt: modalPrompt.prompt, answer: modalPrompt.answer.trim() }]);
    setPromptModalOpen(false);
    setModalPrompt({ prompt: '', answer: '' });
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
  const selectedMedia = photos[selectedPhotoIndex] || photos[0];
  const selectedIsVideo = isVideoUrl(selectedMedia);

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

      {/* Photo/Video Gallery */}
      {editing ? (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-300 mb-2">Media ({photos.length}/6, max 3 videos)</label>
          <div className={`grid grid-cols-3 gap-2${photos.length < 2 ? ' ring-2 ring-gold/50 rounded-xl p-1' : ''}`}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="relative aspect-square rounded-xl overflow-hidden">
                {photos[i] ? (
                  <>
                    {isVideoUrl(photos[i]) ? (
                      <video src={photos[i]} className="w-full h-full object-cover" playsInline muted loop autoPlay />
                    ) : (
                      <img src={photos[i]} alt="" className="w-full h-full object-cover" />
                    )}
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
                    <input type="file" accept="image/*,video/*" className="hidden" onChange={handlePhotoUpload} />
                  </label>
                )}
              </div>
            ))}
          </div>
          {photos.length < 2 && (
            <p className="text-xs text-gold/70 mt-1.5">Add at least 2 photos to stand out</p>
          )}
          {trimNotice && <p className="text-gold text-sm mt-2">{trimNotice}</p>}
          {photoError && <p className="text-red-400 text-sm mt-2">{photoError}</p>}
        </div>
      ) : (
        <>
          <div className="relative rounded-2xl overflow-hidden mb-5">
            {selectedIsVideo ? (
              <video
                ref={videoRef}
                src={selectedMedia}
                className="w-full aspect-[3/4] object-cover"
                playsInline
                autoPlay
                muted={videoMuted}
                loop
              />
            ) : photos.length > 0 ? (
              <img src={selectedMedia} alt="" className="w-full aspect-[3/4] object-cover" />
            ) : (
              <div className="w-full aspect-[3/4] bg-dark-50 flex items-center justify-center">
                <span className="text-6xl">👤</span>
              </div>
            )}

            {/* Video mute toggle */}
            {selectedIsVideo && (
              <button
                onClick={() => {
                  setVideoMuted(!videoMuted);
                  if (videoRef.current) videoRef.current.muted = !videoMuted;
                }}
                className="absolute bottom-3 right-3 w-9 h-9 bg-black/60 rounded-full flex items-center justify-center"
              >
                {videoMuted ? <VolumeX size={16} className="text-white" /> : <Volume2 size={16} className="text-white" />}
              </button>
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
                <input type="file" accept="image/*,video/*" multiple className="hidden" onChange={handlePhotoUpload} />
              </label>
            )}
          </div>

          {/* Media thumbnails */}
          {photos.length > 1 && (
            <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
              {photos.map((p, i) => (
                <div
                  key={i}
                  onClick={() => setSelectedPhotoIndex(i)}
                  className={`relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 cursor-pointer transition-opacity ${
                    i === selectedPhotoIndex ? 'ring-2 ring-gold' : 'opacity-60 hover:opacity-100'
                  }`}
                >
                  {isVideoUrl(p) ? (
                    <>
                      <video src={p} className="w-full h-full object-cover" preload="metadata" muted />
                      <span className="absolute inset-0 flex items-center justify-center">
                        <Play size={12} className="text-white drop-shadow" fill="currentColor" />
                      </span>
                    </>
                  ) : (
                    <img src={p} alt="" className="w-full h-full object-cover" />
                  )}
                </div>
              ))}
            </div>
          )}
          {trimNotice && <p className="text-gold text-sm mb-4">{trimNotice}</p>}
          {photoError && <p className="text-red-400 text-sm mb-4">{photoError}</p>}
        </>
      )}

      {/* Profile Info */}
      <div className="space-y-5">
        {editing ? (
          <div className="space-y-4">
            <Input label="Display Name" value={editForm.displayName} onChange={(e) => setEditForm({ ...editForm, displayName: e.target.value })} />
            <Textarea label="Bio" value={editForm.bio} onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })} />
            <LocationAutocomplete label="City" name="city" value={editForm.city} onChange={(e) => setEditForm({ ...editForm, city: e.target.value })} />
            <Input label="Looking For" value={editForm.lookingFor} onChange={(e) => setEditForm({ ...editForm, lookingFor: e.target.value })} />

            {/* Height & Weight */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Height</label>
                <div className="flex gap-1.5">
                  <select
                    value={editForm.height?.match(/^(\d)/)?.[1] || ''}
                    onChange={(e) => {
                      const ft = e.target.value;
                      const inMatch = editForm.height?.match(/'(\d{1,2})"/);
                      const inc = inMatch ? inMatch[1] : '0';
                      setEditForm({ ...editForm, height: ft ? `${ft}'${inc}"` : '' });
                    }}
                    className="flex-1 input-field py-2.5 text-sm"
                  >
                    <option value="">ft</option>
                    {HEIGHT_FEET.map((f) => <option key={f} value={f}>{f}ft</option>)}
                  </select>
                  <select
                    value={editForm.height?.match(/'(\d{1,2})"/)?.[1] || ''}
                    onChange={(e) => {
                      const inc = e.target.value;
                      const ftMatch = editForm.height?.match(/^(\d)/);
                      const ft = ftMatch ? ftMatch[1] : '5';
                      setEditForm({ ...editForm, height: `${ft}'${inc}"` });
                    }}
                    className="flex-1 input-field py-2.5 text-sm"
                  >
                    <option value="">in</option>
                    {HEIGHT_INCHES.map((i) => <option key={i} value={i}>{i}in</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Weight</label>
                <select
                  value={editForm.weight?.replace(' lbs', '') || ''}
                  onChange={(e) => setEditForm({ ...editForm, weight: e.target.value ? `${e.target.value} lbs` : '' })}
                  className="w-full input-field py-2.5 text-sm"
                >
                  <option value="">Select</option>
                  {WEIGHT_OPTIONS.map((w) => <option key={w} value={w}>{w} lbs</option>)}
                </select>
              </div>
            </div>

            {/* Occupation */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Occupation</label>
              <select
                value={editForm.occupation && !OCCUPATION_OPTIONS.includes(editForm.occupation) ? 'Other' : (editForm.occupation || '')}
                onChange={(e) => setEditForm({ ...editForm, occupation: e.target.value === 'Other' ? '' : e.target.value })}
                className="w-full input-field py-2.5 text-sm"
              >
                <option value="">Select occupation</option>
                {OCCUPATION_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
              {editForm.occupation !== undefined && !OCCUPATION_OPTIONS.includes(editForm.occupation) && editForm.occupation !== '' ? (
                <input
                  value={editForm.occupation}
                  onChange={(e) => setEditForm({ ...editForm, occupation: e.target.value })}
                  placeholder="Enter your occupation"
                  className="w-full input-field py-2.5 text-sm mt-2"
                  maxLength={50}
                />
              ) : null}
            </div>

            {/* Looking For Tags */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Looking For Tags</label>
              <div className="flex flex-wrap gap-2">
                {LOOKING_FOR_TAGS.map((tag) => {
                  const isActive = (editForm.lookingForTags || []).includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => {
                        const tags = editForm.lookingForTags || [];
                        setEditForm({
                          ...editForm,
                          lookingForTags: isActive ? tags.filter((t) => t !== tag) : [...tags, tag],
                        });
                      }}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                        isActive ? 'bg-gold text-dark' : 'bg-dark-100 text-gray-400 border border-dark-50 hover:border-gold/40'
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Song Edit */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Profile Song</label>
              {profile.songTitle ? (
                <div className="flex items-center gap-2 bg-dark-100 rounded-xl p-3">
                  <Music size={16} className="text-purple-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{profile.songTitle}</p>
                    {profile.songArtist && <p className="text-gray-500 text-xs truncate">{profile.songArtist}</p>}
                  </div>
                  <button onClick={handleSongDelete} className="text-gray-500 hover:text-red-400 flex-shrink-0">
                    <Trash2 size={16} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => { setSongForm({ songTitle: '', songArtist: '', songPreviewUrl: '' }); setSongModalOpen(true); }}
                  className="w-full py-2 border border-dashed border-dark-50 rounded-xl text-sm text-gray-500 hover:text-purple-400 hover:border-purple-accent/30 flex items-center justify-center gap-1 transition-colors"
                >
                  <Music size={14} /> Add Song
                </button>
              )}
            </div>

            {/* Profile Prompts Edit */}
            <div className={editPrompts.length === 0 ? 'ring-2 ring-gold/50 rounded-xl p-1' : ''}>
              <label className="block text-sm font-medium text-gray-300 mb-2">Profile Prompts (max 3)</label>
              {editPrompts.length === 0 && (
                <p className="text-xs text-gold/70 mb-2">Add prompts to show your personality</p>
              )}
              <div className="space-y-3">
                {editPrompts.map((ep, i) => (
                  <div key={i} className="bg-dark-100 rounded-xl p-3 flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-500 italic mb-1">{ep.prompt}</p>
                      <p className="text-white text-sm font-medium">{ep.answer}</p>
                    </div>
                    <button onClick={() => removePromptSlot(i)} className="mt-1 text-gray-500 hover:text-red-400 flex-shrink-0">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                {editPrompts.length < 3 && (
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

            {/* Detail pills — height, weight, occupation */}
            {(profile.height || profile.weight || profile.occupation) && (
              <div className="flex flex-wrap gap-2 mt-1">
                {profile.height && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-dark-50 rounded-full text-xs text-gray-300">
                    <Ruler size={12} className="text-gold" /> {profile.height}
                  </span>
                )}
                {profile.weight && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-dark-50 rounded-full text-xs text-gray-300">
                    {profile.weight}
                  </span>
                )}
                {profile.occupation && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-dark-50 rounded-full text-xs text-gray-300">
                    <Briefcase size={12} className="text-gold" /> {profile.occupation}
                  </span>
                )}
              </div>
            )}

            {/* Song Player Pill */}
            {profile.songTitle && (
              <div className="flex items-center gap-2 bg-dark-50 rounded-full px-3 py-2 w-fit">
                <Music size={14} className="text-purple-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-white font-medium truncate block max-w-[180px]">{profile.songTitle}</span>
                  {profile.songArtist && <span className="text-xs text-gray-500 truncate block max-w-[180px]">{profile.songArtist}</span>}
                </div>
                {profile.songPreviewUrl && (
                  <button onClick={toggleSongPlay} className="w-7 h-7 bg-purple-accent/20 rounded-full flex items-center justify-center flex-shrink-0">
                    {songPlaying ? <Pause size={12} className="text-purple-400" /> : <Play size={12} className="text-purple-400 ml-0.5" />}
                  </button>
                )}
                {isOwnProfile && (
                  <button onClick={handleSongDelete} className="text-gray-600 hover:text-red-400 flex-shrink-0">
                    <X size={14} />
                  </button>
                )}
                {profile.songPreviewUrl && (
                  <audio ref={audioRef} src={profile.songPreviewUrl} preload="none" onEnded={() => setSongPlaying(false)} />
                )}
              </div>
            )}

            {/* Add Song button (own profile, no song) */}
            {isOwnProfile && !profile.songTitle && !editing && (
              <button
                onClick={() => { setSongForm({ songTitle: '', songArtist: '', songPreviewUrl: '' }); setSongModalOpen(true); }}
                className="flex items-center gap-2 px-3 py-2 bg-dark-50 border border-dashed border-dark-50 hover:border-purple-accent/40 rounded-full text-sm text-gray-500 hover:text-purple-400 transition-colors"
              >
                <Music size={14} /> Add Song
              </button>
            )}

            {/* ── About ── */}
            {(profile.bio || profile.lookingFor || (profile.lookingForTags || []).length > 0) && (
              <>
                <div className="border-t border-dark-50" />
                <div className="space-y-4">
                  {profile.bio && <p className="text-gray-300 leading-relaxed">{profile.bio}</p>}

                  {profile.lookingFor && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-400 mb-1">Looking for</h3>
                      <p className="text-white">{profile.lookingFor}</p>
                    </div>
                  )}

                  {/* Looking For Tags */}
                  {(profile.lookingForTags || []).length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {profile.lookingForTags.map((tag) => (
                        <span key={tag} className="px-2.5 py-1 bg-gold/10 text-gold text-xs font-medium rounded-full border border-gold/20">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ── Profile Prompts ── */}
            {prompts.length > 0 && (
              <>
                <div className="border-t border-dark-50" />
                <div className="space-y-3">
                  {prompts.map((p, i) => (
                    <div key={i} className="border-l-2 border-purple-accent/50 bg-purple-accent/5 rounded-r-xl p-3">
                      <p className="text-xs text-gray-500 italic mb-1">{p.prompt}</p>
                      <p className="text-white font-medium text-sm">{p.answer}</p>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* ── Move History (Stepper profiles, viewed by others) ── */}
            {!isOwnProfile && moveHistory && moveHistory.completedCount > 0 && (
              <>
                <div className="border-t border-dark-50" />
                <div>
                  <div className="flex items-center gap-2 mb-3">
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
              </>
            )}

            {/* ── Actions ── */}
            <div className="border-t border-dark-50 pt-1" />
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

      {/* Prompt Modal */}
      <Modal isOpen={promptModalOpen} onClose={() => setPromptModalOpen(false)} title="Add Prompt">
        <div className="space-y-3">
          <p className="text-xs text-gray-500 mb-1">Choose a prompt</p>
          <div className="space-y-2 max-h-52 overflow-y-auto">
            {availablePrompts.map((p) => {
              const isUsed = editPrompts.some((ep) => ep.prompt === p);
              const isSelected = modalPrompt.prompt === p;
              return (
                <button
                  key={p}
                  type="button"
                  disabled={isUsed}
                  onClick={() => setModalPrompt({ ...modalPrompt, prompt: p })}
                  className={`w-full text-left px-4 py-3 rounded-xl text-sm transition-colors flex items-center justify-between ${
                    isUsed
                      ? 'opacity-40 cursor-not-allowed text-gray-500 bg-dark-100'
                      : isSelected
                        ? 'bg-dark-100 text-gold border border-gold/50'
                        : 'bg-dark-100 text-gray-300 hover:text-white hover:bg-dark-50 cursor-pointer'
                  }`}
                >
                  <span>{p}</span>
                  {isSelected && <Check size={14} className="text-gold" />}
                </button>
              );
            })}
          </div>
          {modalPrompt.prompt && (
            <div className="space-y-1">
              <textarea
                value={modalPrompt.answer}
                onChange={(e) => setModalPrompt({ ...modalPrompt, answer: e.target.value.slice(0, 150) })}
                placeholder="Your answer..."
                className="w-full bg-dark-50 text-white text-sm rounded-lg px-3 py-2 border border-dark-50 focus:border-gold/50 outline-none min-h-[120px] resize-none"
                maxLength={150}
                autoFocus
              />
              <p className="text-xs text-gray-500 text-right">{modalPrompt.answer.length}/150</p>
            </div>
          )}
          <Button
            variant="gold"
            className="w-full"
            onClick={handleModalSave}
            disabled={!modalPrompt.prompt || !modalPrompt.answer?.trim()}
          >
            Add Prompt
          </Button>
        </div>
      </Modal>

      {/* Song Modal */}
      <Modal isOpen={songModalOpen} onClose={() => setSongModalOpen(false)} title="Add Profile Song">
        <div className="space-y-3">
          <Input
            label="Song Title"
            value={songForm.songTitle}
            onChange={(e) => setSongForm({ ...songForm, songTitle: e.target.value })}
            placeholder="e.g. Snooze"
          />
          <Input
            label="Artist"
            value={songForm.songArtist}
            onChange={(e) => setSongForm({ ...songForm, songArtist: e.target.value })}
            placeholder="e.g. SZA"
          />
          <Input
            label="Preview URL (optional)"
            value={songForm.songPreviewUrl}
            onChange={(e) => setSongForm({ ...songForm, songPreviewUrl: e.target.value })}
            placeholder="Audio URL for playback"
          />
          <p className="text-xs text-gray-500">Paste a direct audio link (Spotify preview URL, etc.)</p>
          <Button variant="gold" className="w-full" onClick={handleSongSave} disabled={!songForm.songTitle?.trim()}>
            Save Song
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
