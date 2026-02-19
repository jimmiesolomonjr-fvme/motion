import Avatar from '../ui/Avatar';
import Button from '../ui/Button';
import { timeAgo } from '../../utils/formatters';

export default function MoveInterestList({ interests, onStartConversation }) {
  if (interests.length === 0) {
    return <p className="text-gray-500 text-sm text-center py-4">No interest yet</p>;
  }

  return (
    <div className="space-y-3">
      {interests.map((interest) => (
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
    </div>
  );
}
