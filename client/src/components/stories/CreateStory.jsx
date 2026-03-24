import { useState, useRef, useCallback } from 'react';
import { X, Camera, Type, ToggleLeft, ToggleRight, Minus, Plus, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import ImageCropper from '../ui/ImageCropper';
import api from '../../services/api';
import { getVideoDuration } from '../../utils/mediaUtils';
import {
  STORY_FONT_STYLES,
  STORY_TEXT_COLORS,
  STORY_FONT_SIZE_MIN,
  STORY_FONT_SIZE_MAX,
  STORY_FONT_SIZE_DEFAULT,
} from '../../utils/constants';

// W3C brightness formula — returns true if color is light
function isColorLight(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150;
}

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
  const [fontStyle, setFontStyle] = useState('classic');
  const [textColor, setTextColor] = useState('#FFFFFF');
  const [fontSize, setFontSize] = useState(STORY_FONT_SIZE_DEFAULT);
  const [textAlign, setTextAlign] = useState('center');
  const [xPercent, setXPercent] = useState(50);
  const [yPercent, setYPercent] = useState(50);
  const draggingRef = useRef(false);
  const previewContainerRef = useRef(null);
  const overlayInputRef = useRef(null);

  // Pinch-to-scale refs
  const initialPinchDistRef = useRef(null);
  const initialPinchFontSize = useRef(STORY_FONT_SIZE_DEFAULT);

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

  // Drag helpers for X+Y positioning
  const getPositionFromEvent = useCallback((clientX, clientY) => {
    if (!previewContainerRef.current) return { x: 50, y: 50 };
    const rect = previewContainerRef.current.getBoundingClientRect();
    const x = Math.max(10, Math.min(90, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.max(10, Math.min(90, ((clientY - rect.top) / rect.height) * 100));
    return { x, y };
  }, []);

  const getTouchDistance = (touches) => {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleDragStart = useCallback((e) => {
    if (!overlayText.trim()) return;
    e.preventDefault();

    if (e.touches && e.touches.length >= 2) {
      // Pinch start
      initialPinchDistRef.current = getTouchDistance(e.touches);
      initialPinchFontSize.current = fontSize;
      return;
    }

    draggingRef.current = true;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const pos = getPositionFromEvent(clientX, clientY);
    setXPercent(pos.x);
    setYPercent(pos.y);
  }, [overlayText, fontSize, getPositionFromEvent]);

  const handleDragMove = useCallback((e) => {
    // Handle pinch-to-scale
    if (e.touches && e.touches.length >= 2 && initialPinchDistRef.current) {
      e.preventDefault();
      const currentDist = getTouchDistance(e.touches);
      const ratio = currentDist / initialPinchDistRef.current;
      const newSize = Math.round(Math.max(STORY_FONT_SIZE_MIN, Math.min(STORY_FONT_SIZE_MAX, initialPinchFontSize.current * ratio)));
      setFontSize(newSize);
      return;
    }

    if (!draggingRef.current) return;
    e.preventDefault();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const pos = getPositionFromEvent(clientX, clientY);
    setXPercent(pos.x);
    setYPercent(pos.y);
  }, [getPositionFromEvent]);

  const handleDragEnd = useCallback(() => {
    draggingRef.current = false;
    initialPinchDistRef.current = null;
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
          fontStyle,
          color: textColor,
          fontSize,
          align: textAlign,
          xPercent,
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
    setFontStyle('classic');
    setTextColor('#FFFFFF');
    setFontSize(STORY_FONT_SIZE_DEFAULT);
    setTextAlign('center');
    setXPercent(50);
    setYPercent(50);
    onClose();
  };

  // Get font style object for current selection
  const currentFont = STORY_FONT_STYLES.find((f) => f.id === fontStyle) || STORY_FONT_STYLES[0];

  // Build inline styles for the text overlay preview
  const getOverlayInlineStyles = () => {
    const light = isColorLight(textColor);
    const styles = {
      fontFamily: currentFont.fontFamily,
      fontWeight: currentFont.fontWeight,
      textTransform: currentFont.textTransform || 'none',
      color: textColor,
      fontSize: `${fontSize}px`,
      lineHeight: 1.3,
      textAlign,
      maxWidth: '90%',
      display: 'inline-block',
      wordBreak: 'break-word',
    };
    if (hasBackground) {
      styles.backgroundColor = light ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.8)';
      styles.padding = '6px 16px';
      styles.borderRadius = '12px';
    } else {
      styles.textShadow = light
        ? '0 1px 4px rgba(0,0,0,0.8), 0 0 8px rgba(0,0,0,0.5)'
        : '0 1px 4px rgba(255,255,255,0.8), 0 0 8px rgba(255,255,255,0.5)';
    }
    return styles;
  };

  const alignButtons = [
    { value: 'left', icon: AlignLeft },
    { value: 'center', icon: AlignCenter },
    { value: 'right', icon: AlignRight },
  ];

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
                className="absolute pointer-events-none px-4"
                style={{
                  left: `${xPercent}%`,
                  top: `${yPercent}%`,
                  transform: 'translate(-50%, -50%)',
                  width: '100%',
                  display: 'flex',
                  justifyContent: textAlign === 'left' ? 'flex-start' : textAlign === 'right' ? 'flex-end' : 'center',
                }}
              >
                <span style={getOverlayInlineStyles()}>
                  {overlayText}
                </span>
              </div>
            )}

            {/* Drag handle (visible when text exists) */}
            {overlayText.trim() && (
              <div
                className="absolute cursor-grab active:cursor-grabbing"
                style={{
                  left: `${xPercent}%`,
                  top: `${yPercent}%`,
                  transform: 'translate(-50%, -50%)',
                  width: '60%',
                  height: '40px',
                }}
                onMouseDown={handleDragStart}
                onTouchStart={handleDragStart}
              />
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

            {/* Row 1: Font picker */}
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
              {STORY_FONT_STYLES.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFontStyle(f.id)}
                  className={`shrink-0 px-3 py-1.5 rounded-lg text-xs transition-colors border ${
                    fontStyle === f.id
                      ? 'bg-gold/20 text-gold border-gold/40'
                      : 'bg-dark-100 text-gray-400 border-dark-50 hover:border-gray-500'
                  }`}
                  style={{
                    fontFamily: f.fontFamily,
                    fontWeight: f.fontWeight,
                    textTransform: f.textTransform || 'none',
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Row 2: Color swatches */}
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
              {STORY_TEXT_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => setTextColor(color)}
                  className={`shrink-0 w-7 h-7 rounded-full border-2 transition-all ${
                    textColor === color ? 'border-gold scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>

            {/* Row 3: Size slider + alignment */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <button
                  onClick={() => setFontSize((s) => Math.max(STORY_FONT_SIZE_MIN, s - 2))}
                  className="shrink-0 w-7 h-7 rounded-lg bg-dark-100 border border-dark-50 flex items-center justify-center text-gray-400 hover:text-white"
                >
                  <Minus size={12} />
                </button>
                <input
                  type="range"
                  min={STORY_FONT_SIZE_MIN}
                  max={STORY_FONT_SIZE_MAX}
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                  className="flex-1 h-1 accent-gold"
                />
                <button
                  onClick={() => setFontSize((s) => Math.min(STORY_FONT_SIZE_MAX, s + 2))}
                  className="shrink-0 w-7 h-7 rounded-lg bg-dark-100 border border-dark-50 flex items-center justify-center text-gray-400 hover:text-white"
                >
                  <Plus size={12} />
                </button>
                <span className="text-[10px] text-gray-500 w-6 text-center shrink-0">{fontSize}</span>
              </div>

              <div className="flex rounded-lg overflow-hidden border border-dark-50 shrink-0">
                {alignButtons.map(({ value, icon: Icon }) => (
                  <button
                    key={value}
                    onClick={() => setTextAlign(value)}
                    className={`w-8 h-7 flex items-center justify-center transition-colors ${
                      textAlign === value ? 'bg-gold/20 text-gold' : 'bg-dark-100 text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    <Icon size={13} />
                  </button>
                ))}
              </div>
            </div>

            {/* Row 4: Background toggle */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setHasBackground(!hasBackground)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${hasBackground ? 'bg-gold/20 text-gold border border-gold/30' : 'bg-dark-100 text-gray-400 border border-dark-50'}`}
              >
                {hasBackground ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                Background
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
