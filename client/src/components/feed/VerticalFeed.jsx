import { useRef, useEffect, useState, useCallback } from 'react';
import VerticalCard from './VerticalCard';

export default function VerticalFeed({ users, onLike, onUnlike, hasMore, loadingMore, onLoadMore }) {
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
      <div className="text-center py-16">
        <p className="text-gray-400 text-lg mb-2">No one here yet</p>
        <p className="text-gray-500 text-sm">Check back soon — the vibe is building</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="overflow-y-auto snap-y snap-mandatory -mx-4"
      style={{ height: 'calc(100dvh - 10rem)' }}
    >
      {users.map((user, i) => (
        <div key={user.id} data-index={i}>
          <VerticalCard
            user={user}
            onLike={onLike}
            onUnlike={onUnlike}
            isVisible={i === visibleIndex}
          />
        </div>
      ))}
      {loadingMore && (
        <div className="h-20 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
