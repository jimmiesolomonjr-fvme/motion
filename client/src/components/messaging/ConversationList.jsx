import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import Avatar from '../ui/Avatar';
import { isOnline, timeAgo } from '../../utils/formatters';
import { Mic, Trash2 } from 'lucide-react';

function SwipeableConversation({ conv, onDelete }) {
  const x = useMotionValue(0);
  const deleteOpacity = useTransform(x, [-100, -60], [1, 0]);
  const [swiped, setSwiped] = useState(false);

  const handleDragEnd = (_, info) => {
    if (info.offset.x < -60) {
      animate(x, -80);
      setSwiped(true);
    } else {
      animate(x, 0);
      setSwiped(false);
    }
  };

  const handleDelete = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onDelete(conv.id);
  };

  const handleTap = () => {
    if (swiped) {
      animate(x, 0);
      setSwiped(false);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Delete button behind */}
      <motion.div
        style={{ opacity: deleteOpacity }}
        className="absolute right-0 top-0 bottom-0 flex items-center justify-center w-20 bg-red-500 rounded-r-xl"
      >
        <button onClick={handleDelete} className="p-2 text-white">
          <Trash2 size={20} />
        </button>
      </motion.div>

      {/* Swipeable conversation item */}
      <motion.div
        style={{ x }}
        drag="x"
        dragConstraints={{ left: -80, right: 0 }}
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
        onTap={handleTap}
        className="relative bg-dark z-10"
      >
        <Link
          to={swiped ? '#' : `/chat/${conv.id}`}
          onClick={(e) => { if (swiped) e.preventDefault(); }}
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
      </motion.div>
    </div>
  );
}

export default function ConversationList({ conversations, onDelete }) {
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
        onDelete ? (
          <SwipeableConversation key={conv.id} conv={conv} onDelete={onDelete} />
        ) : (
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
        )
      ))}
    </div>
  );
}
