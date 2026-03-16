/**
 * Injects Cloudinary transforms into a URL between /upload/ and the version/path.
 * Skips non-Cloudinary URLs, videos, base64, and already-transformed URLs.
 */
export function optimizeCloudinaryUrl(url, { width, height, quality, crop } = {}) {
  if (!url || typeof url !== 'string') return url;

  // Skip base64, blobs, non-Cloudinary, video uploads, and already-transformed URLs
  if (
    url.startsWith('data:') ||
    url.startsWith('blob:') ||
    !url.includes('/upload/') ||
    url.includes('/video/upload/') ||
    url.includes('/upload/f_') ||
    url.includes('/upload/q_') ||
    url.includes('/upload/w_') ||
    url.includes('/upload/c_')
  ) {
    return url;
  }

  const parts = ['f_auto', 'q_auto'];
  if (width) parts.push(`w_${width}`);
  if (height) parts.push(`h_${height}`);
  if (crop) parts.push(`c_${crop}`);

  const transform = parts.join(',');
  return url.replace('/upload/', `/upload/${transform}/`);
}

/**
 * Convenience for Avatar sizes -> pixel widths at 2x density.
 * sm=64, md=96, lg=160, xl=256
 */
const AVATAR_SIZE_MAP = { sm: 64, md: 96, lg: 160, xl: 256 };

export function avatarUrl(url, size = 'md') {
  const width = AVATAR_SIZE_MAP[size] || AVATAR_SIZE_MAP.md;
  return optimizeCloudinaryUrl(url, { width, crop: 'fill' });
}
