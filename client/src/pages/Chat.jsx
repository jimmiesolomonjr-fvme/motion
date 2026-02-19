import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ChatView from '../components/messaging/ChatView';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export default function Chat() {
  const { conversationId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [otherUser, setOtherUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchConversation = async () => {
      try {
        const { data: conversations } = await api.get('/messages/conversations');
        const conv = conversations.find((c) => c.id === conversationId);
        if (!conv) {
          navigate('/messages');
          return;
        }
        setOtherUser(conv.otherUser);
      } catch {
        navigate('/messages');
      } finally {
        setLoading(false);
      }
    };
    fetchConversation();
  }, [conversationId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-dark flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark">
      <div className="sticky top-0 z-40 glass border-b border-dark-50 h-0" />
      <ChatView conversationId={conversationId} otherUser={otherUser} />
    </div>
  );
}
