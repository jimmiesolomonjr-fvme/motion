import { useRef, useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users } from 'lucide-react';
import VerticalCard from './VerticalCard';

export default function VerticalFeed({ users, onLike, onUnlike, hasMore, loadingMore, onLoadMore, onOpenFilters }) {
  const containerRef = useRef(null);
  const [visibleIndex, setVisibleIndex] = useState(0);

  // IntersectionObserver to track which card is visible
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const idx = parseInt(entry.target.dataset.index, 10);
            setVisibleIndex(idx);

            // Load more when reaching second-to-last card
            if (idx >= users.length - 2 && hasMore && !loadingMore) {
              onLoadMore?.();
            }
          }
        }
      },
      { root: container, threshold: 0.6 }
    );

    const cards = container.querySelectorAll('[data-index]');
    cards.forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, [users.length, hasMore, loadingMore, onLoadMore]);

  if (users.length === 0) {
    return (
      <div className="text-center py-16 flex flex-col items-center">
        <Users className="text-gray-600 mb-3" size={40} />
        <p className="text-gray-400 text-lg mb-2">No profiles match your filters</p>
        <p className="text-gray-500 text-sm mb-4">Try adjusting your filters or invite friends</p>
        <div className="flex gap-3">
          {onOpenFilters && (
            <button onClick={onOpenFilters} className="px-4 py-2 bg-gold text-dark rounded-xl font-semibold text-sm hover:bg-gold/90 transition-colors">
              Adjust Filters
            </button>
          )}
          <Link to="/settings" className="px-4 py-2 bg-dark-50 text-gray-300 rounded-xl font-semibold text-sm hover:bg-dark-100 transition-colors">
            Invite Friends
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="overflow-y-auto snap-y snap-mandatory"
      style={{ height: 'calc(100dvh - 10rem)' }}
    >
      {users.map((user, i) => (
        <motion.div
          key={user.id}
          data-index={i}
          animate={i === visibleIndex
            ? { opacity: 1, scale: 1, y: 0 }
            : { opacity: 0.6, scale: 0.95, y: 10 }
          }
          transition={{ type: 'spring', stiffness: 260, damping: 28 }}
        >
          <VerticalCard
            user={user}
            onLike={onLike}
            onUnlike={onUnlike}
            isVisible={i === visibleIndex}
          />
        </motion.div>
      ))}
      {loadingMore && (
        <div className="h-20 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
