import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

const TIME_OPTIONS = [
  { value: 'tonight', label: 'Tonight' },
  { value: 'weekend', label: 'This Weekend' },
  { value: 'week', label: 'This Week' },
];

const CATEGORY_OPTIONS = [
  { value: 'DINNER', label: 'Dinner' },
  { value: 'DRINKS', label: 'Drinks' },
  { value: 'ADVENTURE', label: 'Adventure' },
  { value: 'GROUP', label: 'Group' },
  { value: 'CONCERT', label: 'Concert' },
];

const SORT_OPTIONS = [
  { value: 'soonest', label: 'Soonest' },
  { value: 'newest', label: 'Newest' },
  { value: 'popular', label: 'Most Popular' },
];

export default function MoveFilters({ filters, onFilterChange }) {
  const [showSort, setShowSort] = useState(false);

  const toggleTime = (value) => {
    onFilterChange({ ...filters, time: filters.time === value ? null : value });
  };

  const toggleCategory = (value) => {
    onFilterChange({ ...filters, category: filters.category === value ? null : value });
  };

  const setSort = (value) => {
    onFilterChange({ ...filters, sort: value });
    setShowSort(false);
  };

  const currentSort = SORT_OPTIONS.find((s) => s.value === filters.sort) || SORT_OPTIONS[0];

  return (
    <div className="mb-4 space-y-2">
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {TIME_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => toggleTime(opt.value)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              filters.time === opt.value
                ? 'bg-gold text-dark'
                : 'bg-dark-50 text-gray-400 hover:text-white'
            }`}
          >
            {opt.label}
          </button>
        ))}

        <div className="w-px h-5 bg-dark-50 flex-shrink-0" />

        {CATEGORY_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => toggleCategory(opt.value)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              filters.category === opt.value
                ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                : 'bg-dark-50 text-gray-400 hover:text-white'
            }`}
          >
            {opt.label}
          </button>
        ))}

        <div className="w-px h-5 bg-dark-50 flex-shrink-0" />

        <div className="relative flex-shrink-0">
          <button
            onClick={() => setShowSort(!showSort)}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap bg-dark-50 text-gray-400 hover:text-white transition-colors"
          >
            {currentSort.label}
            <ChevronDown size={14} className={`transition-transform ${showSort ? 'rotate-180' : ''}`} />
          </button>
          {showSort && (
            <div className="absolute right-0 top-full mt-1 bg-dark-100 border border-dark-50 rounded-xl shadow-xl z-50 min-w-[140px]">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSort(opt.value)}
                  className={`w-full text-left px-4 py-2.5 text-sm transition-colors first:rounded-t-xl last:rounded-b-xl ${
                    filters.sort === opt.value ? 'text-gold bg-dark-50' : 'text-gray-300 hover:text-white hover:bg-dark-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
