import { Link } from 'react-router-dom';
import { MapPin, Calendar, Users, BadgeCheck, Check, Trash2, Bookmark, Clock, AlertTriangle, Edit3, Sparkles } from 'lucide-react';
import Avatar from '../ui/Avatar';
import Button from '../ui/Button';
import { formatDate } from '../../utils/formatters';
import { optimizeCloudinaryUrl } from '../../utils/cloudinaryUrl';

const CATEGORY_LABELS = {
  DINNER: 'Dinner',
  DRINKS: 'Drinks',
  ADVENTURE: 'Adventure',
  GROUP: 'Group',
  CONCERT: 'Concert',
  OTHER: 'Other',
};

export default function MoveCard({ move, onInterest, userRole, isAdmin, onDelete, onSave, onUnsave, currentUserId, onEdit }) {
  const interestedUsers = move.interestedUsers || [];
  const creator = move.creator || move.stepper;
  const isCommunityMove = creator?.isDummy === true || creator?.isAdmin === true;
  const isCreatorBaddie = creator?.role === 'BADDIE';
  const canExpress = isCommunityMove || (isCreatorBaddie && userRole === 'STEPPER') || (!isCreatorBaddie && userRole === 'BADDIE');

  return (
    <div className="card-elevated">
      {/* Move Photo */}
      {move.photo && (
        <div className="relative -mx-4 -mt-4 mb-4 rounded-t-xl overflow-hidden">
          <img src={optimizeCloudinaryUrl(move.photo, { width: 600 })} alt={move.title} className="w-full h-44 object-cover" />
          {move.status === 'CONFIRMED' && (
            <span className="absolute top-2 left-2 px-2.5 py-1 bg-green-500/90 text-white text-xs font-semibold rounded-full">
              Confirmed
            </span>
          )}
        </div>
      )}

      {/* Status badge (no photo) */}
      {!move.photo && move.status === 'CONFIRMED' && (
        <span className="inline-block px-2.5 py-1 bg-green-500/20 text-green-400 text-xs font-semibold rounded-full mb-3">
          Confirmed
        </span>
      )}

      <div className="flex items-start gap-3 mb-4">
        {isCommunityMove ? (
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-gold/20 to-purple-500/20 flex items-center justify-center flex-shrink-0">
            <Sparkles size={18} className="text-gold" />
          </div>
        ) : (
          <Avatar src={creator?.profile?.photos} name={creator?.profile?.displayName} size="sm" />
        )}
        <div className="flex-1 min-w-0">
          {isCommunityMove ? (
            <>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-gold text-sm">Motion</span>
                <span className="ml-1 px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-gold/10 text-gold">
                  Community
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">Community Date Idea</p>
            </>
          ) : (
            <>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-white text-sm truncate">
                  {creator?.profile?.displayName}
                </span>
                {creator?.isVerified && <BadgeCheck size={14} className="text-blue-400" />}
                <span className={`ml-1 ${isCreatorBaddie ? 'badge-baddie' : 'badge-stepper'}`}>
                  {isCreatorBaddie ? 'Baddie' : 'Stepper'}
                </span>
              </div>
              {isCreatorBaddie && (
                <p className="text-xs text-gray-500 mt-0.5">Looking for a Stepper to take her out</p>
              )}
            </>
          )}
        </div>
        <div className="flex items-center gap-1">
          {currentUserId && onEdit && move.creatorId === currentUserId && move.status === 'OPEN' && (Date.now() - new Date(move.createdAt).getTime()) / 60000 <= 10 && (
            <button
              onClick={() => onEdit(move)}
              className="p-1.5 text-gray-500 hover:text-gold transition-colors"
              title="Edit move"
            >
              <Edit3 size={16} />
            </button>
          )}
          {(onSave || onUnsave) && (
            <button
              onClick={() => move.isSaved ? onUnsave?.(move.id) : onSave?.(move.id)}
              className="p-1.5 text-gray-500 hover:text-gold transition-colors"
              title={move.isSaved ? 'Unsave' : 'Save'}
            >
              <Bookmark size={16} className={move.isSaved ? 'text-gold fill-gold' : ''} />
            </button>
          )}
          {isAdmin && onDelete && (
            <button
              onClick={() => onDelete(move.id)}
              className="p-1.5 text-gray-500 hover:text-red-400 transition-colors"
              title="Delete move"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>

      <h3 className="text-lg font-bold text-white mb-2">{move.title}</h3>
      <p className="text-gray-400 text-sm mb-4">{move.description}</p>

      <div className="flex flex-wrap gap-3 text-sm text-gray-400 mb-4">
        <span className="flex items-center gap-1">
          <Calendar size={14} className="text-gold" />
          {move.isAnytime
            ? `Anytime ${new Date(move.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
            : formatDate(move.date)}
        </span>
        <span className="flex items-center gap-1">
          <MapPin size={14} className="text-gold" />
          {move.location}
        </span>
        <span className="flex items-center gap-1">
          <Users size={14} className="text-gold" />
          {move.interestCount}/{move.maxInterest} interested
        </span>
        {move.category && (
          <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs font-medium rounded-full">
            {CATEGORY_LABELS[move.category] || move.category}
          </span>
        )}
      </div>

      {/* Closing soon / closed badges */}
      {move.interestClosingSoon && move.status === 'OPEN' && (
        <div className="flex items-center gap-1.5 mb-3 px-2.5 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <Clock size={14} className="text-amber-400" />
          <span className="text-xs text-amber-400 font-medium">Closing soon — less than 4h left</span>
        </div>
      )}
      {move.interestClosed && move.status === 'OPEN' && (
        <div className="flex items-center gap-1.5 mb-3 px-2.5 py-1.5 bg-red-500/10 border border-red-500/20 rounded-lg">
          <AlertTriangle size={14} className="text-red-400" />
          <span className="text-xs text-red-400 font-medium">Interest closed</span>
        </div>
      )}

      {/* Interested users */}
      {interestedUsers.length === 1 && (
        <div className="flex items-center gap-2 mb-4">
          <Link to={`/profile/${interestedUsers[0].id}`}>
            <img
              src={optimizeCloudinaryUrl(interestedUsers[0].photo, { width: 64, crop: 'fill' })}
              alt={interestedUsers[0].displayName}
              className="w-7 h-7 rounded-full object-cover border-2 border-dark"
            />
          </Link>
          <span className="text-xs text-gray-300">
            <Link to={`/profile/${interestedUsers[0].id}`} className="text-white font-medium hover:underline">
              {interestedUsers[0].displayName}
            </Link>
            {isCommunityMove ? ' wants to go' : ' is interested'}
          </span>
        </div>
      )}
      {interestedUsers.length >= 2 && (
        <div className="flex items-center gap-2 mb-4">
          <div className="flex -space-x-2">
            {interestedUsers.map((u) => (
              <Link key={u.id} to={`/profile/${u.id}`}>
                <img
                  src={optimizeCloudinaryUrl(u.photo, { width: 64, crop: 'fill' })}
                  alt={u.displayName}
                  className="w-7 h-7 rounded-full object-cover border-2 border-dark ring-0"
                />
              </Link>
            ))}
          </div>
          <span className="text-xs text-gray-400">
            {isCommunityMove
              ? `${interestedUsers.length} ${userRole === 'STEPPER' ? 'Baddies' : 'Steppers'} want to go`
              : `${move.interestCount} interested`}
          </span>
        </div>
      )}

      {canExpress && (
        move.hasInterest ? (
          <Button variant="outline" className="w-full opacity-70 cursor-default" disabled>
            <Check size={16} className="inline mr-2 text-green-400" /> Interested
          </Button>
        ) : move.interestClosed || move.status !== 'OPEN' ? (
          <Button variant="outline" className="w-full opacity-50 cursor-not-allowed" disabled>
            {move.status === 'CONFIRMED' ? 'Confirmed' : 'Interest Closed'}
          </Button>
        ) : (
          <Button variant="gold" className="w-full" onClick={() => onInterest(move.id)}>
            {isCommunityMove ? "I'm Down" : isCreatorBaddie ? "I'll Take You" : "I'm Interested"}
          </Button>
        )
      )}
    </div>
  );
}
