import { Link } from 'react-router-dom';
import { Bell, Settings } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function Header() {
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-40 glass border-b border-dark-50" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/feed" className="text-xl font-extrabold text-gradient-gold tracking-tight">
          Motion
        </Link>
        <div className="flex items-center gap-3">
          <Link to="/settings" className="text-gray-400 hover:text-white transition-colors">
            <Settings size={20} />
          </Link>
        </div>
      </div>
    </header>
  );
}
