import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from './Header';
import BottomNav from './BottomNav';
import { useNotifications } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { Heart, X, Sparkles, Eye } from 'lucide-react';

export default function AppLayout({ children }) {
  const { toasts, dismissToast } = useNotifications();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [vibeBanner, setVibeBanner] = useState(false);
  const [vibeDismissed, setVibeDismissed] = useState(false);

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
      default: return <Sparkles className="text-gold" size={20} />;
    }
  };

  const handleToastClick = (toast) => {
    dismissToast(toast.id);
    if (toast.type === 'profile_view' && toast.data?.viewerId) {
      navigate(`/profile/${toast.data.viewerId}`);
    } else if (toast.type === 'match') {
      navigate('/messages');
    }
  };

  return (
    <div className="min-h-screen bg-dark">
      <Header />

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

      <main className="max-w-lg mx-auto px-4 pb-20 pt-4">
        {children}
      </main>
      <BottomNav />

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
