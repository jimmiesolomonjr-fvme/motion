import Header from './Header';
import BottomNav from './BottomNav';
import { useNotifications } from '../../context/SocketContext';
import { Heart, X } from 'lucide-react';

export default function AppLayout({ children }) {
  const { matchAlert, clearMatchAlert } = useNotifications();

  return (
    <div className="min-h-screen bg-dark">
      <Header />
      <main className="max-w-lg mx-auto px-4 pb-20 pt-4">
        {children}
      </main>
      <BottomNav />

      {/* Match notification toast */}
      {matchAlert && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-sm w-full px-4">
          <div className="bg-dark-100 border border-gold/30 rounded-2xl p-4 shadow-xl flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gold/20 flex items-center justify-center flex-shrink-0">
              <Heart className="text-gold" size={20} fill="currentColor" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white">It's a Match!</p>
              <p className="text-xs text-gray-400 truncate">
                You and {matchAlert.user?.displayName} liked each other
              </p>
            </div>
            <button onClick={clearMatchAlert} className="text-gray-500 hover:text-white">
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
