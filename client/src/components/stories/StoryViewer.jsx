import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Eye, Heart } from 'lucide-react';
import api from '../../services/api';

export default function StoryViewer({ storyGroups, startIndex, currentUserId, onClose }) {
  const [groupIdx, setGroupIdx] = useState(startIndex);
  const [storyIdx, setStoryIdx] = useState(0);
  const timerRef = useRef(null);
  const [progress, setProgress] = useState(0);
  const animRef = useRef(null);
  const startTimeRef = useRef(null);

  const DURATION = 5000; // 5 seconds per story
  const [likedStories, setLikedStories] = useState({});

  const group = storyGroups[groupIdx];
  const story = group?.stories[storyIdx];
  const isOwn = group?.userId === currentUserId;
  const hasLiked = story?.hasLiked || likedStories[story?.id];

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

  // Auto-advance timer with progress animation
  useEffect(() => {
    if (!story) return;
    markViewed(story.id);
    setProgress(0);
    startTimeRef.current = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTimeRef.current;
      const pct = Math.min(elapsed / DURATION, 1);
      setProgress(pct);
      if (pct < 1) {
        animRef.current = requestAnimationFrame(animate);
      }
    };
    animRef.current = requestAnimationFrame(animate);

    timerRef.current = setTimeout(advance, DURATION);
    return () => {
      clearTimeout(timerRef.current);
      cancelAnimationFrame(animRef.current);
    };
  }, [groupIdx, storyIdx, story, advance, markViewed]);

  if (!group || !story) return null;

  const handleTap = (e) => {
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
          <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="text-white/80 hover:text-white">
            <X size={24} />
          </button>
        </div>

        {/* Story image */}
        <img src={story.photo} alt="" className="w-full h-full object-cover" />

        {/* Like button (others' stories only) */}
        {!isOwn && (
          <button
            onClick={handleLike}
            className="absolute bottom-6 right-4 z-10 flex flex-col items-center gap-1"
          >
            <Heart
              size={28}
              className={hasLiked ? 'text-red-500' : 'text-white/80'}
              fill={hasLiked ? 'currentColor' : 'none'}
            />
            {(story.likeCount > 0 || hasLiked) && (
              <span className="text-white/70 text-xs">
                {(story.likeCount || 0) + (hasLiked && !story.hasLiked ? 1 : 0)}
              </span>
            )}
          </button>
        )}

        {/* Caption */}
        {story.caption && (
          <div className="absolute bottom-0 left-0 right-0 p-6 pr-16 bg-gradient-to-t from-black/80 to-transparent">
            <p className="text-white text-sm">{story.caption}</p>
          </div>
        )}
      </div>
    </div>
  );
}
