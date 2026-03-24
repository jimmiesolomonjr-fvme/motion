import { useState, useRef, useCallback } from 'react';
import { X, Camera, Type, ToggleLeft, ToggleRight, Sun, Moon } from 'lucide-react';
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

  // Text overlay state
  const [textMode, setTextMode] = useState(false);
  const [overlayText, setOverlayText] = useState('');
  const [hasBackground, setHasBackground] = useState(true);
  const [colorStyle, setColorStyle] = useState('light-on-dark'); // 'light-on-dark' | 'dark-on-light'
  const [yPercent, setYPercent] = useState(50);
  const draggingRef = useRef(false);
  const previewContainerRef = useRef(null);
  const overlayInputRef = useRef(null);

  const handleFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const video = f.type.startsWith('video/');

    if (video) {
      setFile(f);
      setIsVideo(true);
      setPreview(URL.createObjectURL(f));
      setTrimNotice('');
      const duration = await getVideoDuration(f);
      if (duration > 15) {
        setTrimNotice('Video will be trimmed to 15 seconds');
      }
    } else {
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

  // Drag handlers for positioning text overlay
  const getYPercentFromEvent = useCallback((clientY) => {
    if (!previewContainerRef.current) return 50;
    const rect = previewContainerRef.current.getBoundingClientRect();
    const y = clientY - rect.top;
    return Math.max(10, Math.min(90, (y / rect.height) * 100));
  }, []);

  const handleDragStart = useCallback((e) => {
    if (!overlayText.trim()) return;
    e.preventDefault();
    draggingRef.current = true;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    setYPercent(getYPercentFromEvent(clientY));
  }, [overlayText, getYPercentFromEvent]);

  const handleDragMove = useCallback((e) => {
    if (!draggingRef.current) return;
    e.preventDefault();
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    setYPercent(getYPercentFromEvent(clientY));
  }, [getYPercentFromEvent]);

  const handleDragEnd = useCallback(() => {
    draggingRef.current = false;
  }, []);

  const handleSubmit = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('photo', file);
      if (caption.trim()) formData.append('caption', caption.trim());
      if (overlayText.trim()) {
        formData.append('textOverlay', JSON.stringify({
          text: overlayText.trim(),
          hasBackground,
          style: colorStyle,
          yPercent,
        }));
      }
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
    setTextMode(false);
    setOverlayText('');
    setHasBackground(true);
    setColorStyle('light-on-dark');
    setYPercent(50);
    onClose();
  };

  // Get overlay style classes for preview
  const getOverlayStyles = () => {
    const isLight = colorStyle === 'light-on-dark';
    if (hasBackground) {
      return isLight
        ? 'text-white bg-black/70 px-4 py-2 rounded-xl'
        : 'text-gray-900 bg-white/80 px-4 py-2 rounded-xl';
    }
    return isLight
      ? 'text-white [text-shadow:_0_1px_4px_rgba(0,0,0,0.8),_0_0_8px_rgba(0,0,0,0.5)]'
      : 'text-gray-900 [text-shadow:_0_1px_4px_rgba(255,255,255,0.8),_0_0_8px_rgba(255,255,255,0.5)]';
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="New Story">
      <div className="space-y-4">
        {preview ? (
          <div
            ref={previewContainerRef}
            className="relative select-none"
            onMouseMove={handleDragMove}
            onMouseUp={handleDragEnd}
            onMouseLeave={handleDragEnd}
            onTouchMove={handleDragMove}
            onTouchEnd={handleDragEnd}
          >
            {isVideo ? (
              <video src={preview} className="w-full aspect-[3/4] object-cover rounded-xl" playsInline autoPlay muted loop />
            ) : (
              <img src={preview} alt="Preview" className="w-full aspect-[3/4] object-cover rounded-xl" />
            )}

            {/* Text overlay on preview */}
            {overlayText.trim() && (
              <div
                className="absolute left-0 right-0 flex justify-center pointer-events-none px-4"
                style={{ top: `${yPercent}%`, transform: 'translateY(-50%)' }}
              >
                <span className={`text-base font-semibold text-center max-w-[90%] inline-block ${getOverlayStyles()}`}>
                  {overlayText}
                </span>
              </div>
            )}

            {/* Drag handle (visible when text exists) */}
            {overlayText.trim() && (
              <div
                className="absolute left-0 right-0 flex justify-center cursor-grab active:cursor-grabbing"
                style={{ top: `${yPercent}%`, transform: 'translateY(-50%)' }}
                onMouseDown={handleDragStart}
                onTouchStart={handleDragStart}
              >
                <div className="w-8 h-8 rounded-full flex items-center justify-center opacity-0" />
              </div>
            )}

            {/* X button to remove photo */}
            <button
              onClick={() => { if (preview) URL.revokeObjectURL(preview); setPreview(null); setFile(null); setIsVideo(false); setTrimNotice(''); setTextMode(false); setOverlayText(''); }}
              className="absolute top-2 right-2 w-8 h-8 bg-black/70 rounded-full flex items-center justify-center"
            >
              <X className="text-white" size={16} />
            </button>

            {/* Aa button to toggle text mode */}
            <button
              onClick={() => {
                setTextMode(!textMode);
                if (!textMode) setTimeout(() => overlayInputRef.current?.focus(), 100);
              }}
              className={`absolute top-2 left-2 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${textMode || overlayText.trim() ? 'bg-gold text-dark' : 'bg-black/70 text-white'}`}
            >
              <Type size={16} />
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

        {/* Text overlay controls */}
        {preview && textMode && (
          <div className="space-y-3">
            <input
              ref={overlayInputRef}
              value={overlayText}
              onChange={(e) => setOverlayText(e.target.value)}
              placeholder="Type your text..."
              className="w-full input-field py-2.5"
              maxLength={200}
            />
            <div className="flex items-center gap-3">
              <button
                onClick={() => setHasBackground(!hasBackground)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${hasBackground ? 'bg-gold/20 text-gold border border-gold/30' : 'bg-dark-100 text-gray-400 border border-dark-50'}`}
              >
                {hasBackground ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                Background
              </button>
              <button
                onClick={() => setColorStyle(colorStyle === 'light-on-dark' ? 'dark-on-light' : 'light-on-dark')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${colorStyle === 'light-on-dark' ? 'bg-dark-100 text-white border border-dark-50' : 'bg-white/90 text-gray-900 border border-gray-300'}`}
              >
                {colorStyle === 'light-on-dark' ? <Moon size={14} /> : <Sun size={14} />}
                {colorStyle === 'light-on-dark' ? 'Light text' : 'Dark text'}
              </button>
            </div>
            {overlayText.trim() && (
              <p className="text-xs text-gray-500">Drag text on the image to reposition</p>
            )}
          </div>
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
