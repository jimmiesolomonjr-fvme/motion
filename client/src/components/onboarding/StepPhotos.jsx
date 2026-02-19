import { useState } from 'react';
import { Plus, X, Image } from 'lucide-react';
import api from '../../services/api';

export default function StepPhotos({ onComplete }) {
  const [photos, setPhotos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files);
    if (photos.length + files.length > 6) {
      setError('Maximum 6 photos allowed');
      return;
    }

    setUploading(true);
    setError('');

    try {
      const formData = new FormData();
      files.forEach((f) => formData.append('photos', f));

      const { data } = await api.post('/users/photos', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setPhotos(data.photos || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = async (index) => {
    try {
      const { data } = await api.delete(`/users/photos/${index}`);
      setPhotos(data.photos || []);
    } catch {
      setError('Failed to remove photo');
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Add Photos</h2>
        <p className="text-gray-400">Add at least 1 photo (up to 6) to your profile</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {photos.map((photo, i) => (
          <div key={i} className="relative aspect-square rounded-xl overflow-hidden">
            <img src={photo} alt="" className="w-full h-full object-cover" />
            <button
              onClick={() => removePhoto(i)}
              className="absolute top-1 right-1 w-6 h-6 bg-black/70 rounded-full flex items-center justify-center"
            >
              <X size={14} />
            </button>
          </div>
        ))}

        {photos.length < 6 && (
          <label className="aspect-square rounded-xl border-2 border-dashed border-dark-50 flex flex-col items-center justify-center cursor-pointer hover:border-gold/40 transition-colors">
            <input type="file" accept="image/*" multiple onChange={handleFileSelect} className="hidden" />
            {uploading ? (
              <div className="animate-spin w-6 h-6 border-2 border-gold border-t-transparent rounded-full" />
            ) : (
              <>
                <Plus className="text-gray-500" size={24} />
                <span className="text-xs text-gray-500 mt-1">Add</span>
              </>
            )}
          </label>
        )}
      </div>

      {error && <p className="text-red-400 text-sm text-center">{error}</p>}

      <div className="space-y-3">
        <button
          onClick={onComplete}
          disabled={photos.length === 0}
          className="w-full btn-gold disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {photos.length > 0 ? "Let's Go" : 'Upload at least 1 photo'}
        </button>
        {photos.length === 0 && (
          <p className="text-center text-xs text-gray-400">
            A photo is required to complete your profile
          </p>
        )}
      </div>
    </div>
  );
}
