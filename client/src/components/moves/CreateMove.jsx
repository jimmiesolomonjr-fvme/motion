import { useState } from 'react';
import Input, { Textarea } from '../ui/Input';
import LocationAutocomplete from '../ui/LocationAutocomplete';
import Button from '../ui/Button';
import api from '../../services/api';

export default function CreateMove({ onCreated, onClose }) {
  const [form, setForm] = useState({ title: '', description: '', date: '', location: '', maxInterest: 10 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data } = await api.post('/moves', form);
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
      <Input label="Title" name="title" value={form.title} onChange={handleChange} placeholder='e.g. "Dinner at Nobu Saturday"' required />
      <Textarea label="Description" name="description" value={form.description} onChange={handleChange} placeholder="Set the vibe — what's the plan?" required />
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
