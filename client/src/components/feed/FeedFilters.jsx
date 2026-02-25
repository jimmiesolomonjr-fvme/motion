import { useState } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { LOOKING_FOR_TAGS } from '../../utils/constants';

export default function FeedFilters({ sort, setSort, ageRange, maxDistance, selectedTags, onApply }) {
  const [showOverlay, setShowOverlay] = useState(false);
  const [pendingAge, setPendingAge] = useState(ageRange);
  const [pendingDistance, setPendingDistance] = useState(maxDistance);
  const [pendingTags, setPendingTags] = useState(selectedTags || []);

  const sortOptions = [
    { value: 'active', label: 'Recently Active' },
    { value: 'newest', label: 'Newest' },
    { value: 'distance', label: 'Nearest' },
    { value: 'vibe', label: 'Best Vibe' },
  ];

  const hasActiveFilters = ageRange[0] !== 18 || ageRange[1] !== 99 || maxDistance !== 100 || (selectedTags && selectedTags.length > 0);

  const openOverlay = () => {
    setPendingAge(ageRange);
    setPendingDistance(maxDistance);
    setPendingTags(selectedTags || []);
    setShowOverlay(true);
  };

  const handleApply = () => {
    onApply({ ageRange: pendingAge, maxDistance: pendingDistance, tags: pendingTags });
    setShowOverlay(false);
  };

  const handleClear = () => {
    setPendingAge([18, 99]);
    setPendingDistance(100);
    setPendingTags([]);
    onApply({ ageRange: [18, 99], maxDistance: 100, tags: [] });
    setShowOverlay(false);
  };

  const toggleTag = (tag) => {
    setPendingTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
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
          onClick={openOverlay}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
            hasActiveFilters
              ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
              : 'bg-dark-50 text-gray-400 hover:text-white'
          }`}
        >
          <SlidersHorizontal size={14} /> Filters
        </button>
      </div>

      {/* Full-screen filter overlay */}
      {showOverlay && (
        <div className="fixed inset-0 z-50 bg-dark flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-4 border-b border-dark-50">
            <h2 className="text-lg font-bold text-white">Filters</h2>
            <button
              onClick={() => setShowOverlay(false)}
              className="p-2 text-gray-400 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto px-4 py-6 space-y-8">
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

            {/* Looking For Tags */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">
                Looking For {pendingTags.length > 0 && <span className="text-gold">({pendingTags.length})</span>}
              </label>
              <div className="flex flex-wrap gap-2">
                {LOOKING_FOR_TAGS.map((tag) => {
                  const isSelected = pendingTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                        isSelected
                          ? 'bg-gold text-dark'
                          : 'bg-dark-50 text-gray-400 border border-dark-100 hover:text-white'
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Sticky bottom bar */}
          <div className="px-4 py-4 border-t border-dark-50 flex items-center gap-4">
            <button
              onClick={handleClear}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Clear All
            </button>
            <button
              onClick={handleApply}
              className="flex-1 btn-gold py-3 text-sm font-bold"
            >
              View Results
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
