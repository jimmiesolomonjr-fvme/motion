import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Users, MapPin } from 'lucide-react';
import api from '../../services/api';
import { optimizeCloudinaryUrl } from '../../utils/cloudinaryUrl';

export default function MotionPicksBar() {
  const [picks, setPicks] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/moves/community/picks').then(({ data }) => {
      setPicks(data);
    }).catch(() => {});
  }, []);

  if (picks.length === 0) return null;

  return (
    <div className="mb-4">
      <div className="flex items-center gap-1.5 mb-2 px-1">
        <Sparkles size={14} className="text-gold" />
        <span className="text-xs font-semibold text-gold uppercase tracking-wide">Motion Picks</span>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4">
        {picks.map((pick) => (
          <div
            key={pick.id}
            onClick={() => navigate('/moves', { state: { tab: 'picks' } })}
            className="flex-shrink-0 w-36 cursor-pointer group"
          >
            <div className="relative rounded-xl overflow-hidden mb-1.5">
              {pick.photo ? (
                <img
                  src={optimizeCloudinaryUrl(pick.photo, { width: 300 })}
                  alt={pick.title}
                  className="w-36 h-24 object-cover group-hover:scale-105 transition-transform"
                />
              ) : (
                <div className="w-36 h-24 bg-gradient-to-br from-gold/20 to-purple-500/20 flex items-center justify-center">
                  <Sparkles size={24} className="text-gold" />
                </div>
              )}
              {/* Pool count badge */}
              {pick.poolCount > 0 && (
                <div className="absolute top-1.5 right-1.5 flex items-center gap-1 bg-dark/80 backdrop-blur-sm px-1.5 py-0.5 rounded-full">
                  <Users size={10} className="text-gold" />
                  <span className="text-[10px] text-white font-medium">{pick.poolCount}</span>
                </div>
              )}
              {/* User status indicator */}
              {pick.userStatus === 'in_pool' && (
                <div className="absolute bottom-1.5 left-1.5 bg-green-500/90 px-1.5 py-0.5 rounded-full">
                  <span className="text-[9px] text-white font-semibold">In Pool</span>
                </div>
              )}
              {pick.userStatus === 'paired' && (
                <div className="absolute bottom-1.5 left-1.5 bg-purple-500/90 px-1.5 py-0.5 rounded-full">
                  <span className="text-[9px] text-white font-semibold">Paired</span>
                </div>
              )}
            </div>
            <p className="text-xs font-semibold text-white truncate">{pick.title}</p>
            <p className="text-[10px] text-gray-500 truncate flex items-center gap-0.5">
              <MapPin size={9} /> {pick.location}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
