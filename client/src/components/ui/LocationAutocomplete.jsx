import { useState, useEffect, useRef } from 'react';

export default function LocationAutocomplete({ label, value, onChange, placeholder, name, className = '', ...props }) {
  const [suggestions, setSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const timerRef = useRef(null);
  const wrapperRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const fetchSuggestions = (query) => {
    if (query.length < 2) { setSuggestions([]); return; }
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=5&featuretype=city`,
          { headers: { 'Accept-Language': 'en' } }
        );
        const data = await res.json();
        const cities = data
          .filter((d) => d.address && (d.address.city || d.address.town || d.address.village || d.type === 'city'))
          .map((d) => {
            const city = d.address.city || d.address.town || d.address.village || d.name;
            const state = d.address.state;
            const country = d.address.country_code?.toUpperCase();
            if (country === 'US' && state) return `${city}, ${state}`;
            if (state) return `${city}, ${state}, ${country}`;
            return `${city}, ${country || ''}`.replace(/, $/, '');
          })
          .filter((v, i, arr) => arr.indexOf(v) === i); // dedupe
        setSuggestions(cities);
        setShowDropdown(cities.length > 0);
      } catch {
        setSuggestions([]);
      }
    }, 300);
  };

  const handleChange = (e) => {
    onChange(e);
    fetchSuggestions(e.target.value);
  };

  const handleSelect = (city) => {
    onChange({ target: { name, value: city } });
    setSuggestions([]);
    setShowDropdown(false);
  };

  return (
    <div className={`relative ${className}`} ref={wrapperRef}>
      {label && <label className="block text-sm font-medium text-gray-300 mb-1.5">{label}</label>}
      <input
        name={name}
        value={value || ''}
        onChange={handleChange}
        onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
        placeholder={placeholder}
        className="input-field"
        autoComplete="off"
        {...props}
      />
      {showDropdown && suggestions.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-dark-100 border border-dark-50 rounded-xl overflow-hidden shadow-xl">
          {suggestions.map((city, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleSelect(city)}
              className="w-full text-left px-3 py-2.5 text-sm text-gray-200 hover:bg-dark-50 hover:text-white transition-colors"
            >
              {city}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
