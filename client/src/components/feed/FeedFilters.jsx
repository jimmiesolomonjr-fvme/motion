import { useState } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';

export default function FeedFilters({ sort, setSort, onlineOnly, setOnlineOnly, ageRange, maxDistance, onApply }) {
  const [showFilters, setShowFilters] = useState(false);
  const [pendingAge, setPendingAge] = useState(ageRange);
  const [pendingDistance, setPendingDistance] = useState(maxDistance);

  const sortOptions = [
    { value: 'newest', label: 'Newest' },
    { value: 'distance', label: 'Nearest' },
    { value: 'vibe', label: 'Best Vibe' },
  ];

  const hasActiveFilters = ageRange[0] !== 18 || ageRange[1] !== 99 || maxDistance !== 100;
  const hasPendingChanges =
    pendingAge[0] !== ageRange[0] || pendingAge[1] !== ageRange[1] || pendingDistance !== maxDistance;

  const handleApply = () => {
    onApply({ ageRange: pendingAge, maxDistance: pendingDistance });
  };

  const handleClear = () => {
    setPendingAge([18, 99]);
    setPendingDistance(100);
    onApply({ ageRange: [18, 99], maxDistance: 100 });
  };

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
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
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
            hasActiveFilters
              ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
              : 'bg-dark-50 text-gray-400 hover:text-white'
          }`}
        >
          <SlidersHorizontal size={14} /> Filters
        </button>
      </div>

      {showFilters && (
        <div className="mt-3 p-4 bg-dark-50 rounded-xl space-y-5">
          {/* Age Range */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Age: {pendingAge[0]} – {pendingAge[1]}
            </label>
            <div className="relative h-6">
              <input
                type="range"
                min={18}
                max={99}
                value={pendingAge[0]}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  if (val <= pendingAge[1]) setPendingAge([val, pendingAge[1]]);
                }}
                className="absolute inset-0 w-full appearance-none bg-transparent pointer-events-none
                           [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none
                           [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full
                           [&::-webkit-slider-thumb]:bg-gold [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:relative [&::-webkit-slider-thumb]:z-10"
              />
              <input
                type="range"
                min={18}
                max={99}
                value={pendingAge[1]}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  if (val >= pendingAge[0]) setPendingAge([pendingAge[0], val]);
                }}
                className="absolute inset-0 w-full appearance-none bg-transparent pointer-events-none
                           [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none
                           [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full
                           [&::-webkit-slider-thumb]:bg-gold [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:relative [&::-webkit-slider-thumb]:z-10"
              />
              {/* Track background */}
              <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-1 bg-dark-100 rounded-full" />
              <div
                className="absolute top-1/2 -translate-y-1/2 h-1 bg-gold/50 rounded-full"
                style={{
                  left: `${((pendingAge[0] - 18) / 81) * 100}%`,
                  right: `${100 - ((pendingAge[1] - 18) / 81) * 100}%`,
                }}
              />
            </div>
          </div>

          {/* Distance */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Distance: {pendingDistance >= 100 ? 'No limit' : `${pendingDistance} mi`}
            </label>
            <input
              type="range"
              min={10}
              max={100}
              step={10}
              value={pendingDistance}
              onChange={(e) => setPendingDistance(parseInt(e.target.value))}
              className="w-full appearance-none h-1 bg-dark-100 rounded-full
                         [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
                         [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gold [&::-webkit-slider-thumb]:cursor-pointer"
            />
          </div>

          {/* Apply / Clear */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleApply}
              disabled={!hasPendingChanges}
              className="btn-gold px-6 py-2 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Apply Filters
            </button>
            {hasActiveFilters && (
              <button
                onClick={handleClear}
                className="flex items-center gap-1.5 text-sm text-red-400 hover:text-red-300 transition-colors"
              >
                <X size={14} /> Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
