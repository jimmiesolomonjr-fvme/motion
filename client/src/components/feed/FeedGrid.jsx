import { Link } from 'react-router-dom';
import { Users } from 'lucide-react';
import ProfileCard from './ProfileCard';

export default function FeedGrid({ users, onLike, onUnlike, hasMore, loadingMore, sentinelRef, onOpenFilters }) {
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
    <>
      <div className="grid grid-cols-2 gap-3">
        {users.map((user) => (
          <ProfileCard key={user.id} user={user} onLike={onLike} onUnlike={onUnlike} />
        ))}
      </div>
      <div ref={sentinelRef} className="h-1" />
      {loadingMore && (
        <div className="flex justify-center py-4">
          <div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </>
  );
}
