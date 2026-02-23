/**
 * Detect whether a URL points to a video file.
 * Checks Cloudinary video path, base64 video prefix, and common extensions.
 */
export function isVideoUrl(url) {
  if (!url || typeof url !== 'string') return false;
  if (url.includes('/video/upload/')) return true;
  if (url.startsWith('data:video/')) return true;
  const lower = url.split('?')[0].toLowerCase();
  return lower.endsWith('.mp4') || lower.endsWith('.webm') || lower.endsWith('.mov');
}

/**
 * Read the duration (in seconds) of a video File object.
 * Returns a Promise that resolves to the duration number.
 */
export function getVideoDuration(file) {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src);
      resolve(video.duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(video.src);
      resolve(0);
    };
    video.src = URL.createObjectURL(file);
  });
}
