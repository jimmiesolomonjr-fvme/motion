/**
 * Feature Updates Config
 * ─────────────────────
 * When you ship new features:
 *   1. Bump APP_VERSION in utils/constants.js (e.g. '2.0.0' → '2.1.0')
 *   2. Add a new entry below with that version as the key
 *   3. That's it — the overlay auto-shows for anyone who hasn't seen this version
 *
 * Icon colors you can use:
 *   gold      → 'text-gold'      / 'bg-gold/10'
 *   purple    → 'text-purple-400' / 'bg-purple-400/10'
 *   blue      → 'text-blue-400'  / 'bg-blue-400/10'
 *   green     → 'text-green-400' / 'bg-green-400/10'
 *   pink      → 'text-pink-400'  / 'bg-pink-400/10'
 *   amber     → 'text-amber-400' / 'bg-amber-400/10'
 *   red       → 'text-red-400'   / 'bg-red-400/10'
 *
 * Available icons (import from lucide-react):
 *   Ruler, Moon, Video, Tag, Heart, Shield, Zap, Crown, Star,
 *   MessageCircle, Bell, Camera, Music, MapPin, Flame, Users, etc.
 */
import { Ruler, Moon, Video, Tag } from 'lucide-react';

const FEATURE_UPDATES = {
  '2.0.0': {
    subtitle: "We've been cooking. Here's what's fresh.",
    features: [
      {
        icon: Ruler,
        color: 'text-gold',
        bg: 'bg-gold/10',
        title: 'Height, Weight & Occupation',
        description: 'New profile fields so people get the full picture.',
      },
      {
        icon: Moon,
        color: 'text-purple-400',
        bg: 'bg-purple-400/10',
        title: 'AfterDark Vibe Questions',
        description: 'Spicy new questions for late-night vibes.',
      },
      {
        icon: Video,
        color: 'text-blue-400',
        bg: 'bg-blue-400/10',
        title: 'Video Stories',
        description: 'Share short video stories that disappear in 24 hours.',
      },
      {
        icon: Tag,
        color: 'text-green-400',
        bg: 'bg-green-400/10',
        title: 'Looking For Tags',
        description: "Tags to show exactly what you're looking for.",
      },
    ],
  },

  // ── Example for next release ──
  // '2.1.0': {
  //   subtitle: 'Fresh drop just landed.',
  //   features: [
  //     {
  //       icon: Zap,
  //       color: 'text-amber-400',
  //       bg: 'bg-amber-400/10',
  //       title: 'Super Likes',
  //       description: 'Stand out with a super like that notifies them instantly.',
  //     },
  //   ],
  // },
};

export default FEATURE_UPDATES;
