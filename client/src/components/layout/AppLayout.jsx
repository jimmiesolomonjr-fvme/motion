import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from './Header';
import BottomNav from './BottomNav';
import { useNotifications } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { Heart, X, Sparkles, Eye, Flame, AlertTriangle, Star, Users } from 'lucide-react';
import { optimizeCloudinaryUrl } from '../../utils/cloudinaryUrl';
import UpdateBanner from '../ui/UpdateBanner';
import InstallBanner from '../ui/InstallBanner';

export default function AppLayout({ children }) {
  const { toasts, dismissToast, viewingPulse } = useNotifications();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [vibeBanner, setVibeBanner] = useState(false);
  const [vibeDismissed, setVibeDismissed] = useState(false);
  const [statusBanner, setStatusBanner] = useState(null);
  const [statusDismissed, setStatusDismissed] = useState(false);

  useEffect(() => {
    if (statusDismissed) return;
    api.get('/auth/status-banner').then(({ data }) => {
      if (data.message) setStatusBanner(data.message);
      else setStatusBanner(null);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!user || vibeDismissed) return;
    // Check if dismissed this session
    if (sessionStorage.getItem('vibeBannerDismissed')) return;
    api.get('/vibe/questions').then(({ data }) => {
      if (data.remaining > 0 && data.questions?.length > 0) {
        setVibeBanner(true);
      }
    }).catch(() => {});
  }, [user]);

  const dismissVibeBanner = () => {
    setVibeBanner(false);
    setVibeDismissed(true);
    sessionStorage.setItem('vibeBannerDismissed', 'true');
  };

  const getToastIcon = (type) => {
    switch (type) {
      case 'match': return <Heart className="text-gold" size={20} fill="currentColor" />;
      case 'profile_view': return <Eye className="text-purple-glow" size={20} />;
      case 'smf_pick': return <Flame className="text-orange-400" size={20} />;
      case 'new_user_priority': return <Star className="text-green-400" size={20} />;
      case 'community_move_paired': return <Users className="text-purple-400" size={20} />;
      case 'community_move_confirmed': return <Heart className="text-green-400" size={20} fill="currentColor" />;
      default: return <Sparkles className="text-gold" size={20} />;
    }
  };

  const handleToastClick = (toast) => {
    dismissToast(toast.id);
    if (toast.type === 'profile_view' && toast.data?.viewerId) {
      navigate(`/profile/${toast.data.viewerId}`);
    } else if (toast.type === 'smf_pick') {
      if (toast.data?.pickerId) navigate(`/profile/${toast.data.pickerId}`);
    } else if (toast.type === 'match') {
      navigate('/messages');
    } else if (toast.type === 'new_user_priority' && toast.data?.targetUserId) {
      navigate(`/profile/${toast.data.targetUserId}`);
    } else if (toast.type === 'community_move_paired') {
      navigate('/moves', { state: { tab: 'picks' } });
    } else if (toast.type === 'community_move_confirmed' && toast.data?.conversationId) {
      navigate(`/chat/${toast.data.conversationId}`);
    }
  };

  return (
    <div className="min-h-screen bg-dark">
      <UpdateBanner />
      <Header />

      {/* Status / maintenance banner */}
      {statusBanner && !statusDismissed && (
        <div className="max-w-lg mx-auto px-4 pt-2">
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="text-amber-400" size={18} />
            </div>
            <p className="flex-1 text-sm text-amber-200">{statusBanner}</p>
            <button
              onClick={() => setStatusDismissed(true)}
              className="text-gray-500 hover:text-white flex-shrink-0"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Vibe questions renewal banner */}
      {vibeBanner && (
        <div className="max-w-lg mx-auto px-4 pt-2">
          <div
            className="bg-gradient-to-r from-purple-500/20 to-gold/20 border border-gold/30 rounded-2xl p-3 flex items-center gap-3 cursor-pointer"
            onClick={() => { dismissVibeBanner(); navigate('/vibe'); }}
          >
            <div className="w-9 h-9 rounded-full bg-gold/20 flex items-center justify-center flex-shrink-0">
              <Sparkles className="text-gold" size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">New Vibe Questions Available!</p>
              <p className="text-xs text-gray-400">Tap to answer and boost your vibe scores</p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); dismissVibeBanner(); }}
              className="text-gray-500 hover:text-white flex-shrink-0"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* PWA install prompt banner — yields to vibe banner */}
      <InstallBanner vibeShowing={vibeBanner} />

      <main className="max-w-lg mx-auto px-4 pb-20 pt-4">
        {children}
      </main>
      <BottomNav />

      {/* Live "viewing you" pulse */}
      {viewingPulse && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 max-w-sm w-full px-4">
          <div
            className="bg-dark-100 border border-purple-accent/40 rounded-2xl p-3 shadow-xl flex items-center gap-3 cursor-pointer animate-fade-in"
            onClick={() => viewingPulse.viewerId && navigate(`/profile/${viewingPulse.viewerId}`)}
            style={{ boxShadow: '0 0 20px rgba(147, 51, 234, 0.3)' }}
          >
            <div className="relative flex-shrink-0">
              {viewingPulse.viewerPhoto ? (
                <img src={optimizeCloudinaryUrl(viewingPulse.viewerPhoto, { width: 80, crop: 'fill' })} alt="" className="w-10 h-10 rounded-full object-cover ring-2 ring-purple-400 animate-pulse" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-purple-accent/20 flex items-center justify-center ring-2 ring-purple-400 animate-pulse">
                  <Eye size={18} className="text-purple-400" />
                </div>
              )}
              <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-dark-100" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white">{viewingPulse.viewerName} is viewing you</p>
              <p className="text-xs text-purple-400">Right now 👀</p>
            </div>
          </div>
        </div>
      )}

      {/* Stacked notification toasts */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-sm w-full px-4 flex flex-col gap-2">
        {toasts.map((toast, i) => (
          <div
            key={toast.id}
            className="bg-dark-100 border border-gold/30 rounded-2xl p-4 shadow-xl flex items-center gap-3 cursor-pointer animate-fade-in"
            onClick={() => handleToastClick(toast)}
          >
            <div className="w-10 h-10 rounded-full bg-gold/20 flex items-center justify-center flex-shrink-0">
              {getToastIcon(toast.type)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white">{toast.title}</p>
              <p className="text-xs text-gray-400 truncate">{toast.body}</p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); dismissToast(toast.id); }}
              className="text-gray-500 hover:text-white flex-shrink-0"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
