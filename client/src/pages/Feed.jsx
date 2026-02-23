import { useState, useEffect, useRef, useCallback } from 'react';
import AppLayout from '../components/layout/AppLayout';
import FeedGrid from '../components/feed/FeedGrid';
import FeedFilters from '../components/feed/FeedFilters';
import VerticalFeed from '../components/feed/VerticalFeed';
import { useGeolocation } from '../hooks/useGeolocation';
import api from '../services/api';
import Modal from '../components/ui/Modal';
import { Heart, LayoutGrid, Rows3 } from 'lucide-react';
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
  const [viewMode, setViewMode] = useState('grid');

  // Vertical feed state (separate from grid)
  const [verticalUsers, setVerticalUsers] = useState([]);
  const [verticalPage, setVerticalPage] = useState(0);
  const [verticalHasMore, setVerticalHasMore] = useState(false);
  const [verticalLoading, setVerticalLoading] = useState(false);
  const [verticalLoadingMore, setVerticalLoadingMore] = useState(false);

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

  const fetchVerticalFeed = useCallback(async (pageNum) => {
    if (pageNum === 0) setVerticalLoading(true);
    else setVerticalLoadingMore(true);
    try {
      const params = { sort, onlineOnly: onlineOnly.toString(), page: pageNum, limit: 5 };
      if (ageRange[0] !== 18) params.minAge = ageRange[0];
      if (ageRange[1] !== 99) params.maxAge = ageRange[1];
      if (maxDistance < 100) params.maxDistance = maxDistance;

      const { data } = await api.get('/users/feed/vertical', { params });
      if (pageNum === 0) {
        setVerticalUsers(data.users);
      } else {
        setVerticalUsers((prev) => [...prev, ...data.users]);
      }
      setVerticalHasMore(data.hasMore);
    } catch (err) {
      console.error('Vertical feed error:', err);
    } finally {
      setVerticalLoading(false);
      setVerticalLoadingMore(false);
    }
  }, [sort, onlineOnly, ageRange, maxDistance]);

  // Reset to page 0 when filters change
  useEffect(() => {
    setPage(0);
    setVerticalPage(0);
    if (viewMode === 'grid') {
      fetchFeed(0);
    } else {
      fetchVerticalFeed(0);
    }
  }, [sort, onlineOnly, ageRange[0], ageRange[1], maxDistance]);

  // Fetch when switching view modes
  useEffect(() => {
    if (viewMode === 'grid' && users.length === 0) {
      setPage(0);
      fetchFeed(0);
    } else if (viewMode === 'vertical' && verticalUsers.length === 0) {
      setVerticalPage(0);
      fetchVerticalFeed(0);
    }
  }, [viewMode]);

  // Fetch next page when page increments beyond 0
  useEffect(() => {
    if (page > 0) fetchFeed(page);
  }, [page]);

  useEffect(() => {
    if (verticalPage > 0) fetchVerticalFeed(verticalPage);
  }, [verticalPage]);

  // IntersectionObserver for grid infinite scroll
  useEffect(() => {
    if (viewMode !== 'grid') return;
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
  }, [hasMore, loadingMore, loading, viewMode]);

  const handleApplyFilters = ({ ageRange: newAge, maxDistance: newDist }) => {
    setAgeRange(newAge);
    setMaxDistance(newDist);
  };

  const handleUnlike = async (userId) => {
    try {
      await api.delete(`/likes/${userId}`);
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, hasLiked: false } : u));
      setVerticalUsers((prev) => prev.map((u) => u.id === userId ? { ...u, hasLiked: false } : u));
    } catch (err) {
      console.error('Unlike error:', err);
    }
  };

  const handleLike = async (userId) => {
    try {
      const { data } = await api.post(`/likes/${userId}`);
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, hasLiked: true } : u));
      setVerticalUsers((prev) => prev.map((u) => u.id === userId ? { ...u, hasLiked: true } : u));

      if (data.matched) {
        const matched = users.find((u) => u.id === userId) || verticalUsers.find((u) => u.id === userId);
        setMatchModal(matched);
      }
    } catch (err) {
      console.error('Like error:', err);
    }
  };

  const handleVerticalLoadMore = useCallback(() => {
    if (verticalHasMore && !verticalLoadingMore) {
      setVerticalPage((prev) => prev + 1);
    }
  }, [verticalHasMore, verticalLoadingMore]);

  const isLoading = viewMode === 'grid' ? loading : verticalLoading;

  return (
    <AppLayout>
      <StoryBar />
      <FeedFilters
        sort={sort} setSort={setSort}
        onlineOnly={onlineOnly} setOnlineOnly={setOnlineOnly}
        ageRange={ageRange} maxDistance={maxDistance}
        onApply={handleApplyFilters}
      />

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
        </div>
      ) : viewMode === 'grid' ? (
        <FeedGrid users={users} onLike={handleLike} onUnlike={handleUnlike} hasMore={hasMore} loadingMore={loadingMore} sentinelRef={sentinelRef} />
      ) : (
        <VerticalFeed
          users={verticalUsers}
          onLike={handleLike}
          onUnlike={handleUnlike}
          hasMore={verticalHasMore}
          loadingMore={verticalLoadingMore}
          onLoadMore={handleVerticalLoadMore}
        />
      )}

      {/* FAB — Grid/Vertical toggle */}
      <button
        onClick={() => setViewMode(viewMode === 'grid' ? 'vertical' : 'grid')}
        className="fixed bottom-24 right-4 z-20 w-12 h-12 rounded-full bg-gold text-dark shadow-lg flex items-center justify-center active:scale-95 transition-transform"
      >
        {viewMode === 'grid' ? <Rows3 size={22} /> : <LayoutGrid size={22} />}
      </button>

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
