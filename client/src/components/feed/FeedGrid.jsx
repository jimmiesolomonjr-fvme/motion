import ProfileCard from './ProfileCard';

export default function FeedGrid({ users, onLike, onUnlike }) {
  if (users.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-400 text-lg mb-2">No one here yet</p>
        <p className="text-gray-500 text-sm">Check back soon — the vibe is building</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {users.map((user) => (
        <ProfileCard key={user.id} user={user} onLike={onLike} onUnlike={onUnlike} />
      ))}
    </div>
  );
}
