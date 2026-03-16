import { useRef, useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Eye, MessageCircle, MapPin, BadgeCheck, Sparkles, Zap, Music, Play, Pause, VolumeX, Volume2 } from 'lucide-react';
import { isVideoUrl } from '../../utils/mediaUtils';
import { isOnline } from '../../utils/formatters';
import { haptic } from '../../utils/haptics';
import { optimizeCloudinaryUrl } from '../../utils/cloudinaryUrl';
import DateEnergyBadge from '../ui/DateEnergyBadge';

const stagger = (delay) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { type: 'spring', stiffness: 300, damping: 24, delay },
});

export default function VerticalCard({ user, onLike, onUnlike, isVisible }) {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const audioRef = useRef(null);
  const lastTapRef = useRef(0);
  const [videoMuted, setVideoMuted] = useState(true);
  const [songPlaying, setSongPlaying] = useState(false);
  const [showHeartBurst, setShowHeartBurst] = useState(false);

  const profile = user.profile || {};
  const photos = profile.photos || [];
  const prompts = user.profilePrompts || [];
  const hasVideo = isVideoUrl(photos[0]);
  const online = isOnline(user.lastOnline);

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

  // Double-tap to like on photo
  const handlePhotoTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      // Double tap — fire like
      haptic(50);
      if (!user.hasLiked) {
        onLike(user.id);
      }
      setShowHeartBurst(true);
      setTimeout(() => setShowHeartBurst(false), 900);
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
    }
  }, [user.id, user.hasLiked, onLike]);

  const vibeHigh = user.vibeScore !== null && user.vibeScore !== undefined && user.vibeScore >= 80;

  return (
    <div className="snap-start w-full px-3 py-1.5" style={{ height: 'calc(100dvh - 13rem)' }}>
      <div
        className={`w-full h-full flex flex-col bg-dark rounded-2xl overflow-hidden relative transition-all duration-500 ${
          isVisible
            ? 'border border-gold/30 shadow-[0_0_20px_rgba(212,175,55,0.15)]'
            : 'border border-dark-50'
        }`}
      >
        {/* Hero Section - top 55% */}
        <div className="relative flex-shrink-0 overflow-hidden" style={{ height: '55%' }}>
          {hasVideo ? (
            <video
              ref={videoRef}
              src={photos[0]}
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
              src={optimizeCloudinaryUrl(photos[0], { width: 800 })}
              alt={profile.displayName}
              loading="lazy"
              className={`w-full h-full object-cover transition-transform duration-[8000ms] ease-out ${
                isVisible ? 'scale-110' : 'scale-100'
              }`}
              onClick={handlePhotoTap}
            />
          ) : (
            <div className="w-full h-full bg-dark-100 flex items-center justify-center">
              <span className="text-6xl">&#x1f464;</span>
            </div>
          )}

          {/* Double-tap heart burst */}
          <AnimatePresence>
            {showHeartBurst && (
              <motion.div
                className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <motion.div
                  initial={{ scale: 0, rotate: -15 }}
                  animate={{ scale: 1, rotate: 0 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 15 }}
                >
                  <Heart size={80} className="text-gold drop-shadow-lg" fill="currentColor" />
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Online indicator */}
          {online && (
            <div className={`absolute top-4 ${hasVideo ? 'left-4' : 'right-4'} z-10 flex items-center gap-1.5 bg-black/50 rounded-full px-2.5 py-1`}>
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-400" />
              </span>
              <span className="text-xs text-green-300 font-medium">Online</span>
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

          {/* View Profile eye button */}
          <button
            onClick={() => navigate(`/profile/${user.id}`)}
            className="absolute bottom-14 right-4 w-9 h-9 bg-black/40 rounded-full flex items-center justify-center z-10"
            title="View Profile"
          >
            <Eye size={16} className="text-white/80" />
          </button>

          {/* Gradient overlay */}
          <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-dark to-transparent" />

          {/* Info overlay */}
          {isVisible ? (
            <motion.div className="absolute bottom-4 left-4 right-4 z-10" {...stagger(0.1)}>
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
                  <motion.span
                    className={`flex items-center gap-1 vibe-score ${
                      vibeHigh ? 'shadow-[0_0_8px_rgba(147,51,234,0.5)]  rounded-full px-1.5 py-0.5 border border-purple-500/30 bg-purple-500/10' : ''
                    }`}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 15, delay: 0.2 }}
                  >
                    <Sparkles size={10} /> {user.vibeScore}%
                  </motion.span>
                )}
              </div>
              {(profile.height || profile.occupation) && (
                <p className="text-xs text-gray-400 mt-0.5">
                  {[profile.height, profile.occupation].filter(Boolean).join(' \u00b7 ')}
                </p>
              )}
              {user.dateEnergy && <div className="mt-1"><DateEnergyBadge energy={user.dateEnergy} size="sm" /></div>}
            </motion.div>
          ) : (
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
                  <span className={`flex items-center gap-1 vibe-score ${
                    vibeHigh ? 'shadow-[0_0_8px_rgba(147,51,234,0.5)] rounded-full px-1.5 py-0.5 border border-purple-500/30 bg-purple-500/10' : ''
                  }`}>
                    <Sparkles size={10} /> {user.vibeScore}%
                  </span>
                )}
              </div>
              {(profile.height || profile.occupation) && (
                <p className="text-xs text-gray-400 mt-0.5">
                  {[profile.height, profile.occupation].filter(Boolean).join(' \u00b7 ')}
                </p>
              )}
              {user.dateEnergy && <div className="mt-1"><DateEnergyBadge energy={user.dateEnergy} size="sm" /></div>}
            </div>
          )}
        </div>

        {/* Content Area + Actions */}
        <div className="flex-1 flex flex-col min-h-0 px-4 pt-3 pb-2">
          {/* Content — clipped, no inner scroll */}
          <div className="overflow-hidden min-h-0">
            {/* Song Player */}
            {profile.songTitle && (
              isVisible ? (
                <motion.div className="flex items-center gap-2 bg-dark-50 rounded-full px-3 py-2 mb-3 w-fit" {...stagger(0.2)}>
                  {profile.songArtworkUrl ? (
                    <img src={optimizeCloudinaryUrl(profile.songArtworkUrl, { width: 80 })} alt="" className="w-7 h-7 rounded-md object-cover flex-shrink-0" />
                  ) : (
                    <Music size={14} className="text-purple-400 flex-shrink-0" />
                  )}
                  <span className="text-sm text-white font-medium truncate max-w-[160px]">{profile.songTitle}</span>
                  {profile.songArtist && <span className="text-xs text-gray-500 truncate max-w-[100px]">&middot; {profile.songArtist}</span>}
                  {profile.songPreviewUrl && (
                    <>
                      <button onClick={toggleSong} className="w-7 h-7 bg-purple-accent/20 rounded-full flex items-center justify-center flex-shrink-0">
                        {songPlaying ? <Pause size={12} className="text-purple-400" /> : <Play size={12} className="text-purple-400 ml-0.5" />}
                      </button>
                      <audio ref={audioRef} src={profile.songPreviewUrl} preload="none" onEnded={() => setSongPlaying(false)} />
                    </>
                  )}
                </motion.div>
              ) : (
                <div className="flex items-center gap-2 bg-dark-50 rounded-full px-3 py-2 mb-3 w-fit">
                  {profile.songArtworkUrl ? (
                    <img src={optimizeCloudinaryUrl(profile.songArtworkUrl, { width: 80 })} alt="" className="w-7 h-7 rounded-md object-cover flex-shrink-0" />
                  ) : (
                    <Music size={14} className="text-purple-400 flex-shrink-0" />
                  )}
                  <span className="text-sm text-white font-medium truncate max-w-[160px]">{profile.songTitle}</span>
                  {profile.songArtist && <span className="text-xs text-gray-500 truncate max-w-[100px]">&middot; {profile.songArtist}</span>}
                  {profile.songPreviewUrl && (
                    <>
                      <button onClick={toggleSong} className="w-7 h-7 bg-purple-accent/20 rounded-full flex items-center justify-center flex-shrink-0">
                        {songPlaying ? <Pause size={12} className="text-purple-400" /> : <Play size={12} className="text-purple-400 ml-0.5" />}
                      </button>
                      <audio ref={audioRef} src={profile.songPreviewUrl} preload="none" onEnded={() => setSongPlaying(false)} />
                    </>
                  )}
                </div>
              )
            )}

            {/* Profile Prompts (max 2, clamped) */}
            {prompts.length > 0 && (
              isVisible ? (
                <motion.div className="space-y-2 mb-3" {...stagger(0.25)}>
                  {prompts.slice(0, 2).map((p, i) => (
                    <div key={i} className="border-l-2 border-purple-accent/50 bg-purple-accent/5 rounded-r-xl p-3">
                      <p className="text-xs text-gray-500 italic mb-1">{p.prompt}</p>
                      <p className="text-white font-medium text-sm line-clamp-2">{p.answer}</p>
                    </div>
                  ))}
                </motion.div>
              ) : (
                <div className="space-y-2 mb-3">
                  {prompts.slice(0, 2).map((p, i) => (
                    <div key={i} className="border-l-2 border-purple-accent/50 bg-purple-accent/5 rounded-r-xl p-3">
                      <p className="text-xs text-gray-500 italic mb-1">{p.prompt}</p>
                      <p className="text-white font-medium text-sm line-clamp-2">{p.answer}</p>
                    </div>
                  ))}
                </div>
              )
            )}

            {/* Bio (2-line clamp) */}
            {profile.bio && (
              isVisible ? (
                <motion.div className="mb-3" {...stagger(0.3)}>
                  <p className="text-gray-300 text-sm leading-relaxed line-clamp-2">{profile.bio}</p>
                </motion.div>
              ) : (
                <div className="mb-3">
                  <p className="text-gray-300 text-sm leading-relaxed line-clamp-2">{profile.bio}</p>
                </div>
              )
            )}

            {/* Looking For Tags */}
            {(profile.lookingForTags || []).length > 0 && (
              isVisible ? (
                <motion.div className="flex flex-wrap gap-1.5 mb-3" {...stagger(0.35)}>
                  {profile.lookingForTags.slice(0, 3).map((tag) => (
                    <span key={tag} className="px-2 py-0.5 bg-gold/10 text-gold text-xs font-medium rounded-full border border-gold/20">
                      {tag}
                    </span>
                  ))}
                  {profile.lookingForTags.length > 3 && (
                    <span className="px-2 py-0.5 text-gold/60 text-xs font-medium">
                      +{profile.lookingForTags.length - 3}
                    </span>
                  )}
                </motion.div>
              ) : (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {profile.lookingForTags.slice(0, 3).map((tag) => (
                    <span key={tag} className="px-2 py-0.5 bg-gold/10 text-gold text-xs font-medium rounded-full border border-gold/20">
                      {tag}
                    </span>
                  ))}
                  {profile.lookingForTags.length > 3 && (
                    <span className="px-2 py-0.5 text-gold/60 text-xs font-medium">
                      +{profile.lookingForTags.length - 3}
                    </span>
                  )}
                </div>
              )
            )}

            {/* Recent Vibe Answer */}
            {user.recentVibe && user.recentVibe.questionText && (
              <div className="border-l-2 border-gold/50 bg-gold/5 rounded-r-xl p-3 mb-3">
                <p className="text-xs text-gray-500 italic mb-1">{user.recentVibe.questionText}</p>
                <p className="text-white font-medium text-sm">
                  {user.recentVibe.answer ? 'Yes' : 'No'}
                </p>
              </div>
            )}
          </div>

          {/* Action Buttons — always pinned at bottom */}
          {isVisible ? (
            <motion.div className="flex-shrink-0 flex justify-center gap-5 pt-2 pb-1" {...stagger(0.4)}>
              <motion.button
                onClick={() => navigate(`/profile/${user.id}`)}
                className="w-14 h-14 rounded-full bg-dark-50 border border-dark-50 flex items-center justify-center"
                title="View Profile"
                whileTap={{ scale: 0.85 }}
              >
                <Eye size={22} className="text-gray-400" />
              </motion.button>
              {user.hasLiked ? (
                <motion.button
                  onClick={() => onUnlike(user.id)}
                  className="w-14 h-14 rounded-full bg-pink-500/20 border border-pink-500/30 flex items-center justify-center"
                  title="Unlike"
                  whileTap={{ scale: 0.85 }}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 15 }}
                >
                  <Heart size={24} className="text-pink-400" fill="currentColor" />
                </motion.button>
              ) : (
                <motion.button
                  onClick={() => onLike(user.id)}
                  className="w-14 h-14 rounded-full bg-gold/20 border border-gold/30 flex items-center justify-center"
                  title="Like"
                  whileTap={{ scale: 0.85 }}
                >
                  <Heart size={24} className="text-gold" />
                </motion.button>
              )}
              <motion.button
                onClick={() => navigate(`/messages`)}
                className="w-14 h-14 rounded-full bg-dark-50 border border-dark-50 flex items-center justify-center"
                title="Message"
                whileTap={{ scale: 0.85 }}
              >
                <MessageCircle size={22} className="text-gray-400" />
              </motion.button>
            </motion.div>
          ) : (
            <div className="flex-shrink-0 flex justify-center gap-5 pt-2 pb-1">
              <button
                onClick={() => navigate(`/profile/${user.id}`)}
                className="w-14 h-14 rounded-full bg-dark-50 border border-dark-50 flex items-center justify-center"
                title="View Profile"
              >
                <Eye size={22} className="text-gray-400" />
              </button>
              {user.hasLiked ? (
                <button
                  onClick={() => onUnlike(user.id)}
                  className="w-14 h-14 rounded-full bg-pink-500/20 border border-pink-500/30 flex items-center justify-center"
                  title="Unlike"
                >
                  <Heart size={24} className="text-pink-400" fill="currentColor" />
                </button>
              ) : (
                <button
                  onClick={() => onLike(user.id)}
                  className="w-14 h-14 rounded-full bg-gold/20 border border-gold/30 flex items-center justify-center"
                  title="Like"
                >
                  <Heart size={24} className="text-gold" />
                </button>
              )}
              <button
                onClick={() => navigate(`/messages`)}
                className="w-14 h-14 rounded-full bg-dark-50 border border-dark-50 flex items-center justify-center"
                title="Message"
              >
                <MessageCircle size={22} className="text-gray-400" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
