import { useEffect, useRef, useState, useCallback } from 'react';

let googleScriptLoaded = false;
let googleScriptLoading = false;
let googleScriptFailed = false;
const loadCallbacks = [];

function loadGoogleMaps() {
  const apiKey = import.meta.env.VITE_GOOGLE_PLACES_API_KEY;
  if (!apiKey || googleScriptFailed) return Promise.resolve(false);
  if (googleScriptLoaded && window.google?.maps?.places) return Promise.resolve(true);
  if (googleScriptLoading) {
    return new Promise((resolve) => loadCallbacks.push(resolve));
  }

  googleScriptLoading = true;
  return new Promise((resolve) => {
    loadCallbacks.push(resolve);
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.onload = () => {
      googleScriptLoaded = true;
      googleScriptLoading = false;
      const ok = !!window.google?.maps?.places;
      if (!ok) googleScriptFailed = true;
      loadCallbacks.forEach((cb) => cb(ok));
      loadCallbacks.length = 0;
    };
    script.onerror = () => {
      googleScriptLoading = false;
      googleScriptFailed = true;
      loadCallbacks.forEach((cb) => cb(false));
      loadCallbacks.length = 0;
    };
    document.head.appendChild(script);
  });
}

export default function LocationAutocomplete({ label, value, onChange, placeholder, name, className = '', ...props }) {
  const inputRef = useRef(null);
  const autocompleteRef = useRef(null);
  const skipNextChange = useRef(false);

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps().then((loaded) => {
      if (cancelled || !loaded || !inputRef.current || autocompleteRef.current) return;
      try {
        const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
          types: ['(cities)'],
          fields: ['formatted_address', 'name'],
        });

        autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace();
          if (!place) return;
          const val = place.formatted_address || place.name || '';
          if (val) {
            skipNextChange.current = true;
            onChange({ target: { name, value: val } });
          }
        });

        autocompleteRef.current = autocomplete;
      } catch {
        // Google Places failed to initialize — input works as plain text
      }
    });
    return () => { cancelled = true; };
  }, []);

  const handleChange = useCallback((e) => {
    if (skipNextChange.current) {
      skipNextChange.current = false;
      return;
    }
    onChange(e);
  }, [onChange]);

  return (
    <div className={className}>
      {label && <label className="block text-sm font-medium text-gray-300 mb-1.5">{label}</label>}
      <input
        ref={inputRef}
        name={name}
        value={value || ''}
        onChange={handleChange}
        placeholder={placeholder}
        className="input-field"
        autoComplete="off"
        {...props}
      />
    </div>
  );
}
