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
import { Ruler, Moon, Video, Tag, Shield, Users, Sparkles, Music, Download, RefreshCw, Bell, Mail, Volume2, Activity, SlidersHorizontal, Flame, Edit3, Crop, Heart, MapPin, Zap, MessageCircle, Share2, Target, Gamepad2, Eye, EyeOff, Mic, KeyRound, WifiOff, Image, Bot, Gauge } from 'lucide-react';

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

  '2.1.0': {
    subtitle: 'New updates just dropped.',
    features: [
      {
        icon: Shield,
        color: 'text-gold',
        bg: 'bg-gold/10',
        title: 'Tag Limits',
        description: 'Looking-for tags are now capped at 5 with a live counter.',
      },
      {
        icon: Sparkles,
        color: 'text-purple-400',
        bg: 'bg-purple-400/10',
        title: 'Improved Onboarding',
        description: 'Step 3 is cleaner — describe what you want, then pick your tags.',
      },
      {
        icon: Users,
        color: 'text-blue-400',
        bg: 'bg-blue-400/10',
        title: 'Group Moves',
        description: 'Steppers can now select multiple Baddies for GROUP category moves.',
      },
    ],
  },

  '2.2.0': {
    subtitle: 'The vibes just got moodier.',
    features: [
      {
        icon: Moon,
        color: 'text-purple-400',
        bg: 'bg-purple-400/10',
        title: 'AfterDark Card Glow-Up',
        description: 'AfterDark vibe questions now have a purple gradient, glow border, and moon icon.',
      },
    ],
  },

  '2.3.0': {
    subtitle: 'Your profile just got a soundtrack.',
    features: [
      {
        icon: Music,
        color: 'text-purple-400',
        bg: 'bg-purple-400/10',
        title: 'Add Songs with Apple Music',
        description: 'Search and add songs to your profile with album art and 30-second previews.',
      },
    ],
  },

  '2.4.0': {
    subtitle: 'Motion now feels like a real app.',
    features: [
      {
        icon: Download,
        color: 'text-gold',
        bg: 'bg-gold/10',
        title: 'Install to Home Screen',
        description: 'Get a prompt to add Motion to your home screen for the full app experience.',
      },
      {
        icon: RefreshCw,
        color: 'text-blue-400',
        bg: 'bg-blue-400/10',
        title: 'Auto Update Checker',
        description: 'A banner appears when a new version drops so you never miss an update.',
      },
    ],
  },

  '2.5.0': {
    subtitle: 'Never miss a thing.',
    features: [
      {
        icon: Bell,
        color: 'text-gold',
        bg: 'bg-gold/10',
        title: 'Unified Notifications',
        description: 'Vibe questions, install prompts, and new features now show in your notification center.',
      },
      {
        icon: Sparkles,
        color: 'text-purple-400',
        bg: 'bg-purple-400/10',
        title: 'Smart Notification Cleanup',
        description: 'Actionable notifications auto-clear when you complete the action.',
      },
    ],
  },

  '2.6.0': {
    subtitle: 'Reaching out just got official.',
    features: [
      {
        icon: Mail,
        color: 'text-gold',
        bg: 'bg-gold/10',
        title: 'Email Campaigns',
        description: 'Admins can now send branded emails to users directly from the admin panel.',
      },
    ],
  },
  '2.7.0': {
    subtitle: 'Profiles now have a soundtrack.',
    features: [
      {
        icon: Volume2,
        color: 'text-purple-400',
        bg: 'bg-purple-400/10',
        title: 'Autoplay Profile Songs',
        description: 'Songs now play automatically when you visit a profile. Toggle it off in Settings.',
      },
    ],
  },
  '2.8.0': {
    subtitle: 'Big moves, better vibes.',
    features: [
      {
        icon: Activity,
        color: 'text-green-400',
        bg: 'bg-green-400/10',
        title: 'Recently Active Feed',
        description: 'See who\'s active now, right at the top of your feed.',
      },
      {
        icon: SlidersHorizontal,
        color: 'text-gold',
        bg: 'bg-gold/10',
        title: 'Advanced Filters',
        description: 'Filter by tags, distance, and age in one place.',
      },
      {
        icon: Flame,
        color: 'text-pink-400',
        bg: 'bg-pink-400/10',
        title: 'Baddie Move Proposals',
        description: 'Baddies can now propose dates for Steppers to compete for.',
      },
      {
        icon: Moon,
        color: 'text-purple-400',
        bg: 'bg-purple-400/10',
        title: 'AfterDark Unlock',
        description: 'Unlock spicy questions after 50 vibes.',
      },
    ],
  },
  '2.9.0': {
    subtitle: 'Polish pass — edit, crop, play.',
    features: [
      {
        icon: Edit3,
        color: 'text-gold',
        bg: 'bg-gold/10',
        title: 'Edit Your Moves',
        description: 'Update your Move within 10 minutes of posting.',
      },
      {
        icon: Crop,
        color: 'text-blue-400',
        bg: 'bg-blue-400/10',
        title: 'Photo Cropping',
        description: 'Crop photos perfectly before uploading anywhere.',
      },
      {
        icon: Music,
        color: 'text-purple-400',
        bg: 'bg-purple-400/10',
        title: 'Smoother Song Autoplay',
        description: 'Profile songs play reliably with a visual cue.',
      },
    ],
  },
  '2.10.0': {
    subtitle: 'Date ideas, curated by Motion.',
    features: [
      {
        icon: Sparkles,
        color: 'text-gold',
        bg: 'bg-gold/10',
        title: 'Community Moves',
        description: 'Platform-curated date ideas across NYC & NJ. Both Steppers and Baddies can tap "I\'m Down."',
      },
      {
        icon: Heart,
        color: 'text-pink-400',
        bg: 'bg-pink-400/10',
        title: 'Move Matching',
        description: 'When a Stepper and Baddie both express interest in the same Community Move, you match instantly.',
      },
      {
        icon: MapPin,
        color: 'text-blue-400',
        bg: 'bg-blue-400/10',
        title: '20 Date Ideas',
        description: 'Rooftop bars, jazz clubs, cooking classes, comedy nights & more — fresh ideas dropping regularly.',
      },
    ],
  },
  '2.11.0': {
    subtitle: 'The feed just came alive.',
    features: [
      {
        icon: Sparkles,
        color: 'text-gold',
        bg: 'bg-gold/10',
        title: 'Animated Feed',
        description: 'Cards spring in with glow borders, staggered content reveals, and Ken Burns photo zoom.',
      },
      {
        icon: Heart,
        color: 'text-pink-400',
        bg: 'bg-pink-400/10',
        title: 'Double-Tap to Like',
        description: 'Double-tap any photo for a gold heart burst — just like you\'d expect.',
      },
    ],
  },
  '2.12.0': {
    subtitle: 'Smoother, faster, more addictive.',
    features: [
      {
        icon: Zap,
        color: 'text-gold',
        bg: 'bg-gold/10',
        title: 'Instant Likes',
        description: 'Likes and unlikes update instantly — no more waiting for the server.',
      },
      {
        icon: Heart,
        color: 'text-pink-400',
        bg: 'bg-pink-400/10',
        title: 'Match Celebration',
        description: 'Confetti burst, profile photo reveal, and a Send Message button when you match.',
      },
      {
        icon: MessageCircle,
        color: 'text-blue-400',
        bg: 'bg-blue-400/10',
        title: 'Unread Dots Fixed',
        description: 'Gold unread indicators now work correctly on all conversations.',
      },
      {
        icon: Sparkles,
        color: 'text-purple-400',
        bg: 'bg-purple-400/10',
        title: 'Performance Boost',
        description: 'Lazy-loaded pages, skeleton loaders, and smoother transitions throughout.',
      },
    ],
  },
  '2.13.0': {
    subtitle: 'Polish pass — smoother, smarter, more complete.',
    features: [
      {
        icon: Users,
        color: 'text-gold',
        bg: 'bg-gold/10',
        title: 'Better Empty States',
        description: 'Feed, messages, and moves now show helpful actions when there\'s nothing to display.',
      },
      {
        icon: Share2,
        color: 'text-amber-400',
        bg: 'bg-amber-400/10',
        title: 'Invite Friends',
        description: 'Referral section auto-expanded with Plug badge progress — invite 3 friends to earn it.',
      },
      {
        icon: Target,
        color: 'text-purple-400',
        bg: 'bg-purple-400/10',
        title: 'Profile Completion Ring',
        description: 'See exactly how complete your profile is and what\'s missing at a glance.',
      },
    ],
  },
  '2.14.0': {
    subtitle: 'A new game just dropped.',
    features: [
      {
        icon: Flame,
        color: 'text-pink-400',
        bg: 'bg-pink-400/10',
        title: 'Smash Marry Friendzone',
        description: 'New game! Rate 3 random profiles as Smash, Marry, or Friendzone. Play up to 3 rounds per day.',
      },
    ],
  },
  '2.15.0': {
    subtitle: 'Profiles just got real.',
    features: [
      {
        icon: Mic,
        color: 'text-purple-400',
        bg: 'bg-purple-400/10',
        title: 'Voice Intros',
        description: 'Record a 15-second voice intro on your profile. Let people hear you before they match.',
      },
      {
        icon: Eye,
        color: 'text-green-400',
        bg: 'bg-green-400/10',
        title: 'Live Viewing Pulse',
        description: "Get a real-time glow when someone is on your profile right now. Creates urgency and sparks connection.",
      },
    ],
  },
  '2.16.0': {
    subtitle: 'SMF just got real + password recovery.',
    features: [
      {
        icon: Flame,
        color: 'text-orange-400',
        bg: 'bg-orange-400/10',
        title: 'SMF Inbox Messages',
        description: 'Smash or Marry picks now send a real message to their inbox so you can start chatting.',
      },
      {
        icon: KeyRound,
        color: 'text-gold',
        bg: 'bg-gold/10',
        title: 'Forgot Password',
        description: 'Lost your password? Reset it via email right from the login screen.',
      },
    ],
  },
  '2.17.0': {
    subtitle: 'Chat that just works.',
    features: [
      {
        icon: WifiOff,
        color: 'text-amber-400',
        bg: 'bg-amber-400/10',
        title: 'Auto-Reconnect',
        description: 'Socket stays alive even when your token expires. No more random disconnects.',
      },
      {
        icon: MessageCircle,
        color: 'text-blue-400',
        bg: 'bg-blue-400/10',
        title: 'Smarter Message Delivery',
        description: 'Messages queue up while reconnecting and send automatically when you\'re back online.',
      },
      {
        icon: Mic,
        color: 'text-purple-400',
        bg: 'bg-purple-400/10',
        title: 'Voice Notes Fixed',
        description: 'Voice messages now appear instantly in the chat for both sender and receiver.',
      },
    ],
  },
  '2.18.0': {
    subtitle: 'Photos load faster than ever.',
    features: [
      {
        icon: Image,
        color: 'text-green-400',
        bg: 'bg-green-400/10',
        title: 'Smart Photo Compression',
        description: 'All photos are now auto-compressed and resized before upload — faster loading, less data usage.',
      },
      {
        icon: Zap,
        color: 'text-gold',
        bg: 'bg-gold/10',
        title: 'Faster Feed & Profiles',
        description: 'Images are ~10x smaller without visible quality loss. Scrolling is buttery smooth.',
      },
    ],
  },
  '2.19.0': {
    subtitle: 'Stay in the loop, even offline.',
    features: [
      {
        icon: Mail,
        color: 'text-gold',
        bg: 'bg-gold/10',
        title: 'Email Notifications',
        description: 'Get an email when someone views your profile, likes you, or sends you a message while you\'re away.',
      },
      {
        icon: Bell,
        color: 'text-blue-400',
        bg: 'bg-blue-400/10',
        title: 'Smart Sending',
        description: 'Emails only send when you\'re offline — no spam. Toggle it off anytime in Settings.',
      },
    ],
  },
  '2.20.0': {
    subtitle: 'Your inbox, organized.',
    features: [
      {
        icon: MessageCircle,
        color: 'text-gold',
        bg: 'bg-gold/10',
        title: 'Your Turn / Sent Tabs',
        description: 'Messages are now split into "Your Turn" and "Sent" so you never miss a reply.',
      },
    ],
  },
  '2.21.0': {
    subtitle: 'SMF notifications, upgraded.',
    features: [
      {
        icon: Bot,
        color: 'text-gold',
        bg: 'bg-gold/10',
        title: 'SMF Messages from Motion',
        description: 'Smash & Marry picks now send a notification from Motion telling you who picked you and what they chose.',
      },
      {
        icon: Mail,
        color: 'text-blue-400',
        bg: 'bg-blue-400/10',
        title: 'SMF Email Alerts',
        description: 'Get an email when someone picks Smash or Marry on you while you\'re away.',
      },
    ],
  },
  '2.22.0': {
    subtitle: 'Your feed, your rules.',
    features: [
      {
        icon: EyeOff,
        color: 'text-gold',
        bg: 'bg-gold/10',
        title: 'Hide Users',
        description: 'Not interested? Hide anyone from your feed, SMF, and matches without blocking them. Manage hidden users in Settings.',
      },
    ],
  },
  '2.23.0': {
    subtitle: 'Show your vibe before you swipe.',
    features: [
      {
        icon: Activity,
        color: 'text-purple-400',
        bg: 'bg-purple-400/10',
        title: 'Date Energy',
        description: 'Set your mood — "Low-key tonight," "Ready to go out," and more. It shows on your card so people know where your head is at.',
      },
    ],
  },
  '2.24.0': {
    subtitle: 'Images load way faster now.',
    features: [
      {
        icon: Gauge,
        color: 'text-green-400',
        bg: 'bg-green-400/10',
        title: 'CDN Image Optimization',
        description: 'All photos are now served at the exact size needed — avatars, feed cards, stories, and chat images load faster with less data.',
      },
    ],
  },
  '2.25.0': {
    subtitle: 'SMF messages got a glow-up.',
    features: [
      {
        icon: Bot,
        color: 'text-gold',
        bg: 'bg-gold/10',
        title: 'System Messages Redesign',
        description: 'SMF picks now appear as system messages from Motion with a "View Profile" link to see who picked you.',
      },
    ],
  },
};

export default FEATURE_UPDATES;
