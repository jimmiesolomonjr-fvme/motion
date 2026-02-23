import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Eye, Heart, Send, MoreVertical, Trash2 } from 'lucide-react';
import api from '../../services/api';
import { isVideoUrl } from '../../utils/mediaUtils';

export default function StoryViewer({ storyGroups, startIndex, currentUserId, isAdmin, onClose }) {
  const [groupIdx, setGroupIdx] = useState(startIndex);
  const [storyIdx, setStoryIdx] = useState(0);
  const timerRef = useRef(null);
  const [progress, setProgress] = useState(0);
  const animRef = useRef(null);
  const startTimeRef = useRef(null);
  const storyVideoRef = useRef(null);

  const [duration, setDuration] = useState(5000); // default 5s for images
  const durationRef = useRef(5000);
  const [likedStories, setLikedStories] = useState({});

  // Reply state
  const [replyText, setReplyText] = useState('');
  const [replySending, setReplySending] = useState(false);
  const [replySuccess, setReplySuccess] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const pausedAtRef = useRef(0); // elapsed ms when paused
  const replyAreaRef = useRef(null);

  const group = storyGroups[groupIdx];
  const story = group?.stories[storyIdx];
  const isOwn = group?.userId === currentUserId;
  const hasLiked = story?.hasLiked || likedStories[story?.id];
  const storyIsVideo = story ? isVideoUrl(story.photo) : false;

  const markViewed = useCallback((storyId) => {
    api.post(`/stories/${storyId}/view`).catch(() => {});
  }, []);

  const handleLike = (e) => {
    e.stopPropagation();
    if (hasLiked || !story) return;
    setLikedStories((prev) => ({ ...prev, [story.id]: true }));
    api.post(`/stories/${story.id}/like`).catch(() => {
      setLikedStories((prev) => ({ ...prev, [story.id]: false }));
    });
  };

  const advance = useCallback(() => {
    if (storyIdx < group.stories.length - 1) {
      setStoryIdx(storyIdx + 1);
    } else if (groupIdx < storyGroups.length - 1) {
      setGroupIdx(groupIdx + 1);
      setStoryIdx(0);
    } else {
      onClose();
    }
  }, [storyIdx, groupIdx, group, storyGroups, onClose]);

  const goBack = useCallback(() => {
    if (storyIdx > 0) {
      setStoryIdx(storyIdx - 1);
    } else if (groupIdx > 0) {
      setGroupIdx(groupIdx - 1);
      const prevGroup = storyGroups[groupIdx - 1];
      setStoryIdx(prevGroup.stories.length - 1);
    }
  }, [storyIdx, groupIdx, storyGroups]);

  // Pause / resume helpers
  const pauseTimer = useCallback(() => {
    const elapsed = Date.now() - startTimeRef.current;
    pausedAtRef.current = elapsed;
    clearTimeout(timerRef.current);
    cancelAnimationFrame(animRef.current);
    setIsPaused(true);
    if (storyVideoRef.current) storyVideoRef.current.pause();
  }, []);

  const resumeTimer = useCallback(() => {
    const remaining = durationRef.current - pausedAtRef.current;
    if (remaining <= 0) {
      advance();
      return;
    }
    startTimeRef.current = Date.now() - pausedAtRef.current;
    setIsPaused(false);
    if (storyVideoRef.current) storyVideoRef.current.play().catch(() => {});

    const animate = () => {
      const elapsed = Date.now() - startTimeRef.current;
      const pct = Math.min(elapsed / durationRef.current, 1);
      setProgress(pct);
      if (pct < 1) {
        animRef.current = requestAnimationFrame(animate);
      }
    };
    animRef.current = requestAnimationFrame(animate);
    timerRef.current = setTimeout(advance, remaining);
  }, [advance]);

  // Reset reply state on story change
  useEffect(() => {
    setReplyText('');
    setReplySuccess(false);
    setReplySending(false);
    setIsPaused(false);
    setShowMenu(false);
    setShowDeleteConfirm(false);
    pausedAtRef.current = 0;
  }, [groupIdx, storyIdx]);

  // Handle video metadata to get actual duration
  const handleVideoMetadata = useCallback(() => {
    if (storyVideoRef.current) {
      const videoDur = Math.min(storyVideoRef.current.duration, 15) * 1000;
      setDuration(videoDur);
      durationRef.current = videoDur;
      // Restart the timer with the actual video duration
      clearTimeout(timerRef.current);
      cancelAnimationFrame(animRef.current);
      startTimeRef.current = Date.now();
      const animate = () => {
        const elapsed = Date.now() - startTimeRef.current;
        const pct = Math.min(elapsed / durationRef.current, 1);
        setProgress(pct);
        if (pct < 1) {
          animRef.current = requestAnimationFrame(animate);
        }
      };
      animRef.current = requestAnimationFrame(animate);
      timerRef.current = setTimeout(advance, videoDur);
    }
  }, [advance]);

  // Auto-advance timer with progress animation
  useEffect(() => {
    if (!story) return;
    markViewed(story.id);
    setProgress(0);
    startTimeRef.current = Date.now();

    const isVid = isVideoUrl(story.photo);
    const initialDuration = isVid ? 15000 : 5000; // default, will be adjusted by onLoadedMetadata for video
    setDuration(initialDuration);
    durationRef.current = initialDuration;

    const animate = () => {
      const elapsed = Date.now() - startTimeRef.current;
      const pct = Math.min(elapsed / durationRef.current, 1);
      setProgress(pct);
      if (pct < 1) {
        animRef.current = requestAnimationFrame(animate);
      }
    };
    animRef.current = requestAnimationFrame(animate);

    timerRef.current = setTimeout(advance, initialDuration);
    return () => {
      clearTimeout(timerRef.current);
      cancelAnimationFrame(animRef.current);
    };
  }, [groupIdx, storyIdx, story, advance, markViewed]);

  const handleReply = async () => {
    if (!replyText.trim() || replySending || !story) return;
    setReplySending(true);
    try {
      await api.post(`/stories/${story.id}/reply`, { content: replyText.trim() });
      setReplyText('');
      setReplySuccess(true);
      setTimeout(() => {
        setReplySuccess(false);
        resumeTimer();
      }, 1500);
    } catch (err) {
      console.error('Story reply error:', err);
      resumeTimer();
    } finally {
      setReplySending(false);
    }
  };

  const handleDelete = async () => {
    if (!story) return;
    try {
      await api.delete(`/stories/${story.id}`);
      // Remove from current group
      group.stories.splice(storyIdx, 1);
      if (group.stories.length === 0) {
        if (groupIdx < storyGroups.length - 1) {
          setGroupIdx(groupIdx + 1);
          setStoryIdx(0);
        } else {
          onClose();
        }
      } else if (storyIdx >= group.stories.length) {
        setStoryIdx(group.stories.length - 1);
      } else {
        setStoryIdx(storyIdx);
      }
      setShowDeleteConfirm(false);
      setShowMenu(false);
    } catch (err) {
      console.error('Delete story error:', err);
    }
  };

  if (!group || !story) return null;

  const handleTap = (e) => {
    if (replyAreaRef.current?.contains(e.target)) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < rect.width / 3) {
      goBack();
    } else {
      advance();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
      <div className="relative w-full max-w-lg h-full" onClick={handleTap}>
        {/* Progress bars */}
        <div className="absolute top-0 left-0 right-0 z-10 flex gap-1 p-2" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.5rem)' }}>
          {group.stories.map((_, i) => (
            <div key={i} className="flex-1 h-0.5 bg-white/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-none"
                style={{
                  width: i < storyIdx ? '100%' : i === storyIdx ? `${progress * 100}%` : '0%',
                }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center gap-3 p-4" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1.5rem)' }}>
          <img
            src={Array.isArray(group.avatar) ? group.avatar[0] : group.avatar}
            alt=""
            className="w-8 h-8 rounded-full object-cover border border-white/30"
          />
          <span className="text-white text-sm font-semibold flex-1">{group.displayName}</span>
          {isOwn && (
            <span className="flex items-center gap-1 text-white/70 text-xs">
              <Eye size={14} /> {story.viewCount}
            </span>
          )}
          {(isOwn || isAdmin) && (
            <div className="relative">
              <button
                onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); if (!showMenu) pauseTimer(); }}
                className="text-white/80 hover:text-white p-1"
              >
                <MoreVertical size={20} />
              </button>
              {showMenu && (
                <div
                  className="absolute right-0 top-full mt-1 bg-dark-100 border border-dark-50 rounded-xl shadow-xl z-50 min-w-[140px] overflow-hidden"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => { setShowMenu(false); setShowDeleteConfirm(true); }}
                    className="w-full flex items-center gap-2 px-4 py-3 text-sm text-red-400 hover:bg-dark-50 transition-colors"
                  >
                    <Trash2 size={14} /> Delete Story
                  </button>
                </div>
              )}
            </div>
          )}
          <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="text-white/80 hover:text-white">
            <X size={24} />
          </button>
        </div>

        {/* Delete confirmation overlay */}
        {showDeleteConfirm && (
          <div className="absolute inset-0 z-30 bg-black/70 flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            <div className="bg-dark-100 rounded-2xl p-6 mx-6 max-w-xs w-full">
              <p className="text-white font-semibold text-center mb-2">Delete this story?</p>
              <p className="text-gray-400 text-sm text-center mb-5">This cannot be undone.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowDeleteConfirm(false); resumeTimer(); }}
                  className="flex-1 px-4 py-2.5 bg-dark-50 text-white rounded-xl font-semibold text-sm hover:bg-dark-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  className="flex-1 px-4 py-2.5 bg-red-500 text-white rounded-xl font-semibold text-sm hover:bg-red-600 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Story media */}
        {storyIsVideo ? (
          <video
            ref={storyVideoRef}
            src={story.photo}
            className="w-full h-full object-cover"
            autoPlay
            muted
            playsInline
            onLoadedMetadata={handleVideoMetadata}
          />
        ) : (
          <img src={story.photo} alt="" className="w-full h-full object-cover" />
        )}

        {/* Bottom area */}
        <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-16 pb-6 px-4">
          {/* Caption */}
          {story.caption && (
            <p className="text-white text-sm mb-3">{story.caption}</p>
          )}

          {/* Reply input + action button (others' stories only) */}
          {!isOwn && (
            <div ref={replyAreaRef} onClick={(e) => e.stopPropagation()}>
              {replySuccess ? (
                <p className="text-center text-green-400 text-sm font-medium py-2">Reply sent!</p>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onFocus={pauseTimer}
                    onBlur={() => {
                      if (!replyText.trim() && !replySending) resumeTimer();
                    }}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleReply(); }}
                    placeholder="Reply to story..."
                    className="flex-1 bg-white/15 backdrop-blur-sm text-white text-sm rounded-full px-4 py-2.5 placeholder-white/50 border border-white/20 outline-none focus:border-white/40"
                  />
                  {replyText.trim() ? (
                    <button
                      onClick={handleReply}
                      disabled={replySending}
                      className="w-10 h-10 flex items-center justify-center rounded-full bg-gold text-dark shrink-0 disabled:opacity-50"
                    >
                      <Send size={18} />
                    </button>
                  ) : (
                    <button
                      onClick={handleLike}
                      className="w-10 h-10 flex items-center justify-center shrink-0"
                    >
                      <Heart
                        size={24}
                        className={hasLiked ? 'text-red-500' : 'text-white/80'}
                        fill={hasLiked ? 'currentColor' : 'none'}
                      />
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
