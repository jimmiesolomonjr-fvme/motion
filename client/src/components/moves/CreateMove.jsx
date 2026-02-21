import { useState, useRef } from 'react';
import { Camera, X } from 'lucide-react';
import Input, { Textarea } from '../ui/Input';
import LocationAutocomplete from '../ui/LocationAutocomplete';
import Button from '../ui/Button';
import api from '../../services/api';

const CATEGORIES = [
  { value: 'DINNER', label: 'Dinner' },
  { value: 'DRINKS', label: 'Drinks' },
  { value: 'ADVENTURE', label: 'Adventure' },
  { value: 'GROUP', label: 'Group' },
  { value: 'CONCERT', label: 'Concert' },
  { value: 'OTHER', label: 'Other' },
];

export default function CreateMove({ onCreated, onClose }) {
  const [form, setForm] = useState({ title: '', description: '', date: '', location: '', maxInterest: 10, category: '' });
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef();

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const removePhoto = () => {
    setPhoto(null);
    setPhotoPreview(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('title', form.title);
      formData.append('description', form.description);
      formData.append('date', new Date(form.date).toISOString());
      formData.append('location', form.location);
      formData.append('maxInterest', form.maxInterest);
      if (form.category) formData.append('category', form.category);
      if (photo) formData.append('photo', photo);

      const { data } = await api.post('/moves', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onCreated(data);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create Move');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Photo Upload */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1.5">Venue Photo (optional)</label>
        {photoPreview ? (
          <div className="relative rounded-xl overflow-hidden">
            <img src={photoPreview} alt="Preview" className="w-full h-40 object-cover" />
            <button
              type="button"
              onClick={removePhoto}
              className="absolute top-2 right-2 w-7 h-7 bg-black/70 hover:bg-red-500 rounded-full flex items-center justify-center transition-colors"
            >
              <X className="text-white" size={14} />
            </button>
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center h-28 bg-dark-100 border-2 border-dashed border-dark-50 hover:border-gold/40 rounded-xl cursor-pointer transition-colors">
            <Camera className="text-gray-500 mb-1" size={24} />
            <span className="text-xs text-gray-500">Add a photo</span>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} />
          </label>
        )}
      </div>

      <Input label="Title" name="title" value={form.title} onChange={handleChange} placeholder='e.g. "Dinner at Nobu Saturday"' required />
      <Textarea label="Description" name="description" value={form.description} onChange={handleChange} placeholder="Set the vibe — what's the plan?" required />

      {/* Category Chips */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1.5">Category (optional)</label>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              type="button"
              onClick={() => setForm({ ...form, category: form.category === cat.value ? '' : cat.value })}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                form.category === cat.value
                  ? 'bg-gold text-dark'
                  : 'bg-dark-50 text-gray-400 hover:text-white'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      <Input label="Date & Time" name="date" type="datetime-local" value={form.date} onChange={handleChange} required />
      <LocationAutocomplete label="Location" name="location" value={form.location} onChange={handleChange} placeholder="e.g. Nobu Atlanta" required />
      <Input label="Max Interest" name="maxInterest" type="number" min="1" max="50" value={form.maxInterest} onChange={handleChange} />

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <div className="flex gap-3">
        <Button variant="outline" type="button" className="flex-1" onClick={onClose}>Cancel</Button>
        <Button variant="gold" type="submit" className="flex-1" loading={loading}>Post Move</Button>
      </div>
    </form>
  );
}
