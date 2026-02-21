import { useState, useEffect } from 'react';
import { Clock, Shirt, Music, Navigation, Check } from 'lucide-react';
import Avatar from '../ui/Avatar';
import Button from '../ui/Button';
import api from '../../services/api';

function getTimeLeft(date) {
  const diff = new Date(date).getTime() - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, passed: true };
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return { days, hours, minutes, passed: false };
}

export default function MoveCountdown({ move, currentUserId, onUpdate }) {
  const [timeLeft, setTimeLeft] = useState(() => getTimeLeft(move.date));
  const [dressCode, setDressCode] = useState(move.dressCode || '');
  const [playlistLink, setPlaylistLink] = useState(move.playlistLink || '');
  const [saving, setSaving] = useState(false);

  const isStepper = move.stepperId === currentUserId;
  const otherPerson = isStepper ? move.selectedBaddie : move.stepper;
  const myOnMyWay = isStepper ? move.stepperOnMyWay : move.baddieOnMyWay;
  const theirOnMyWay = isStepper ? move.baddieOnMyWay : move.stepperOnMyWay;

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(getTimeLeft(move.date));
    }, 60000);
    return () => clearInterval(interval);
  }, [move.date]);

  const handleSavePlanning = async () => {
    setSaving(true);
    try {
      const { data } = await api.put(`/moves/${move.id}/planning`, { dressCode, playlistLink });
      onUpdate?.(data);
    } catch (err) {
      console.error('Save planning error:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleOnMyWay = async () => {
    try {
      const { data } = await api.put(`/moves/${move.id}/planning`, { onMyWay: true });
      onUpdate?.(data);
    } catch (err) {
      console.error('On my way error:', err);
    }
  };

  return (
    <div className="card-elevated border border-gold/20">
      {/* Countdown */}
      <div className="flex items-center gap-2 mb-4">
        <Clock size={18} className="text-gold" />
        <span className="text-sm font-semibold text-gold">
          {timeLeft.passed ? 'Move time!' : `${timeLeft.days}d ${timeLeft.hours}h ${timeLeft.minutes}m`}
        </span>
      </div>

      {/* Title & Details */}
      <h3 className="text-lg font-bold text-white mb-1">{move.title}</h3>
      <p className="text-gray-400 text-sm mb-4">{move.location}</p>

      {/* Other person */}
      <div className="flex items-center gap-3 p-3 bg-dark-100 rounded-xl mb-4">
        <Avatar src={otherPerson?.profile?.photos} name={otherPerson?.profile?.displayName} size="sm" />
        <div className="flex-1">
          <p className="text-white font-semibold text-sm">{otherPerson?.profile?.displayName}</p>
          <p className="text-gray-500 text-xs">{isStepper ? 'Your date' : 'The Stepper'}</p>
        </div>
        {theirOnMyWay && (
          <span className="flex items-center gap-1 px-2.5 py-1 bg-green-500/20 text-green-400 rounded-full text-xs font-semibold">
            <Navigation size={12} /> On the way
          </span>
        )}
      </div>

      {/* Planning Fields */}
      <div className="space-y-3 mb-4">
        <div>
          <label className="flex items-center gap-1.5 text-xs text-gray-400 mb-1">
            <Shirt size={12} /> Dress Code
          </label>
          <input
            type="text"
            value={dressCode}
            onChange={(e) => setDressCode(e.target.value)}
            placeholder="e.g. Smart casual, all black"
            className="w-full bg-dark-100 text-white text-sm rounded-lg px-3 py-2 border border-dark-50 focus:border-gold/50 outline-none"
          />
        </div>
        <div>
          <label className="flex items-center gap-1.5 text-xs text-gray-400 mb-1">
            <Music size={12} /> Playlist Link
          </label>
          <input
            type="url"
            value={playlistLink}
            onChange={(e) => setPlaylistLink(e.target.value)}
            placeholder="Spotify or Apple Music link"
            className="w-full bg-dark-100 text-white text-sm rounded-lg px-3 py-2 border border-dark-50 focus:border-gold/50 outline-none"
          />
        </div>
        <Button variant="outline" className="w-full text-sm" onClick={handleSavePlanning} loading={saving}>
          Save Details
        </Button>
      </div>

      {/* On My Way */}
      {!myOnMyWay ? (
        <Button variant="gold" className="w-full" onClick={handleOnMyWay}>
          <Navigation size={16} className="inline mr-2" /> I&apos;m On My Way
        </Button>
      ) : (
        <Button variant="outline" className="w-full opacity-70 cursor-default" disabled>
          <Check size={16} className="inline mr-2 text-green-400" /> On My Way
        </Button>
      )}
    </div>
  );
}
