import { MapPin, Calendar, Users, BadgeCheck, Check, Trash2, Bookmark, Clock, AlertTriangle } from 'lucide-react';
import Avatar from '../ui/Avatar';
import Button from '../ui/Button';
import { formatDate } from '../../utils/formatters';

const CATEGORY_LABELS = {
  DINNER: 'Dinner',
  DRINKS: 'Drinks',
  ADVENTURE: 'Adventure',
  GROUP: 'Group',
  CONCERT: 'Concert',
  OTHER: 'Other',
};

export default function MoveCard({ move, onInterest, userRole, isAdmin, onDelete, onSave, onUnsave }) {
  const baddies = move.interestedBaddies || [];

  return (
    <div className="card-elevated">
      {/* Move Photo */}
      {move.photo && (
        <div className="relative -mx-4 -mt-4 mb-4 rounded-t-xl overflow-hidden">
          <img src={move.photo} alt={move.title} className="w-full h-44 object-cover" />
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
        <Avatar src={move.stepper.profile?.photos} name={move.stepper.profile?.displayName} size="sm" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-white text-sm truncate">
              {move.stepper.profile?.displayName}
            </span>
            {move.stepper.isVerified && <BadgeCheck size={14} className="text-blue-400" />}
            <span className="badge-stepper ml-1">Stepper</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {/* Bookmark for Baddies */}
          {userRole === 'BADDIE' && (onSave || onUnsave) && (
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
          {formatDate(move.date)}
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
          <span className="text-xs text-amber-400 font-medium">Closing soon — less than 48h left</span>
        </div>
      )}
      {move.interestClosed && move.status === 'OPEN' && (
        <div className="flex items-center gap-1.5 mb-3 px-2.5 py-1.5 bg-red-500/10 border border-red-500/20 rounded-lg">
          <AlertTriangle size={14} className="text-red-400" />
          <span className="text-xs text-red-400 font-medium">Interest closed</span>
        </div>
      )}

      {/* Interested baddies */}
      {baddies.length === 1 && (
        <div className="flex items-center gap-2 mb-4">
          <img
            src={baddies[0].photo}
            alt={baddies[0].displayName}
            className="w-7 h-7 rounded-full object-cover border-2 border-dark"
          />
          <span className="text-xs text-gray-300">
            <span className="text-white font-medium">{baddies[0].displayName}</span> is interested
          </span>
        </div>
      )}
      {baddies.length >= 2 && (
        <div className="flex items-center gap-2 mb-4">
          <div className="flex -space-x-2">
            {baddies.map((b) => (
              <img
                key={b.id}
                src={b.photo}
                alt={b.displayName}
                className="w-7 h-7 rounded-full object-cover border-2 border-dark ring-0"
              />
            ))}
          </div>
          <span className="text-xs text-gray-400">
            {move.interestCount} interested
          </span>
        </div>
      )}

      {userRole === 'BADDIE' && (
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
            I&apos;m Interested
          </Button>
        )
      )}
    </div>
  );
}
