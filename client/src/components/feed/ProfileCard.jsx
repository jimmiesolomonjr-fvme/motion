import { Link } from 'react-router-dom';
import { Heart, MapPin, BadgeCheck, Sparkles, Zap, Play } from 'lucide-react';
import { isOnline } from '../../utils/formatters';

export default function ProfileCard({ user, onLike, onUnlike }) {
  const photo = user.profile?.photos?.[0];

  return (
    <div className="card-elevated overflow-hidden group">
      <Link to={`/profile/${user.id}`}>
        <div className="relative aspect-[3/4] rounded-xl overflow-hidden mb-3">
          {photo ? (
            <img src={photo} alt={user.profile?.displayName} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          ) : (
            <div className="w-full h-full bg-dark-100 flex items-center justify-center">
              <span className="text-4xl">👤</span>
            </div>
          )}

          {/* Online indicator */}
          {isOnline(user.lastOnline) && (
            <span className="absolute top-2 right-2 w-3 h-3 bg-green-500 rounded-full border-2 border-dark" />
          )}

          {/* Vibe score */}
          {user.vibeScore !== null && (
            <span className="absolute top-2 left-2 vibe-score flex items-center gap-1">
              <Sparkles size={10} />
              {user.vibeScore}%
            </span>
          )}

          {/* Video indicator */}
          {user.hasVideo && (
            <span className="absolute bottom-2 left-2 z-10 w-7 h-7 bg-black/60 rounded-full flex items-center justify-center">
              <Play size={12} className="text-white ml-0.5" fill="currentColor" />
            </span>
          )}

          {/* Bottom gradient */}
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/80 to-transparent" />

          {/* Info overlay */}
          <div className="absolute bottom-2 left-2 right-2">
            <div className="flex items-center gap-1.5">
              <h3 className="font-bold text-white text-sm truncate">
                {user.profile?.displayName}, {user.profile?.age}
              </h3>
              {user.isVerified && <BadgeCheck size={14} className="text-blue-400 flex-shrink-0" />}
              {user.isPlug && <Zap size={14} className="text-amber-400 flex-shrink-0" />}
            </div>
            <div className="flex items-center gap-1 text-gray-300 text-xs">
              <MapPin size={10} />
              <span>{user.profile?.city}</span>
              {user.distance !== null && <span>· {user.distance}mi</span>}
            </div>
          </div>
        </div>
      </Link>

      {user.hasLiked ? (
        <button
          onClick={() => onUnlike(user.id)}
          className="w-full flex items-center justify-center gap-2 py-2 text-sm font-medium text-pink-400 hover:bg-pink-400/10 rounded-lg transition-colors"
        >
          <Heart size={16} fill="currentColor" />
          Liked
        </button>
      ) : (
        <button
          onClick={() => onLike(user.id)}
          className="w-full flex items-center justify-center gap-2 py-2 text-sm font-medium text-gold hover:bg-gold/10 rounded-lg transition-colors"
        >
          <Heart size={16} />
          Like
        </button>
      )}
    </div>
  );
}
