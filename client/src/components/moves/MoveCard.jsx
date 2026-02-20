import { MapPin, Calendar, Users, BadgeCheck, Check } from 'lucide-react';
import Avatar from '../ui/Avatar';
import Button from '../ui/Button';
import { formatDate } from '../../utils/formatters';

export default function MoveCard({ move, onInterest, userRole }) {
  const baddies = move.interestedBaddies || [];

  return (
    <div className="card-elevated">
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
      </div>

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
        ) : (
          <Button variant="gold" className="w-full" onClick={() => onInterest(move.id)}>
            I&apos;m Interested
          </Button>
        )
      )}
    </div>
  );
}
