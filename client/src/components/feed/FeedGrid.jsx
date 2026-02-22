import ProfileCard from './ProfileCard';

export default function FeedGrid({ users, onLike, onUnlike, hasMore, loadingMore, sentinelRef }) {
  if (users.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-400 text-lg mb-2">No one here yet</p>
        <p className="text-gray-500 text-sm">Check back soon — the vibe is building</p>
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
