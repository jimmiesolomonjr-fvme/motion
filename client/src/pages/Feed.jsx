import { useState, useEffect } from 'react';
import AppLayout from '../components/layout/AppLayout';
import FeedGrid from '../components/feed/FeedGrid';
import FeedFilters from '../components/feed/FeedFilters';
import { useGeolocation } from '../hooks/useGeolocation';
import api from '../services/api';
import Modal from '../components/ui/Modal';
import { Heart } from 'lucide-react';

export default function Feed() {
  const [users, setUsers] = useState([]);
  const [sort, setSort] = useState('newest');
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [matchModal, setMatchModal] = useState(null);

  useGeolocation();

  const fetchFeed = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/users/feed', {
        params: { sort, onlineOnly: onlineOnly.toString() },
      });
      setUsers(data);
    } catch (err) {
      console.error('Feed error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchFeed(); }, [sort, onlineOnly]);

  const handleLike = async (userId) => {
    try {
      const { data } = await api.post(`/likes/${userId}`);
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, hasLiked: true } : u));

      if (data.matched) {
        const matched = users.find((u) => u.id === userId);
        setMatchModal(matched);
      }
    } catch (err) {
      console.error('Like error:', err);
    }
  };

  return (
    <AppLayout>
      <FeedFilters sort={sort} setSort={setSort} onlineOnly={onlineOnly} setOnlineOnly={setOnlineOnly} />

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <FeedGrid users={users} onLike={handleLike} />
      )}

      {/* Match Modal */}
      <Modal isOpen={!!matchModal} onClose={() => setMatchModal(null)} title="">
        <div className="text-center py-4">
          <div className="w-16 h-16 rounded-full bg-gold/20 flex items-center justify-center mx-auto mb-4">
            <Heart className="text-gold" size={32} fill="currentColor" />
          </div>
          <h3 className="text-2xl font-bold text-white mb-2">It&apos;s a Match!</h3>
          <p className="text-gray-400 mb-6">
            You and <span className="text-gold font-semibold">{matchModal?.profile?.displayName}</span> liked each other
          </p>
          <button onClick={() => setMatchModal(null)} className="btn-gold w-full">
            Keep Browsing
          </button>
        </div>
      </Modal>
    </AppLayout>
  );
}
