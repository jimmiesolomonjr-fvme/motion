export default function FeedFilters({ sort, setSort, onlineOnly, setOnlineOnly }) {
  const sortOptions = [
    { value: 'newest', label: 'Newest' },
    { value: 'distance', label: 'Nearest' },
    { value: 'vibe', label: 'Best Vibe' },
  ];

  return (
    <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
      {sortOptions.map((opt) => (
        <button
          key={opt.value}
          onClick={() => setSort(opt.value)}
          className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
            sort === opt.value
              ? 'bg-gold text-dark'
              : 'bg-dark-50 text-gray-400 hover:text-white'
          }`}
        >
          {opt.label}
        </button>
      ))}
      <button
        onClick={() => setOnlineOnly(!onlineOnly)}
        className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
          onlineOnly
            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
            : 'bg-dark-50 text-gray-400 hover:text-white'
        }`}
      >
        Online
      </button>
    </div>
  );
}
