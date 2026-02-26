import { useState, useRef } from 'react';
import { X, Camera } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import ImageCropper from '../ui/ImageCropper';
import api from '../../services/api';
import { getVideoDuration } from '../../utils/mediaUtils';

export default function CreateStory({ isOpen, onClose, onCreated }) {
  const [preview, setPreview] = useState(null);
  const [file, setFile] = useState(null);
  const [isVideo, setIsVideo] = useState(false);
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [trimNotice, setTrimNotice] = useState('');
  const [cropping, setCropping] = useState(false);
  const [rawPreview, setRawPreview] = useState(null);
  const inputRef = useRef(null);

  const handleFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const video = f.type.startsWith('video/');

    if (video) {
      // Skip cropping for videos
      setFile(f);
      setIsVideo(true);
      setPreview(URL.createObjectURL(f));
      setTrimNotice('');
      const duration = await getVideoDuration(f);
      if (duration > 15) {
        setTrimNotice('Video will be trimmed to 15 seconds');
      }
    } else {
      // Show cropper for images
      const url = URL.createObjectURL(f);
      setRawPreview(url);
      setCropping(true);
    }
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleCropComplete = (blob) => {
    if (rawPreview) URL.revokeObjectURL(rawPreview);
    setRawPreview(null);
    setCropping(false);
    const croppedFile = new File([blob], 'story.jpg', { type: 'image/jpeg' });
    setFile(croppedFile);
    setIsVideo(false);
    setPreview(URL.createObjectURL(blob));
  };

  const handleCropCancel = () => {
    if (rawPreview) URL.revokeObjectURL(rawPreview);
    setRawPreview(null);
    setCropping(false);
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
    if (preview) URL.revokeObjectURL(preview);
    if (rawPreview) URL.revokeObjectURL(rawPreview);
    setPreview(null);
    setRawPreview(null);
    setFile(null);
    setIsVideo(false);
    setCaption('');
    setTrimNotice('');
    setCropping(false);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="New Story">
      <div className="space-y-4">
        {preview ? (
          <div className="relative">
            {isVideo ? (
              <video src={preview} className="w-full aspect-[3/4] object-cover rounded-xl" playsInline autoPlay muted loop />
            ) : (
              <img src={preview} alt="Preview" className="w-full aspect-[3/4] object-cover rounded-xl" />
            )}
            <button
              onClick={() => { if (preview) URL.revokeObjectURL(preview); setPreview(null); setFile(null); setIsVideo(false); setTrimNotice(''); }}
              className="absolute top-2 right-2 w-8 h-8 bg-black/70 rounded-full flex items-center justify-center"
            >
              <X className="text-white" size={16} />
            </button>
          </div>
        ) : cropping && rawPreview ? (
          <ImageCropper
            imageSrc={rawPreview}
            aspect={3 / 4}
            onCropComplete={handleCropComplete}
            onCancel={handleCropCancel}
          />
        ) : (
          <label className="flex flex-col items-center justify-center w-full aspect-[3/4] bg-dark-100 border-2 border-dashed border-dark-50 hover:border-gold/40 rounded-xl cursor-pointer transition-colors">
            <Camera className="text-gray-500 mb-2" size={32} />
            <span className="text-sm text-gray-500">Tap to add a photo or video</span>
            <input ref={inputRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleFile} />
          </label>
        )}
        {trimNotice && <p className="text-gold text-sm">{trimNotice}</p>}
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
