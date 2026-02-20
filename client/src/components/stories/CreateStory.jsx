import { useState, useRef } from 'react';
import { X, Camera } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import api from '../../services/api';

export default function CreateStory({ isOpen, onClose, onCreated }) {
  const [preview, setPreview] = useState(null);
  const [file, setFile] = useState(null);
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target.result);
    reader.readAsDataURL(f);
  };

  const handleSubmit = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('photo', file);
      if (caption.trim()) formData.append('caption', caption.trim());
      await api.post('/stories', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onCreated?.();
      handleClose();
    } catch (err) {
      console.error('Create story error:', err);
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    setPreview(null);
    setFile(null);
    setCaption('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="New Story">
      <div className="space-y-4">
        {preview ? (
          <div className="relative">
            <img src={preview} alt="Preview" className="w-full aspect-[3/4] object-cover rounded-xl" />
            <button
              onClick={() => { setPreview(null); setFile(null); }}
              className="absolute top-2 right-2 w-8 h-8 bg-black/70 rounded-full flex items-center justify-center"
            >
              <X className="text-white" size={16} />
            </button>
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center w-full aspect-[3/4] bg-dark-100 border-2 border-dashed border-dark-50 hover:border-gold/40 rounded-xl cursor-pointer transition-colors">
            <Camera className="text-gray-500 mb-2" size={32} />
            <span className="text-sm text-gray-500">Tap to select a photo</span>
            <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
          </label>
        )}
        {preview && (
          <>
            <input
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Add a caption (optional)..."
              className="w-full input-field py-2.5"
              maxLength={200}
            />
            <Button variant="gold" className="w-full" onClick={handleSubmit} disabled={uploading}>
              {uploading ? 'Sharing...' : 'Share Story'}
            </Button>
          </>
        )}
      </div>
    </Modal>
  );
}
