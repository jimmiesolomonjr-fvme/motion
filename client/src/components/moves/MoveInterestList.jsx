import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import Avatar from '../ui/Avatar';
import Button from '../ui/Button';
import { timeAgo } from '../../utils/formatters';

export default function MoveInterestList({ interests, onStartConversation }) {
  const [expanded, setExpanded] = useState(false);

  if (interests.length === 0) {
    return <p className="text-gray-500 text-sm text-center py-4">No interest yet</p>;
  }

  const visible = expanded ? interests : interests.slice(0, 3);
  const hiddenCount = interests.length - 3;

  return (
    <div className="space-y-3">
      {visible.map((interest) => (
        <div key={interest.id} className="flex items-center gap-3 p-3 bg-dark-100 rounded-xl">
          <Avatar src={interest.baddie.profile?.photos} name={interest.baddie.profile?.displayName} size="sm" />
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-white text-sm">{interest.baddie.profile?.displayName}</h4>
            {interest.message && <p className="text-gray-400 text-xs truncate">{interest.message}</p>}
            <span className="text-gray-500 text-xs">{timeAgo(interest.createdAt)}</span>
          </div>
          <Button variant="gold" className="text-xs !px-3 !py-1.5" onClick={() => onStartConversation(interest.baddie.id)}>
            Chat
          </Button>
        </div>
      ))}
      {hiddenCount > 0 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-center gap-1 py-2 text-sm text-gold hover:text-gold/80 transition-colors"
        >
          {expanded ? (
            <><ChevronUp size={16} /> Show less</>
          ) : (
            <><ChevronDown size={16} /> Show {hiddenCount} more interested</>
          )}
        </button>
      )}
    </div>
  );
}
