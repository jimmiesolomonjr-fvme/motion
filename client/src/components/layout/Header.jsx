import { Link, useLocation, useParams } from 'react-router-dom';
import { Bell, Settings } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/SocketContext';

export default function Header() {
  const { user } = useAuth();
  const { notifCount } = useNotifications();
  const location = useLocation();

  const isOwnProfile = location.pathname === '/profile';

  return (
    <header className="sticky top-0 z-40 glass border-b border-dark-50" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/feed" className="text-xl font-extrabold text-gradient-gold tracking-tight">
          Motion
        </Link>
        <div className="flex items-center gap-3">
          <Link to="/notifications" className="text-gray-400 hover:text-white transition-colors relative">
            <Bell size={20} />
            {notifCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {notifCount > 9 ? '9+' : notifCount}
              </span>
            )}
          </Link>
          {isOwnProfile && (
            <Link to="/settings" className="text-gray-400 hover:text-white transition-colors">
              <Settings size={20} />
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
