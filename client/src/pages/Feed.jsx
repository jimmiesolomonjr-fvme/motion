import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import AppLayout from '../components/layout/AppLayout';
import FeedGrid from '../components/feed/FeedGrid';
import FeedFilters from '../components/feed/FeedFilters';
import VerticalFeed from '../components/feed/VerticalFeed';
import { useGeolocation } from '../hooks/useGeolocation';
import api from '../services/api';
import Modal from '../components/ui/Modal';
import Avatar from '../components/ui/Avatar';
import { Heart, LayoutGrid, Rows3, SlidersHorizontal, MessageCircle } from 'lucide-react';
import StoryBar from '../components/stories/StoryBar';
import { FeedSkeleton } from '../components/ui/Skeleton';
import { haptic } from '../utils/haptics';

export default function Feed() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [sort, setSort] = useState('active');
  const [ageRange, setAgeRange] = useState([18, 99]);
  const [maxDistance, setMaxDistance] = useState(100);
  const [selectedTags, setSelectedTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [matchModal, setMatchModal] = useState(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef(null);
  const [viewMode, setViewMode] = useState('vertical');
  const [showFilters, setShowFilters] = useState(false);

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
      const params = { sort, page: pageNum };
      if (ageRange[0] !== 18) params.minAge = ageRange[0];
      if (ageRange[1] !== 99) params.maxAge = ageRange[1];
      if (maxDistance < 100) params.maxDistance = maxDistance;
      if (selectedTags.length > 0) params.tags = selectedTags.join(',');

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
  }, [sort, ageRange, maxDistance, selectedTags]);

  const fetchVerticalFeed = useCallback(async (pageNum) => {
    if (pageNum === 0) setVerticalLoading(true);
    else setVerticalLoadingMore(true);
    try {
      const params = { sort, page: pageNum, limit: 5 };
      if (ageRange[0] !== 18) params.minAge = ageRange[0];
      if (ageRange[1] !== 99) params.maxAge = ageRange[1];
      if (maxDistance < 100) params.maxDistance = maxDistance;
      if (selectedTags.length > 0) params.tags = selectedTags.join(',');

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
  }, [sort, ageRange, maxDistance, selectedTags]);

  // Reset to page 0 when filters change
  useEffect(() => {
    setPage(0);
    setVerticalPage(0);
    if (viewMode === 'grid') {
      fetchFeed(0);
    } else {
      fetchVerticalFeed(0);
    }
  }, [sort, ageRange[0], ageRange[1], maxDistance, selectedTags]);

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

  const handleApplyFilters = ({ ageRange: newAge, maxDistance: newDist, tags: newTags }) => {
    setAgeRange(newAge);
    setMaxDistance(newDist);
    if (newTags !== undefined) setSelectedTags(newTags);
  };

  const handleUnlike = async (userId) => {
    // Optimistic update
    haptic();
    setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, hasLiked: false } : u));
    setVerticalUsers((prev) => prev.map((u) => u.id === userId ? { ...u, hasLiked: false } : u));
    try {
      await api.delete(`/likes/${userId}`);
    } catch (err) {
      // Rollback
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, hasLiked: true } : u));
      setVerticalUsers((prev) => prev.map((u) => u.id === userId ? { ...u, hasLiked: true } : u));
      console.error('Unlike error:', err);
    }
  };

  const handleLike = async (userId) => {
    // Optimistic update
    haptic();
    setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, hasLiked: true } : u));
    setVerticalUsers((prev) => prev.map((u) => u.id === userId ? { ...u, hasLiked: true } : u));
    try {
      const { data } = await api.post(`/likes/${userId}`);
      if (data.matched) {
        haptic(200);
        const matched = users.find((u) => u.id === userId) || verticalUsers.find((u) => u.id === userId);
        setMatchModal(matched);
      }
    } catch (err) {
      // Rollback
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, hasLiked: false } : u));
      setVerticalUsers((prev) => prev.map((u) => u.id === userId ? { ...u, hasLiked: false } : u));
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
      {viewMode === 'grid' && <StoryBar />}
      <FeedFilters
        sort={sort} setSort={setSort}
        ageRange={ageRange} maxDistance={maxDistance}
        selectedTags={selectedTags}
        onApply={handleApplyFilters}
        externalOpen={showFilters}
        onExternalClose={() => setShowFilters(false)}
      />

      {isLoading ? (
        <FeedSkeleton mode={viewMode} />
      ) : viewMode === 'grid' ? (
        <FeedGrid users={users} onLike={handleLike} onUnlike={handleUnlike} hasMore={hasMore} loadingMore={loadingMore} sentinelRef={sentinelRef} onOpenFilters={() => setShowFilters(true)} />
      ) : (
        <VerticalFeed
          users={verticalUsers}
          onLike={handleLike}
          onUnlike={handleUnlike}
          hasMore={verticalHasMore}
          loadingMore={verticalLoadingMore}
          onLoadMore={handleVerticalLoadMore}
          onOpenFilters={() => setShowFilters(true)}
        />
      )}

      {/* FAB — Filters */}
      <button
        onClick={() => setShowFilters(true)}
        className={`fixed bottom-[8.5rem] right-4 z-20 w-12 h-12 rounded-full shadow-lg flex items-center justify-center active:scale-95 transition-transform ${
          ageRange[0] !== 18 || ageRange[1] !== 99 || maxDistance !== 100 || selectedTags.length > 0
            ? 'bg-purple-500 text-white'
            : 'bg-dark-100 text-gray-300 border border-dark-50'
        }`}
      >
        <SlidersHorizontal size={20} />
      </button>

      {/* FAB — Grid/Vertical toggle */}
      <button
        onClick={() => setViewMode(viewMode === 'grid' ? 'vertical' : 'grid')}
        className="fixed bottom-24 right-4 z-20 w-12 h-12 rounded-full bg-gold text-dark shadow-lg flex items-center justify-center active:scale-95 transition-transform"
      >
        {viewMode === 'grid' ? <Rows3 size={22} /> : <LayoutGrid size={22} />}
      </button>

      {/* Match Modal */}
      <Modal isOpen={!!matchModal} onClose={() => setMatchModal(null)} title="">
        <div className="text-center py-4 relative overflow-hidden">
          {/* Confetti burst */}
          <AnimatePresence>
            {matchModal && (
              <div className="absolute inset-0 pointer-events-none">
                {Array.from({ length: 12 }).map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute w-2 h-2 rounded-full bg-gold"
                    initial={{
                      x: '50%',
                      y: '40%',
                      scale: 0,
                      opacity: 1,
                    }}
                    animate={{
                      x: `${50 + (Math.cos((i * 30) * Math.PI / 180) * 40)}%`,
                      y: `${40 + (Math.sin((i * 30) * Math.PI / 180) * 40)}%`,
                      scale: [0, 1.5, 0],
                      opacity: [1, 1, 0],
                    }}
                    transition={{ duration: 0.8, delay: i * 0.04, ease: 'easeOut' }}
                  />
                ))}
              </div>
            )}
          </AnimatePresence>

          <div className="w-20 h-20 rounded-full mx-auto mb-4 ring-4 ring-gold/30 overflow-hidden">
            <Avatar src={matchModal?.profile?.photos} name={matchModal?.profile?.displayName} size="xl" />
          </div>
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 15, delay: 0.1 }}
          >
            <Heart className="text-gold mx-auto mb-2" size={28} fill="currentColor" />
          </motion.div>
          <h3 className="text-2xl font-bold text-white mb-2">It&apos;s a Match!</h3>
          <p className="text-gray-400 mb-6">
            You and <span className="text-gold font-semibold">{matchModal?.profile?.displayName}</span> liked each other
          </p>
          <div className="flex gap-3">
            <button onClick={() => setMatchModal(null)} className="flex-1 px-4 py-2.5 bg-dark-100 text-white rounded-xl font-semibold text-sm hover:bg-dark-50 transition-colors">
              Keep Browsing
            </button>
            <button
              onClick={() => { setMatchModal(null); navigate('/messages'); }}
              className="flex-1 px-4 py-2.5 btn-gold rounded-xl font-semibold text-sm flex items-center justify-center gap-2"
            >
              <MessageCircle size={16} /> Send Message
            </button>
          </div>
        </div>
      </Modal>
    </AppLayout>
  );
}
