import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import api from '../../services/api';
import { detectFace } from '../../utils/faceDetection';
import { isVideoUrl, getVideoDuration } from '../../utils/mediaUtils';
import Modal from '../ui/Modal';
import ImageCropper from '../ui/ImageCropper';

export default function StepPhotos({ onComplete }) {
  const [photos, setPhotos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [trimNotice, setTrimNotice] = useState('');
  const [cropQueue, setCropQueue] = useState([]);
  const [croppedFiles, setCroppedFiles] = useState([]);
  const [videoFiles, setVideoFiles] = useState([]);
  const [cropPreview, setCropPreview] = useState(null);

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files);
    e.target.value = '';
    if (photos.length + files.length > 6) {
      setError('Maximum 6 media items allowed');
      return;
    }

    // Check video count (max 3)
    const existingVideoCount = photos.filter(isVideoUrl).length;
    const newVideoCount = files.filter(f => f.type.startsWith('video/')).length;
    if (existingVideoCount + newVideoCount > 3) {
      setError('Maximum 3 videos allowed');
      return;
    }

    // First slot must be an image, not a video
    if (photos.length === 0 && files[0]?.type.startsWith('video/')) {
      setError('Your first photo must be an image, not a video');
      return;
    }

    // Check video durations — show trim notice for >15s
    setTrimNotice('');
    const vids = files.filter(f => f.type.startsWith('video/'));
    for (const f of vids) {
      const duration = await getVideoDuration(f);
      if (duration > 15) {
        setTrimNotice('Video will be trimmed to 15 seconds');
        break;
      }
    }

    const imageFiles = files.filter(f => !f.type.startsWith('video/'));
    const vidFiles = files.filter(f => f.type.startsWith('video/'));

    if (imageFiles.length === 0) {
      // Only videos — upload directly
      await uploadPhotos([], vidFiles);
      return;
    }

    // Start crop queue
    setVideoFiles(vidFiles);
    setCroppedFiles([]);
    const urls = imageFiles.map(f => URL.createObjectURL(f));
    setCropQueue(urls.slice(1));
    setCropPreview(urls[0]);
  };

  const handleCropComplete = async (blob) => {
    if (cropPreview) URL.revokeObjectURL(cropPreview);

    // Face detection on first photo
    const isFirstPhoto = photos.length === 0 && croppedFiles.length === 0;
    if (isFirstPhoto) {
      const hasFace = await detectFace(blob);
      if (!hasFace) {
        setError('Your first photo must clearly show your face');
        cropQueue.forEach(u => URL.revokeObjectURL(u));
        setCropQueue([]);
        setCropPreview(null);
        setCroppedFiles([]);
        setVideoFiles([]);
        return;
      }
    }

    const newCropped = [...croppedFiles, new File([blob], `photo-${croppedFiles.length}.jpg`, { type: 'image/jpeg' })];

    if (cropQueue.length > 0) {
      setCroppedFiles(newCropped);
      setCropPreview(cropQueue[0]);
      setCropQueue(cropQueue.slice(1));
    } else {
      setCropPreview(null);
      setCroppedFiles([]);
      await uploadPhotos(newCropped, videoFiles);
      setVideoFiles([]);
    }
  };

  const handleCropCancel = () => {
    if (cropPreview) URL.revokeObjectURL(cropPreview);
    cropQueue.forEach(u => URL.revokeObjectURL(u));
    setCropPreview(null);
    setCropQueue([]);
    setCroppedFiles([]);
    setVideoFiles([]);
  };

  const uploadPhotos = async (imageFiles, vidFiles) => {
    setUploading(true);
    setError('');
    try {
      const formData = new FormData();
      imageFiles.forEach((f) => formData.append('photos', f));
      vidFiles.forEach((f) => formData.append('photos', f));

      const { data } = await api.post('/users/photos', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setPhotos(data.photos || []);
      setTrimNotice('');
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
        <h2 className="text-2xl font-bold mb-2">Add Photos & Videos</h2>
        <p className="text-gray-400">Add at least 1 photo (up to 6 items, max 3 videos)</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {photos.map((photo, i) => (
          <div key={i} className="relative aspect-square rounded-xl overflow-hidden">
            {isVideoUrl(photo) ? (
              <video src={photo} className="w-full h-full object-cover" playsInline muted loop autoPlay />
            ) : (
              <img src={photo} alt="" className="w-full h-full object-cover" />
            )}
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
            <input type="file" accept="image/*,video/*" multiple onChange={handleFileSelect} className="hidden" />
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

      {trimNotice && <p className="text-gold text-sm text-center">{trimNotice}</p>}
      {error && <p className="text-red-400 text-sm text-center">{error}</p>}

      <Modal isOpen={!!cropPreview} onClose={handleCropCancel} title={`Crop Photo${croppedFiles.length > 0 ? ` (${croppedFiles.length + 1})` : ''}`}>
        {cropPreview && (
          <ImageCropper
            imageSrc={cropPreview}
            aspect={1}
            onCropComplete={handleCropComplete}
            onCancel={handleCropCancel}
          />
        )}
      </Modal>

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
