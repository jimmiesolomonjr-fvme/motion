import { Link } from 'react-router-dom';
import Avatar from '../ui/Avatar';
import { isOnline, timeAgo } from '../../utils/formatters';
import { Mic } from 'lucide-react';

export default function ConversationList({ conversations }) {
  if (conversations.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-400 text-lg mb-2">No conversations yet</p>
        <p className="text-gray-500 text-sm">Match with someone to start chatting</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {conversations.map((conv) => (
        <Link
          key={conv.id}
          to={`/chat/${conv.id}`}
          className="flex items-center gap-3 p-3 rounded-xl hover:bg-dark-50 transition-colors"
        >
          <Avatar
            src={conv.otherUser.profile?.photos}
            name={conv.otherUser.profile?.displayName}
            online={isOnline(conv.otherUser.lastOnline)}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-white text-sm truncate">
                {conv.otherUser.profile?.displayName}
              </h3>
              <span className="text-xs text-gray-500 flex-shrink-0">
                {timeAgo(conv.lastMessageAt)}
              </span>
            </div>
            <p className="text-sm text-gray-400 truncate">
              {conv.lastMessage?.contentType === 'VOICE' ? (
                <span className="flex items-center gap-1"><Mic size={12} /> Voice note</span>
              ) : (
                conv.lastMessage?.content || 'Start a conversation'
              )}
            </p>
          </div>
          {conv.lastMessage && !conv.lastMessage.read && conv.lastMessage.senderId !== 'me' && (
            <span className="w-2.5 h-2.5 bg-gold rounded-full flex-shrink-0" />
          )}
        </Link>
      ))}
    </div>
  );
}
