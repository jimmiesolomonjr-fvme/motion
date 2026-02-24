import { useState } from 'react';
import { ChevronDown, ChevronUp, Check, UserCheck, Users } from 'lucide-react';
import Avatar from '../ui/Avatar';
import Button from '../ui/Button';
import { timeAgo } from '../../utils/formatters';

export default function MoveInterestList({ interests, onStartConversation, onSelect, onSelectGroup, moveStatus, selectedBaddieId, moveCategory }) {
  const [expanded, setExpanded] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());

  if (interests.length === 0) {
    return <p className="text-gray-500 text-sm text-center py-4">No interest yet</p>;
  }

  const visible = expanded ? interests : interests.slice(0, 3);
  const hiddenCount = interests.length - 3;

  const isGroupOpen = moveCategory === 'GROUP' && moveStatus === 'OPEN';

  const toggleGroupSelect = (baddieId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(baddieId)) {
        next.delete(baddieId);
      } else {
        next.add(baddieId);
      }
      return next;
    });
  };

  return (
    <div className="space-y-3">
      {visible.map((interest) => {
        const isSelected = selectedBaddieId === interest.baddie.id;
        const isGroupChecked = selectedIds.has(interest.baddie.id);
        return (
          <div
            key={interest.id}
            className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
              isSelected
                ? 'bg-green-500/10 border border-green-500/30'
                : isGroupChecked
                  ? 'bg-gold/10 border border-gold/30'
                  : 'bg-dark-100'
            }`}
          >
            {isGroupOpen && (
              <button
                type="button"
                onClick={() => toggleGroupSelect(interest.baddie.id)}
                className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                  isGroupChecked
                    ? 'bg-gold border-gold'
                    : 'border-gray-500 hover:border-gold/60'
                }`}
              >
                {isGroupChecked && <Check size={12} className="text-dark" />}
              </button>
            )}
            <div className="relative">
              <Avatar src={interest.baddie.profile?.photos} name={interest.baddie.profile?.displayName} size="sm" />
              {isSelected && (
                <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                  <Check size={10} className="text-white" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-white text-sm">
                {interest.baddie.profile?.displayName}
                {isSelected && <span className="text-green-400 text-xs ml-1.5">Selected</span>}
              </h4>
              {interest.message && <p className="text-gray-400 text-xs truncate">{interest.message}</p>}
              {interest.counterProposal && (
                <p className="text-amber-400 text-xs italic mt-0.5 truncate">
                  Counter: {interest.counterProposal}
                </p>
              )}
              <span className="text-gray-500 text-xs">{timeAgo(interest.createdAt)}</span>
            </div>
            <div className="flex items-center gap-2">
              {!isGroupOpen && moveStatus === 'OPEN' && onSelect && !selectedBaddieId && (
                <Button
                  variant="outline"
                  className="text-xs !px-2.5 !py-1.5 border-gold/30 text-gold hover:bg-gold hover:text-dark"
                  onClick={() => onSelect(interest.baddie.id, interest.baddie.profile?.displayName)}
                >
                  <UserCheck size={14} className="mr-1" /> Select
                </Button>
              )}
              <Button variant="gold" className="text-xs !px-3 !py-1.5" onClick={() => onStartConversation(interest.baddie.id)}>
                Chat
              </Button>
            </div>
          </div>
        );
      })}
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
      {isGroupOpen && selectedIds.size > 0 && onSelectGroup && (
        <Button
          variant="gold"
          className="w-full"
          onClick={() => onSelectGroup([...selectedIds])}
        >
          <Users size={16} className="inline mr-2" />
          Confirm Selected ({selectedIds.size})
        </Button>
      )}
    </div>
  );
}
