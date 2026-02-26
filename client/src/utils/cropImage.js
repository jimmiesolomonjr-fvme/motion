/**
 * Creates a cropped image blob from a source image and pixel crop area.
 * @param {string} imageSrc - The source image URL
 * @param {Object} pixelCrop - { x, y, width, height } in pixels
 * @param {string} mimeType - Output MIME type (default: 'image/jpeg')
 * @returns {Promise<Blob>} The cropped image as a Blob
 */
export default function getCroppedImg(imageSrc, pixelCrop, mimeType = 'image/jpeg') {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = pixelCrop.width;
      canvas.height = pixelCrop.height;
      const ctx = canvas.getContext('2d');

      ctx.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        pixelCrop.width,
        pixelCrop.height
      );

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Canvas toBlob failed'));
            return;
          }
          resolve(blob);
        },
        mimeType,
        0.92
      );
    };
    image.onerror = () => reject(new Error('Failed to load image'));
    image.src = imageSrc;
  });
}
