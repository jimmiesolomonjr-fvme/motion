import { useState, useEffect } from 'react';
import AppLayout from '../components/layout/AppLayout';
import ConversationList from '../components/messaging/ConversationList';
import api from '../services/api';
import { useSocket } from '../context/SocketContext';
import Avatar from '../components/ui/Avatar';
import { Link } from 'react-router-dom';

export default function Messages() {
  const [conversations, setConversations] = useState([]);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const socket = useSocket();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [convRes, matchRes] = await Promise.all([
          api.get('/messages/conversations'),
          api.get('/likes/matches'),
        ]);
        setConversations(convRes.data);
        setMatches(matchRes.data);
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

      <ConversationList conversations={conversations} />
    </AppLayout>
  );
}
