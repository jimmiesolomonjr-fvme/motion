import { useState, useEffect } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import AppLayout from '../components/layout/AppLayout';
import ConversationList from '../components/messaging/ConversationList';
import api from '../services/api';
import { useSocket, useNotifications } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import Avatar from '../components/ui/Avatar';
import { Link } from 'react-router-dom';
import { Sparkles, Trash2, X } from 'lucide-react';
import Modal from '../components/ui/Modal';

function SwipeableInterest({ interest, onStartConversation, onDismiss }) {
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
    e.stopPropagation();
    onDismiss(interest.id);
  };

  const handleTap = () => {
    if (swiped) {
      animate(x, 0);
      setSwiped(false);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-xl">
      <motion.div
        style={{ opacity: deleteOpacity }}
        className="absolute right-0 top-0 bottom-0 flex items-center justify-center w-20 bg-red-500 rounded-r-xl"
      >
        <button onClick={handleDelete} className="p-2 text-white">
          <Trash2 size={20} />
        </button>
      </motion.div>

      <motion.div
        style={{ x }}
        drag="x"
        dragConstraints={{ left: -80, right: 0 }}
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
        onTap={handleTap}
        className="relative bg-dark z-10"
      >
        <button
          onClick={() => { if (!swiped) onStartConversation(interest.baddie.id); }}
          className="w-full flex items-center gap-3 p-3 rounded-xl bg-dark-50 hover:bg-dark-100 transition-colors text-left"
        >
          <Avatar src={interest.baddie.profile?.photos} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{interest.baddie.profile?.displayName}</p>
            <p className="text-xs text-gray-500 truncate">{interest.moveTitle}</p>
          </div>
          <span className="text-xs text-gold">Chat</span>
        </button>
      </motion.div>
    </div>
  );
}

export default function Messages() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [matches, setMatches] = useState([]);
  const [moveInterests, setMoveInterests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unmatchTarget, setUnmatchTarget] = useState(null);
  const socket = useSocket();
  const { setUnreadCount } = useNotifications();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const promises = [
          api.get('/messages/conversations'),
          api.get('/likes/matches'),
        ];
        if (user?.role === 'STEPPER') {
          promises.push(api.get('/moves/interests'));
        }
        const results = await Promise.all(promises);
        setConversations(results[0].data);
        setMatches(results[1].data);
        if (results[2]) setMoveInterests(results[2].data);
        // Clear unread badge when viewing messages
        setUnreadCount(0);
      } catch (err) {
        console.error('Messages error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (!socket) return;
    const handleNotification = () => {
      api.get('/messages/conversations').then(({ data }) => setConversations(data));
    };
    socket.on('message-notification', handleNotification);
    return () => socket.off('message-notification', handleNotification);
  }, [socket]);

  const handleDeleteConversation = async (convId) => {
    try {
      await api.delete(`/messages/conversations/${convId}`);
      setConversations((prev) => prev.filter((c) => c.id !== convId));
    } catch (err) {
      console.error('Delete conversation error:', err);
    }
  };

  const startConversation = async (userId) => {
    try {
      const { data } = await api.post(`/messages/start/${userId}`);
      window.location.href = `/chat/${data.id}`;
    } catch (err) {
      console.error('Start conversation error:', err);
    }
  };

  const dismissInterest = async (interestId) => {
    try {
      await api.delete(`/moves/interests/${interestId}`);
      setMoveInterests((prev) => prev.filter((i) => i.id !== interestId));
    } catch (err) {
      console.error('Dismiss interest error:', err);
    }
  };

  const handleUnmatch = async () => {
    if (!unmatchTarget) return;
    try {
      await api.delete(`/likes/unmatch/${unmatchTarget.id}`);
      setMatches((prev) => prev.filter((m) => m.user.id !== unmatchTarget.id));
    } catch (err) {
      console.error('Unmatch error:', err);
    }
    setUnmatchTarget(null);
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  // Filter matches that don't have conversations yet
  const conversationUserIds = conversations.flatMap((c) => [c.otherUser?.id]);
  const newMatches = matches.filter((m) => !conversationUserIds.includes(m.user.id));

  return (
    <AppLayout>
      <h1 className="text-xl font-bold text-white mb-4">Messages</h1>

      {/* New Matches Row */}
      {newMatches.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-gray-400 mb-3">New Matches</h2>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {newMatches.map((match) => (
              <div key={match.matchId} className="flex flex-col items-center gap-1 flex-shrink-0 relative">
                <button
                  onClick={() => startConversation(match.user.id)}
                >
                  <div className="relative">
                    <Avatar src={match.user.profile?.photos} size="lg" />
                    <div className="absolute inset-0 rounded-full border-2 border-gold" />
                  </div>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setUnmatchTarget(match.user); }}
                  className="absolute -top-1 -right-1 w-5 h-5 bg-dark-100 border border-dark-50 rounded-full flex items-center justify-center text-gray-400 hover:text-red-400 hover:border-red-400/50 transition-colors z-10"
                >
                  <X size={10} />
                </button>
                <span className="text-xs text-gray-300 max-w-[64px] truncate">{match.user.profile?.displayName}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Move Interests (Steppers only) */}
      {moveInterests.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-1.5">
            <Sparkles size={14} className="text-gold" /> Interested in Your Moves
          </h2>
          <div className="space-y-2">
            {moveInterests.map((interest) => (
              <SwipeableInterest
                key={interest.id}
                interest={interest}
                onStartConversation={startConversation}
                onDismiss={dismissInterest}
              />
            ))}
          </div>
        </div>
      )}

      <ConversationList conversations={conversations} onDelete={handleDeleteConversation} />

      <Modal isOpen={!!unmatchTarget} onClose={() => setUnmatchTarget(null)} title="Remove Match">
        <p className="text-sm text-gray-400 mb-4">
          Remove <span className="text-white font-medium">{unmatchTarget?.profile?.displayName}</span> from your matches? This cannot be undone.
        </p>
        <div className="flex gap-3">
          <button onClick={() => setUnmatchTarget(null)} className="flex-1 px-4 py-2.5 bg-dark-100 text-white rounded-xl font-semibold text-sm hover:bg-dark-50 transition-colors">
            Cancel
          </button>
          <button onClick={handleUnmatch} className="flex-1 px-4 py-2.5 bg-red-500 text-white rounded-xl font-semibold text-sm hover:bg-red-600 transition-colors">
            Remove
          </button>
        </div>
      </Modal>
    </AppLayout>
  );
}
