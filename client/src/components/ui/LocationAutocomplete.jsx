import { useEffect, useRef, useState } from 'react';

let googleScriptLoaded = false;
let googleScriptLoading = false;
const loadCallbacks = [];

function loadGoogleMaps() {
  const apiKey = import.meta.env.VITE_GOOGLE_PLACES_API_KEY;
  if (!apiKey) return Promise.resolve(false);
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
      loadCallbacks.forEach((cb) => cb(true));
      loadCallbacks.length = 0;
    };
    script.onerror = () => {
      googleScriptLoading = false;
      loadCallbacks.forEach((cb) => cb(false));
      loadCallbacks.length = 0;
    };
    document.head.appendChild(script);
  });
}

export default function LocationAutocomplete({ label, value, onChange, placeholder, name, className = '', ...props }) {
  const inputRef = useRef(null);
  const autocompleteRef = useRef(null);
  const [ready, setReady] = useState(!!window.google?.maps?.places);

  useEffect(() => {
    loadGoogleMaps().then((loaded) => {
      if (loaded) setReady(true);
    });
  }, []);

  useEffect(() => {
    if (!ready || !inputRef.current || autocompleteRef.current) return;

    const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
      types: ['(cities)'],
      fields: ['formatted_address', 'name'],
    });

    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      const val = place.formatted_address || place.name || inputRef.current.value;
      onChange({ target: { name, value: val } });
    });

    autocompleteRef.current = autocomplete;
  }, [ready]);

  const handleChange = (e) => {
    onChange(e);
  };

  return (
    <div className={className}>
      {label && <label className="block text-sm font-medium text-gray-300 mb-1.5">{label}</label>}
      <input
        ref={inputRef}
        name={name}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        className="input-field"
        autoComplete="off"
        {...props}
      />
    </div>
  );
}
