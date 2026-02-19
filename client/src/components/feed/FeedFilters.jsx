import { useState } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import LocationAutocomplete from '../ui/LocationAutocomplete';

export default function FeedFilters({ sort, setSort, onlineOnly, setOnlineOnly, ageRange, setAgeRange, city, setCity }) {
  const [showFilters, setShowFilters] = useState(false);

  const sortOptions = [
    { value: 'newest', label: 'Newest' },
    { value: 'distance', label: 'Nearest' },
    { value: 'vibe', label: 'Best Vibe' },
  ];

  const hasActiveFilters = ageRange[0] !== 18 || ageRange[1] !== 99 || city !== '';

  const clearFilters = () => {
    setAgeRange([18, 99]);
    setCity('');
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
        <div className="mt-3 p-4 bg-dark-50 rounded-xl space-y-4">
          {/* Age Range */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Age Range</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="18"
                max="99"
                value={ageRange[0]}
                onChange={(e) => setAgeRange([parseInt(e.target.value) || 18, ageRange[1]])}
                className="input-field w-20 text-center"
              />
              <span className="text-gray-500 text-sm">to</span>
              <input
                type="number"
                min="18"
                max="99"
                value={ageRange[1]}
                onChange={(e) => setAgeRange([ageRange[0], parseInt(e.target.value) || 99])}
                className="input-field w-20 text-center"
              />
            </div>
          </div>

          {/* City */}
          <LocationAutocomplete
            label="City"
            name="city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Filter by city..."
          />

          {/* Clear Filters */}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1.5 text-sm text-red-400 hover:text-red-300 transition-colors"
            >
              <X size={14} /> Clear Filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}
