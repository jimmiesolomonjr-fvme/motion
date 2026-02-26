import { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import getCroppedImg from '../../utils/cropImage';

export default function ImageCropper({ imageSrc, aspect = 1, onCropComplete, onCancel }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  const onCropChange = useCallback((_, croppedPixels) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const handleCrop = async () => {
    if (!croppedAreaPixels) return;
    const blob = await getCroppedImg(imageSrc, croppedAreaPixels);
    onCropComplete(blob);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="relative w-full" style={{ height: '60vh', minHeight: 280 }}>
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          aspect={aspect}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropChange}
          cropShape={aspect === 1 ? 'round' : 'rect'}
          showGrid={false}
          style={{
            containerStyle: { borderRadius: '0.75rem', overflow: 'hidden' },
          }}
        />
      </div>

      <div className="flex items-center gap-3 px-1">
        <span className="text-xs text-gray-500">Zoom</span>
        <input
          type="range"
          min={1}
          max={3}
          step={0.05}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="flex-1 accent-gold"
        />
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-4 py-2.5 bg-dark-100 text-white rounded-xl font-semibold text-sm hover:bg-dark-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleCrop}
          className="flex-1 px-4 py-2.5 bg-gold text-dark rounded-xl font-semibold text-sm hover:bg-gold/90 transition-colors"
        >
          Crop
        </button>
      </div>
    </div>
  );
}
