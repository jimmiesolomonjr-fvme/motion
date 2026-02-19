import { MapPin, Calendar, Users, BadgeCheck } from 'lucide-react';
import Avatar from '../ui/Avatar';
import Button from '../ui/Button';
import { formatDate } from '../../utils/formatters';

export default function MoveCard({ move, onInterest, userRole }) {
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

      {userRole === 'BADDIE' && (
        <Button variant="gold" className="w-full" onClick={() => onInterest(move.id)}>
          I&apos;m Interested
        </Button>
      )}
    </div>
  );
}
