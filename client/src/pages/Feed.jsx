import { useState, useEffect, useRef, useCallback } from 'react';
import AppLayout from '../components/layout/AppLayout';
import FeedGrid from '../components/feed/FeedGrid';
import FeedFilters from '../components/feed/FeedFilters';
import { useGeolocation } from '../hooks/useGeolocation';
import api from '../services/api';
import Modal from '../components/ui/Modal';
import { Heart } from 'lucide-react';
import StoryBar from '../components/stories/StoryBar';

export default function Feed() {
  const [users, setUsers] = useState([]);
  const [sort, setSort] = useState('newest');
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [ageRange, setAgeRange] = useState([18, 99]);
  const [maxDistance, setMaxDistance] = useState(100);
  const [loading, setLoading] = useState(true);
  const [matchModal, setMatchModal] = useState(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef(null);

  useGeolocation();

  const fetchFeed = useCallback(async (pageNum) => {
    if (pageNum === 0) setLoading(true);
    else setLoadingMore(true);
    try {
      const params = { sort, onlineOnly: onlineOnly.toString(), page: pageNum };
      if (ageRange[0] !== 18) params.minAge = ageRange[0];
      if (ageRange[1] !== 99) params.maxAge = ageRange[1];
      if (maxDistance < 100) params.maxDistance = maxDistance;

      const { data } = await api.get('/users/feed', { params });
      if (pageNum === 0) {
        setUsers(data.users);
      } else {
        setUsers((prev) => [...prev, ...data.users]);
      }
      setHasMore(data.hasMore);
    } catch (err) {
      console.error('Feed error:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [sort, onlineOnly, ageRange, maxDistance]);

  // Reset to page 0 when filters change
  useEffect(() => {
    setPage(0);
    fetchFeed(0);
  }, [sort, onlineOnly, ageRange[0], ageRange[1], maxDistance]);

  // Fetch next page when page increments beyond 0
  useEffect(() => {
    if (page > 0) fetchFeed(page);
  }, [page]);

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !loadingMore && !loading) {
          setPage((prev) => prev + 1);
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loading]);

  const handleApplyFilters = ({ ageRange: newAge, maxDistance: newDist }) => {
    setAgeRange(newAge);
    setMaxDistance(newDist);
  };

  const handleUnlike = async (userId) => {
    try {
      await api.delete(`/likes/${userId}`);
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, hasLiked: false } : u));
    } catch (err) {
      console.error('Unlike error:', err);
    }
  };

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
      <StoryBar />
      <FeedFilters
        sort={sort} setSort={setSort}
        onlineOnly={onlineOnly} setOnlineOnly={setOnlineOnly}
        ageRange={ageRange} maxDistance={maxDistance}
        onApply={handleApplyFilters}
      />

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <FeedGrid users={users} onLike={handleLike} onUnlike={handleUnlike} hasMore={hasMore} loadingMore={loadingMore} sentinelRef={sentinelRef} />
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
