import dotenv from 'dotenv';
dotenv.config();

export default {
  port: parseInt(process.env.PORT || '3001'),
  nodeEnv: process.env.NODE_ENV || 'development',
  clientUrl: process.env.CLIENT_URL || (process.env.NODE_ENV === 'production' ? 'https://yourmotion.app' : 'http://localhost:5173'),
  jwt: {
    secret: process.env.JWT_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessExpiry: '15m',
    refreshExpiry: '7d',
  },
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    priceId: process.env.STRIPE_PRICE_ID,
    platformFeePercent: parseFloat(process.env.STRIPE_PLATFORM_FEE_PERCENT || '0.10'),
  },
  upload: {
    dir: process.env.UPLOAD_DIR || './uploads',
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '5242880'),
  },
  db: {
    url: process.env.DATABASE_URL,
  },
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  },
  resend: {
    apiKey: process.env.RESEND_API_KEY,
    from: process.env.RESEND_FROM || 'Motion <onboarding@resend.dev>',
  },
  communityMoves: {
    googlePlacesApiKey: process.env.GOOGLE_PLACES_API_KEY || '',
    yelpApiKey: process.env.YELP_API_KEY || '',
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
    defaultCity: process.env.COMMUNITY_MOVES_CITY || 'Atlanta',
    defaultLat: process.env.COMMUNITY_MOVES_LAT || '33.749',
    defaultLng: process.env.COMMUNITY_MOVES_LNG || '-84.388',
  },
  synthetic: {
    enabled: process.env.SYNTHETIC_USERS_ENABLED === 'true',
    generationEnabled: process.env.SYNTHETIC_GENERATION_ENABLED === 'true',
    llmApiKey: process.env.SYNTHETIC_USERS_LLM_API_KEY || process.env.ANTHROPIC_API_KEY || '',
    maxConcurrent: parseInt(process.env.SYNTHETIC_MAX_CONCURRENT || '3'),
    cycleIntervalMinutes: parseInt(process.env.SYNTHETIC_CYCLE_INTERVAL_MINUTES || '10'),
    falApiKey: process.env.FAL_API_KEY || '',
  },
  appVersion: process.env.APP_VERSION || '0.0.0',
  vapid: {
    publicKey: process.env.VAPID_PUBLIC_KEY,
    privateKey: process.env.VAPID_PRIVATE_KEY,
    email: process.env.VAPID_EMAIL || 'mailto:admin@motion.app',
  },
};
