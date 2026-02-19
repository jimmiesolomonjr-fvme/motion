import multer from 'multer';
import path from 'path';
import { randomUUID } from 'crypto';
import config from '../config/index.js';

const isProduction = config.nodeEnv === 'production';

// Production: memory storage (Railway's filesystem is ephemeral)
// Development: disk storage
const imageStorage = isProduction
  ? multer.memoryStorage()
  : multer.diskStorage({
      destination: (req, file, cb) => cb(null, config.upload.dir),
      filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${randomUUID()}${ext}`);
      },
    });

const voiceStorage = isProduction
  ? multer.memoryStorage()
  : multer.diskStorage({
      destination: (req, file, cb) => cb(null, config.upload.dir),
      filename: (req, file, cb) => cb(null, `voice-${randomUUID()}.webm`),
    });

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, PNG, and WebP images are allowed'), false);
  }
};

export const upload = multer({
  storage: imageStorage,
  fileFilter,
  limits: { fileSize: config.upload.maxFileSize },
});

export const uploadVoice = multer({
  storage: voiceStorage,
  fileFilter: (req, file, cb) => {
    const allowed = ['audio/webm', 'audio/ogg', 'audio/mp4'];
    cb(null, allowed.includes(file.mimetype));
  },
  limits: { fileSize: config.upload.maxFileSize },
});

// Convert multer memory-stored file to a base64 data URL
export function toDataUrl(file) {
  return `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
}
