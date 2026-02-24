import { useState, useRef, useEffect, useCallback } from 'react';
import { Search, Play, Pause, Music } from 'lucide-react';
import Modal from '../ui/Modal';
import api from '../../services/api';

export default function SongSearchModal({ isOpen, onClose, onSelect }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [playingIdx, setPlayingIdx] = useState(null);
  const audioRef = useRef(null);
  const debounceRef = useRef(null);

  const search = useCallback(async (term) => {
    if (!term || term.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.get(`/songs/search?term=${encodeURIComponent(term)}`);
      setResults(data);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleQueryChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 300);
  };

  const togglePreview = (idx) => {
    const track = results[idx];
    if (!track?.previewUrl) return;

    if (playingIdx === idx) {
      audioRef.current?.pause();
      setPlayingIdx(null);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = track.previewUrl;
      audioRef.current.play().catch(() => {});
    }
    setPlayingIdx(idx);
  };

  const handleSelect = (track) => {
    if (audioRef.current) audioRef.current.pause();
    setPlayingIdx(null);
    onSelect({
      songTitle: track.trackName,
      songArtist: track.artistName,
      songPreviewUrl: track.previewUrl,
      songArtworkUrl: track.artworkUrl,
    });
  };

  // Cleanup on close
  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setResults([]);
      setPlayingIdx(null);
      if (audioRef.current) audioRef.current.pause();
    }
  }, [isOpen]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Profile Song">
      <div className="space-y-3">
        {/* Search input */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={query}
            onChange={handleQueryChange}
            placeholder="Search songs or artists..."
            className="w-full bg-dark-100 text-white text-sm rounded-xl pl-9 pr-4 py-3 border border-dark-50 focus:border-purple-accent/50 outline-none"
            autoFocus
          />
        </div>

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto space-y-1">
          {loading && (
            <div className="flex justify-center py-6">
              <div className="w-6 h-6 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {!loading && results.length === 0 && query.length >= 2 && (
            <p className="text-center text-gray-500 text-sm py-6">No results found</p>
          )}

          {!loading && results.map((track, i) => (
            <div
              key={i}
              className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-dark-100 cursor-pointer transition-colors group"
              onClick={() => handleSelect(track)}
            >
              {/* Album art */}
              {track.artworkUrl ? (
                <img src={track.artworkUrl} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-dark-100 flex items-center justify-center flex-shrink-0">
                  <Music size={18} className="text-gray-600" />
                </div>
              )}

              {/* Track info */}
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{track.trackName}</p>
                <p className="text-gray-500 text-xs truncate">{track.artistName}</p>
              </div>

              {/* Preview button */}
              {track.previewUrl && (
                <button
                  onClick={(e) => { e.stopPropagation(); togglePreview(i); }}
                  className="w-9 h-9 bg-purple-accent/20 rounded-full flex items-center justify-center flex-shrink-0 hover:bg-purple-accent/30 transition-colors"
                >
                  {playingIdx === i
                    ? <Pause size={14} className="text-purple-400" />
                    : <Play size={14} className="text-purple-400 ml-0.5" />
                  }
                </button>
              )}
            </div>
          ))}
        </div>

        <audio ref={audioRef} preload="none" onEnded={() => setPlayingIdx(null)} />
      </div>
    </Modal>
  );
}
