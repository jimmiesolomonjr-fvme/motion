import { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import StoryViewer from './StoryViewer';
import CreateStory from './CreateStory';

export default function StoryBar() {
  const { user } = useAuth();
  const [storyGroups, setStoryGroups] = useState([]);
  const [viewerIndex, setViewerIndex] = useState(null);
  const [showCreate, setShowCreate] = useState(false);

  const fetchStories = () => {
    api.get('/stories').then(({ data }) => setStoryGroups(data)).catch(() => {});
  };

  useEffect(() => { fetchStories(); }, []);

  const handleAvatarClick = (index) => {
    const group = storyGroups[index];
    // If own avatar with no stories, open create
    if (group.userId === user?.id && group.stories.length === 0) {
      setShowCreate(true);
      return;
    }
    setViewerIndex(index);
  };

  const handleOwnAdd = () => {
    const own = storyGroups.find((g) => g.userId === user?.id);
    if (own && own.stories.length >= 3) return;
    setShowCreate(true);
  };

  const ownGroup = storyGroups.find((g) => g.userId === user?.id);

  return (
    <>
      <div className="flex gap-3 overflow-x-auto pb-2 mb-3 scrollbar-hide">
        {/* Own story slot (always first) */}
        {!ownGroup && (
          <button onClick={handleOwnAdd} className="flex flex-col items-center gap-1 flex-shrink-0">
            <div className="relative w-14 h-14 rounded-full bg-dark-100 border-2 border-dashed border-gold/40 flex items-center justify-center">
              <Plus className="text-gold" size={20} />
            </div>
            <span className="text-[10px] text-gray-500 w-14 truncate text-center">Your Story</span>
          </button>
        )}

        {storyGroups.map((group, i) => {
          const isOwn = group.userId === user?.id;
          const photo = Array.isArray(group.avatar) ? group.avatar[0] : group.avatar;
          const ringColor = isOwn
            ? 'ring-gold/40'
            : group.hasUnviewed
              ? 'ring-gold'
              : 'ring-gray-600';

          return (
            <button
              key={group.userId}
              onClick={() => handleAvatarClick(i)}
              className="flex flex-col items-center gap-1 flex-shrink-0"
            >
              <div className="relative">
                {photo ? (
                  <img
                    src={photo}
                    alt={group.displayName}
                    className={`w-14 h-14 rounded-full object-cover ring-2 ${ringColor}`}
                  />
                ) : (
                  <div className={`w-14 h-14 rounded-full bg-dark-100 ring-2 ${ringColor} flex items-center justify-center`}>
                    <span className="text-lg">👤</span>
                  </div>
                )}
                {isOwn && group.stories.length < 3 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleOwnAdd(); }}
                    className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-gold rounded-full flex items-center justify-center border-2 border-dark"
                  >
                    <Plus className="text-dark" size={10} />
                  </button>
                )}
              </div>
              <span className="text-[10px] text-gray-500 w-14 truncate text-center">
                {isOwn ? 'Your Story' : group.displayName}
              </span>
            </button>
          );
        })}
      </div>

      {viewerIndex !== null && (
        <StoryViewer
          storyGroups={storyGroups}
          startIndex={viewerIndex}
          currentUserId={user?.id}
          onClose={() => { setViewerIndex(null); fetchStories(); }}
        />
      )}

      <CreateStory
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={fetchStories}
      />
    </>
  );
}
