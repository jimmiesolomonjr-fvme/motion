export const REPORT_REASONS = [
  { value: 'fake_profile', label: 'Fake Profile' },
  { value: 'harassment', label: 'Harassment' },
  { value: 'spam', label: 'Spam' },
  { value: 'inappropriate_content', label: 'Inappropriate Content' },
  { value: 'other', label: 'Other' },
];

export const PREMIUM_PRICE = '$19.99/mo';

export const PREMIUM_BENEFITS = [
  'Unlimited messaging as a Stepper',
  'See who liked you',
  'Priority placement in feed',
  'Advanced filters',
  'Verified Stepper badge eligibility',
];

export const HEIGHT_FEET = [4, 5, 6, 7];
export const HEIGHT_INCHES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

export const WEIGHT_OPTIONS = Array.from({ length: 63 }, (_, i) => 90 + i * 5);

export const OCCUPATION_OPTIONS = [
  'Entrepreneur',
  'Business Owner',
  'Tech / Engineering',
  'Healthcare',
  'Finance / Banking',
  'Real Estate',
  'Entertainment / Media',
  'Creative / Design',
  'Legal',
  'Education',
  'Sales / Marketing',
  'Government / Military',
  'Fitness / Wellness',
  'Hospitality / Food',
  'Trades / Skilled Labor',
  'Student',
  'Self-employed',
  'Other',
];

export const LOOKING_FOR_TAGS = [
  'Wifey Material',
  'Cuffing Season',
  'Something Real',
  'Good Vibes Only',
  'Boss Couple',
  'Travel Partner',
  'Active Lifestyle',
  'Fine Dining',
  'Luxury Living',
  'Marriage Minded',
  'Friends First',
  'No Labels',
  'Monogamous',
  'Situationship',
  'Open to Options',
  'Passport Ready',
  'Romantic',
  'Spoil Me',
  'Ambitious',
  'Affectionate',
  'Laid Back',
  'Night Owl',
  'Adventure Seeker',
  'Down to Earth',
];

export const MAX_LOOKING_FOR_TAGS = 5;

export const APP_VERSION = '2.34.0';

// Story text overlay constants
export const STORY_FONT_STYLES = [
  { id: 'classic', label: 'Classic', fontFamily: "'Inter', sans-serif", fontWeight: 600 },
  { id: 'modern', label: 'Modern', fontFamily: "'Inter', sans-serif", fontWeight: 800, textTransform: 'uppercase' },
  { id: 'handwritten', label: 'Handwritten', fontFamily: "'Pacifico', cursive", fontWeight: 400 },
  { id: 'typewriter', label: 'Typewriter', fontFamily: "'Courier New', monospace", fontWeight: 400 },
  { id: 'bold', label: 'Bold', fontFamily: "'Impact', sans-serif", fontWeight: 400, textTransform: 'uppercase' },
];

export const STORY_TEXT_COLORS = [
  '#FFFFFF', '#000000', '#EF4444', '#F97316', '#EAB308',
  '#22C55E', '#3B82F6', '#A855F7', '#EC4899', '#F59E0B',
  '#14B8A6', '#9CA3AF',
];

export const STORY_FONT_SIZE_MIN = 16;
export const STORY_FONT_SIZE_MAX = 48;
export const STORY_FONT_SIZE_DEFAULT = 24;

export const DATE_ENERGY_OPTIONS = [
  { value: 'Low-key tonight', emoji: '🌙', color: 'text-blue-400', bg: 'bg-blue-400/10', border: 'border-blue-400/20' },
  { value: 'Ready to go out', emoji: '🔥', color: 'text-orange-400', bg: 'bg-orange-400/10', border: 'border-orange-400/20' },
  { value: 'Just vibing', emoji: '😎', color: 'text-purple-400', bg: 'bg-purple-400/10', border: 'border-purple-400/20' },
  { value: 'Looking for my person', emoji: '❤️', color: 'text-pink-400', bg: 'bg-pink-400/10', border: 'border-pink-400/20' },
  { value: 'Down for whatever', emoji: '⚡', color: 'text-gold', bg: 'bg-gold/10', border: 'border-gold/20' },
];
