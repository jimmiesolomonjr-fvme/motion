import { useRef, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, X, MapPin, BadgeCheck, Sparkles, Zap, Music, Play, Pause, VolumeX, Volume2 } from 'lucide-react';

export default function VerticalCard({ user, onLike, onUnlike, isVisible }) {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const audioRef = useRef(null);
  const [videoMuted, setVideoMuted] = useState(true);
  const [songPlaying, setSongPlaying] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);

  const profile = user.profile || {};
  const photos = profile.photos || [];
  const prompts = user.profilePrompts || [];
  const hasVideo = !!profile.videoIntro;

  // Auto-play/pause video based on visibility
  useEffect(() => {
    if (!videoRef.current) return;
    if (isVisible) {
      videoRef.current.play().catch(() => {});
    } else {
      videoRef.current.pause();
    }
  }, [isVisible]);

  // Pause audio when card leaves view
  useEffect(() => {
    if (!isVisible && audioRef.current) {
      audioRef.current.pause();
      setSongPlaying(false);
    }
  }, [isVisible]);

  const toggleSong = () => {
    if (!audioRef.current) return;
    if (songPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setSongPlaying(!songPlaying);
  };

  return (
    <div className="snap-start w-full flex flex-col bg-dark relative" style={{ height: 'calc(100dvh - 10rem)' }}>
      {/* Hero Section - top 55% */}
      <div className="relative flex-shrink-0" style={{ height: '55%' }}>
        {hasVideo ? (
          <video
            ref={videoRef}
            src={profile.videoIntro}
            className="w-full h-full object-cover"
            playsInline
            muted={videoMuted}
            loop
            onClick={() => {
              setVideoMuted(!videoMuted);
              if (videoRef.current) videoRef.current.muted = !videoMuted;
            }}
          />
        ) : photos.length > 0 ? (
          <img
            src={photos[0]}
            alt={profile.displayName}
            className="w-full h-full object-cover"
            onClick={() => navigate(`/profile/${user.id}`)}
          />
        ) : (
          <div className="w-full h-full bg-dark-100 flex items-center justify-center">
            <span className="text-6xl">👤</span>
          </div>
        )}

        {/* Video mute toggle */}
        {hasVideo && (
          <button
            onClick={() => {
              setVideoMuted(!videoMuted);
              if (videoRef.current) videoRef.current.muted = !videoMuted;
            }}
            className="absolute top-4 right-4 w-9 h-9 bg-black/50 rounded-full flex items-center justify-center z-10"
          >
            {videoMuted ? <VolumeX size={16} className="text-white" /> : <Volume2 size={16} className="text-white" />}
          </button>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-dark to-transparent" />

        {/* Info overlay */}
        <div className="absolute bottom-4 left-4 right-4 z-10">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-2xl font-bold text-white">{profile.displayName}, {profile.age}</h2>
            {user.isVerified && <BadgeCheck size={20} className="text-blue-400" />}
            {user.isPlug && <Zap size={18} className="text-amber-400" />}
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-sm text-gray-300">
              <MapPin size={14} /> {profile.city}
            </span>
            {user.distance !== null && user.distance !== undefined && (
              <span className="text-sm text-gray-400">{user.distance}mi</span>
            )}
            {user.vibeScore !== null && user.vibeScore !== undefined && (
              <span className="flex items-center gap-1 vibe-score">
                <Sparkles size={10} /> {user.vibeScore}%
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Content Area - bottom 45%, scrollable */}
      <div className="flex-1 overflow-y-auto px-4 pt-3 pb-24">
        {/* Song Player */}
        {profile.songTitle && (
          <div className="flex items-center gap-2 bg-dark-50 rounded-full px-3 py-2 mb-3 w-fit">
            <Music size={14} className="text-purple-400 flex-shrink-0" />
            <span className="text-sm text-white font-medium truncate max-w-[160px]">{profile.songTitle}</span>
            {profile.songArtist && <span className="text-xs text-gray-500 truncate max-w-[100px]">· {profile.songArtist}</span>}
            {profile.songPreviewUrl && (
              <>
                <button onClick={toggleSong} className="w-7 h-7 bg-purple-accent/20 rounded-full flex items-center justify-center flex-shrink-0">
                  {songPlaying ? <Pause size={12} className="text-purple-400" /> : <Play size={12} className="text-purple-400 ml-0.5" />}
                </button>
                <audio ref={audioRef} src={profile.songPreviewUrl} preload="none" onEnded={() => setSongPlaying(false)} />
              </>
            )}
          </div>
        )}

        {/* Profile Prompts */}
        {prompts.length > 0 && (
          <div className="space-y-2 mb-3">
            {prompts.map((p, i) => (
              <div key={i} className="border-l-2 border-purple-accent/50 bg-purple-accent/5 rounded-r-xl p-3">
                <p className="text-xs text-gray-500 italic mb-1">{p.prompt}</p>
                <p className="text-white font-medium text-sm">{p.answer}</p>
              </div>
            ))}
          </div>
        )}

        {/* Bio */}
        {profile.bio && (
          <div className="mb-3">
            <p className="text-gray-300 text-sm leading-relaxed">{profile.bio}</p>
          </div>
        )}

        {/* Looking For */}
        {profile.lookingFor && (
          <div className="mb-3">
            <h4 className="text-xs font-semibold text-gray-500 mb-1">Looking for</h4>
            <p className="text-white text-sm">{profile.lookingFor}</p>
          </div>
        )}

        {/* Photo Carousel (remaining photos) */}
        {photos.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-2 mb-3 -mx-1 px-1">
            {photos.slice(1).map((p, i) => (
              <img
                key={i}
                src={p}
                alt=""
                className="w-32 h-40 rounded-xl object-cover flex-shrink-0"
                onClick={() => navigate(`/profile/${user.id}`)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Floating Action Buttons */}
      <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-6 z-20">
        {user.hasLiked ? (
          <button
            onClick={() => onUnlike(user.id)}
            className="w-14 h-14 rounded-full bg-pink-500/20 border border-pink-500/30 flex items-center justify-center"
          >
            <Heart size={24} className="text-pink-400" fill="currentColor" />
          </button>
        ) : (
          <>
            <button
              onClick={() => navigate(`/profile/${user.id}`)}
              className="w-14 h-14 rounded-full bg-dark-50 border border-dark-50 flex items-center justify-center"
            >
              <X size={24} className="text-gray-400" />
            </button>
            <button
              onClick={() => onLike(user.id)}
              className="w-14 h-14 rounded-full bg-gold/20 border border-gold/30 flex items-center justify-center"
            >
              <Heart size={24} className="text-gold" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
