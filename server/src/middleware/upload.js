import multer from 'multer';
import path from 'path';
import { randomUUID } from 'crypto';
import { v2 as cloudinary } from 'cloudinary';
import config from '../config/index.js';

const isProduction = config.nodeEnv === 'production';

// Configure Cloudinary if credentials are present
const cloudinaryEnabled = !!(config.cloudinary.cloudName && config.cloudinary.apiKey && config.cloudinary.apiSecret);
if (cloudinaryEnabled) {
  cloudinary.config({
    cloud_name: config.cloudinary.cloudName,
    api_key: config.cloudinary.apiKey,
    api_secret: config.cloudinary.apiSecret,
  });
  console.log('Cloudinary configured');
}

// When Cloudinary is enabled, always use memoryStorage (need the buffer for upload).
// Otherwise, keep original behavior: memoryStorage in prod, diskStorage in dev.
const useMemory = cloudinaryEnabled || isProduction;

const imageStorage = useMemory
  ? multer.memoryStorage()
  : multer.diskStorage({
      destination: (req, file, cb) => cb(null, config.upload.dir),
      filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${randomUUID()}${ext}`);
      },
    });

const voiceStorage = useMemory
  ? multer.memoryStorage()
  : multer.diskStorage({
      destination: (req, file, cb) => cb(null, config.upload.dir),
      filename: (req, file, cb) => cb(null, `voice-${randomUUID()}.webm`),
    });

const imageFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, PNG, and WebP images are allowed'), false);
  }
};

const mediaFilter = (req, file, cb) => {
  const allowedTypes = [
    'image/jpeg', 'image/png', 'image/webp',
    'video/mp4', 'video/webm', 'video/quicktime',
  ];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, PNG, WebP images and MP4, WebM, MOV videos are allowed'), false);
  }
};

export const upload = multer({
  storage: imageStorage,
  fileFilter: imageFilter,
  limits: { fileSize: config.upload.maxFileSize },
});

export const uploadMedia = multer({
  storage: useMemory ? multer.memoryStorage() : multer.diskStorage({
    destination: (req, file, cb) => cb(null, config.upload.dir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${randomUUID()}${ext}`);
    },
  }),
  fileFilter: mediaFilter,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
});

export const uploadVoice = multer({
  storage: voiceStorage,
  fileFilter: (req, file, cb) => {
    const allowed = ['audio/webm', 'audio/ogg', 'audio/mp4'];
    cb(null, allowed.includes(file.mimetype));
  },
  limits: { fileSize: config.upload.maxFileSize },
});

const videoStorage = useMemory
  ? multer.memoryStorage()
  : multer.diskStorage({
      destination: (req, file, cb) => cb(null, config.upload.dir),
      filename: (req, file, cb) => cb(null, `video-${randomUUID()}${path.extname(file.originalname)}`),
    });

export const uploadVideo = multer({
  storage: videoStorage,
  fileFilter: (req, file, cb) => {
    const allowed = ['video/mp4', 'video/webm', 'video/quicktime'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only MP4, WebM, and MOV videos are allowed'), false);
    }
  },
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
});

// Convert multer memory-stored file to a base64 data URL (fallback)
function toDataUrl(file) {
  return `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
}

/**
 * Upload a file (multer file object OR base64 data URL string) to Cloudinary.
 * Falls back to base64/disk path when Cloudinary is not configured.
 *
 * @param {object|string} fileOrDataUrl - multer file object, or a base64 data URL string (for migration)
 * @param {string} folder - Cloudinary folder, e.g. 'motion/profiles'
 * @returns {Promise<string>} - Cloudinary URL, base64 data URL, or local /uploads/ path
 */
export async function uploadToCloud(fileOrDataUrl, folder = 'motion/uploads') {
  // Handle base64 string input (used by migration)
  if (typeof fileOrDataUrl === 'string') {
    if (!cloudinaryEnabled) return fileOrDataUrl;
    if (!fileOrDataUrl.startsWith('data:')) return fileOrDataUrl; // already a URL
    const result = await cloudinary.uploader.upload(fileOrDataUrl, {
      folder,
      resource_type: 'auto',
    });
    return result.secure_url;
  }

  // Handle multer file object
  const file = fileOrDataUrl;
  if (!cloudinaryEnabled) {
    return file.buffer ? toDataUrl(file) : `/uploads/${file.filename}`;
  }

  const b64 = file.buffer.toString('base64');
  const dataUri = `data:${file.mimetype};base64,${b64}`;
  const isImage = file.mimetype.startsWith('image/');

  // Attempt upload with NSFW moderation for images (requires Rekognition add-on)
  const options = { folder, resource_type: 'auto' };
  if (isImage) options.moderation = 'aws_rek';

  let result;
  try {
    result = await cloudinary.uploader.upload(dataUri, options);
  } catch (err) {
    // If Rekognition add-on isn't enabled, fall back to upload without moderation
    if (isImage && err.message?.includes('moderation')) {
      result = await cloudinary.uploader.upload(dataUri, { folder, resource_type: 'auto' });
    } else {
      throw err;
    }
  }

  // If Rekognition flagged explicit content, delete and reject
  if (result.moderation?.[0]?.status === 'rejected') {
    await cloudinary.uploader.destroy(result.public_id).catch(() => {});
    const error = new Error('This image was flagged as inappropriate and cannot be uploaded');
    error.code = 'NSFW_DETECTED';
    throw error;
  }

  return result.secure_url;
}

/**
 * Upload a video file to Cloudinary with server-side trimming.
 * Uses eager transformation to cap duration at maxDuration seconds.
 * Falls back to base64/disk path when Cloudinary is not configured.
 */
export async function uploadVideoToCloud(file, folder = 'motion/profiles', maxDuration = 15) {
  if (!cloudinaryEnabled) {
    return file.buffer ? toDataUrl(file) : `/uploads/${file.filename}`;
  }

  const b64 = file.buffer.toString('base64');
  const dataUri = `data:${file.mimetype};base64,${b64}`;
  const result = await cloudinary.uploader.upload(dataUri, {
    folder,
    resource_type: 'video',
    eager: [{ duration: `${maxDuration}` }],
    eager_async: false,
  });

  // Use the eager (trimmed) URL if available, otherwise the original
  if (result.eager && result.eager.length > 0 && result.eager[0].secure_url) {
    return result.eager[0].secure_url;
  }
  return result.secure_url;
}

/**
 * Delete a file from Cloudinary by its URL.
 * No-op for base64 data URLs or local paths.
 */
export async function deleteFromCloud(url) {
  if (!cloudinaryEnabled || !url) return;
  if (!url.includes('res.cloudinary.com')) return;

  // Extract public_id from Cloudinary URL
  // URL format: https://res.cloudinary.com/<cloud>/image/upload/v1234/folder/filename.ext
  try {
    const parts = url.split('/upload/');
    if (parts.length < 2) return;
    const afterUpload = parts[1];
    // Remove version prefix (v1234567890/) if present
    const withoutVersion = afterUpload.replace(/^v\d+\//, '');
    // Remove file extension to get public_id
    const publicId = withoutVersion.replace(/\.[^.]+$/, '');
    // Determine resource type from URL
    const resourceType = url.includes('/video/upload/') ? 'video' : 'image';
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  } catch (err) {
    console.error('Cloudinary delete error:', err.message);
  }
}
