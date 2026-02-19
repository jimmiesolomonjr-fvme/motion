import { useState, useEffect } from 'react';
import AppLayout from '../components/layout/AppLayout';
import ConversationList from '../components/messaging/ConversationList';
import api from '../services/api';
import { useSocket, useNotifications } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import Avatar from '../components/ui/Avatar';
import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';

export default function Messages() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [matches, setMatches] = useState([]);
  const [moveInterests, setMoveInterests] = useState([]);
  const [loading, setLoading] = useState(true);
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

  const startConversation = async (userId) => {
    try {
      const { data } = await api.post(`/messages/start/${userId}`);
      window.location.href = `/chat/${data.id}`;
    } catch (err) {
      console.error('Start conversation error:', err);
    }
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
              <button
                key={match.matchId}
                onClick={() => startConversation(match.user.id)}
                className="flex flex-col items-center gap-1 flex-shrink-0"
              >
                <div className="relative">
                  <Avatar src={match.user.profile?.photos} size="lg" />
                  <div className="absolute inset-0 rounded-full border-2 border-gold" />
                </div>
                <span className="text-xs text-gray-300 max-w-[64px] truncate">{match.user.profile?.displayName}</span>
              </button>
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
              <button
                key={interest.id}
                onClick={() => startConversation(interest.baddie.id)}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-dark-50 hover:bg-dark-100 transition-colors text-left"
              >
                <Avatar src={interest.baddie.profile?.photos} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{interest.baddie.profile?.displayName}</p>
                  <p className="text-xs text-gray-500 truncate">{interest.moveTitle}</p>
                </div>
                <span className="text-xs text-gold">Chat</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <ConversationList conversations={conversations} />
    </AppLayout>
  );
}
