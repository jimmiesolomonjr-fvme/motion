import { NavLink } from 'react-router-dom';
import { Users, MessageCircle, Sparkles, Flame, User, Bell } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/SocketContext';

export default function BottomNav() {
  const { user } = useAuth();
  const { unreadCount, notifCount } = useNotifications();

  const navItems = [
    { to: '/feed', icon: Users, label: 'Feed' },
    { to: '/moves', icon: Flame, label: 'Moves' },
    { to: '/vibe', icon: Sparkles, label: 'Vibe' },
    { to: '/messages', icon: MessageCircle, label: 'Chat', badge: unreadCount },
    { to: '/notifications', icon: Bell, label: 'Alerts', badge: notifCount },
    { to: '/profile', icon: User, label: 'Profile' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 glass border-t border-dark-50 safe-area-bottom">
      <div className="max-w-lg mx-auto px-2 h-16 flex items-center justify-around">
        {navItems.map(({ to, icon: Icon, label, badge }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition-colors ${
                isActive ? 'text-gold' : 'text-gray-500 hover:text-gray-300'
              }`
            }
          >
            <div className="relative">
              <Icon size={20} />
              {badge > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {badge > 9 ? '9+' : badge}
                </span>
              )}
            </div>
            <span className="text-[10px] font-medium">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
