import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import { useNotifications } from '../context/SocketContext';
import api from '../services/api';
import { Eye, Heart, Sparkles, CheckCheck, UserCircle, Download, Gift, MapPin } from 'lucide-react';

const isStandalone = window.matchMedia('(display-mode: standalone)').matches
  || window.navigator.standalone === true;

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const { setNotifCount } = useNotifications();
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/notifications').then(({ data }) => {
      // Filter out install_app notifications in standalone mode
      const filtered = isStandalone
        ? data.filter((n) => n.type !== 'install_app')
        : data;
      setNotifications(filtered);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const markAllRead = async () => {
    try {
      await api.put('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, readAt: new Date().toISOString() })));
      setNotifCount(0);
    } catch {}
  };

  const handleClick = async (notif) => {
    if (!notif.readAt) {
      await api.put(`/notifications/${notif.id}/read`).catch(() => {});
      setNotifications((prev) => prev.map((n) => n.id === notif.id ? { ...n, readAt: new Date().toISOString() } : n));
      setNotifCount((prev) => Math.max(0, prev - 1));
    }
    if (notif.type === 'profile_view' && notif.data?.viewerId) {
      navigate(`/profile/${notif.data.viewerId}`);
    } else if (notif.type === 'match') {
      navigate('/messages');
    } else if (notif.type === 'profile_incomplete') {
      navigate('/profile');
    } else if (notif.type === 'vibe_available') {
      navigate('/vibe');
    } else if (notif.type === 'move_interest' || notif.type === 'move_selected') {
      navigate('/moves');
    } else if (notif.type === 'story_reply' && notif.data?.conversationId) {
      navigate(`/chat/${notif.data.conversationId}`);
    } else if (notif.type === 'new_version') {
      navigate('/');
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case 'profile_view': return <Eye className="text-purple-glow" size={18} />;
      case 'match': return <Heart className="text-gold" size={18} fill="currentColor" />;
      case 'profile_incomplete': return <UserCircle className="text-gold" size={18} />;
      case 'vibe_available': return <Sparkles className="text-purple-400" size={18} />;
      case 'install_app': return <Download className="text-gold" size={18} />;
      case 'new_version': return <Gift className="text-gold" size={18} />;
      case 'move_interest': return <MapPin className="text-green-400" size={18} />;
      case 'move_selected': return <MapPin className="text-gold" size={18} />;
      default: return <Sparkles className="text-gold" size={18} />;
    }
  };

  const timeAgo = (date) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-white">Notifications</h1>
        {notifications.some((n) => !n.readAt) && (
          <button onClick={markAllRead} className="text-xs text-gold flex items-center gap-1">
            <CheckCheck size={14} /> Mark all read
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-500">No notifications yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((notif) => (
            <div
              key={notif.id}
              onClick={() => handleClick(notif)}
              className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${
                notif.readAt ? 'bg-dark-100/50' : 'bg-dark-100 border border-gold/10'
              }`}
            >
              <div className="w-9 h-9 rounded-full bg-dark-50 flex items-center justify-center flex-shrink-0">
                {getIcon(notif.type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm ${notif.readAt ? 'text-gray-400' : 'text-white font-medium'}`}>{notif.body}</p>
                <p className="text-xs text-gray-600 mt-0.5">{timeAgo(notif.createdAt)}</p>
              </div>
              {!notif.readAt && (
                <div className="w-2 h-2 rounded-full bg-gold flex-shrink-0" />
              )}
            </div>
          ))}
        </div>
      )}
    </AppLayout>
  );
}
