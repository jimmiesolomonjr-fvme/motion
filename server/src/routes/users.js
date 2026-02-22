import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { authenticate } from '../middleware/auth.js';
import { upload, toDataUrl } from '../middleware/upload.js';
import { getDistanceMiles } from '../utils/distance.js';
import { validateAge } from '../utils/validators.js';

const router = Router();
const prisma = new PrismaClient();

const PROFILE_PROMPTS = [
  'My idea of motion is…',
  'A Stepper should always…',
  'I feel spoiled when…',
  "I'm outside at…",
  'My favorite flex is…',
  'Green flag I love…',
  "I'm attracted to…",
];

// Get referral info
router.get('/referral', authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { referralCode: true },
    });
    const referralCount = await prisma.user.count({
      where: { referredBy: user.referralCode },
    });
    res.json({ referralCode: user.referralCode, referralCount });
  } catch (error) {
    console.error('Referral info error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create/update profile (onboarding)
router.post('/profile', authenticate, async (req, res) => {
  try {
    const { displayName, bio, age, city, lookingFor } = req.body;

    if (!displayName || !age || !city) {
      return res.status(400).json({ error: 'Display name, age, and city are required' });
    }

    const parsedAge = parseInt(age);
    if (!validateAge(parsedAge)) {
      return res.status(400).json({ error: 'Age must be between 18 and 99' });
    }

    const profile = await prisma.profile.upsert({
      where: { userId: req.userId },
      update: { displayName, bio, age: parsedAge, city, lookingFor },
      create: { userId: req.userId, displayName, bio, age: parsedAge, city, lookingFor },
    });

    res.json(profile);
  } catch (error) {
    console.error('Profile create error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Upload photos
router.post('/photos', authenticate, upload.array('photos', 6), async (req, res) => {
  try {
    const profile = await prisma.profile.findUnique({ where: { userId: req.userId } });
    if (!profile) {
      return res.status(400).json({ error: 'Create a profile first' });
    }

    const existingPhotos = profile.photos || [];
    const newPhotos = req.files.map((f) =>
      f.buffer ? toDataUrl(f) : `/uploads/${f.filename}`
    );
    const allPhotos = [...existingPhotos, ...newPhotos].slice(0, 6);

    const updated = await prisma.profile.update({
      where: { userId: req.userId },
      data: { photos: allPhotos },
    });

    // Auto-dismiss "add photo" notification if now >= 2 photos
    if (allPhotos.length >= 2) {
      prisma.notification.deleteMany({
        where: {
          userId: req.userId,
          type: 'profile_incomplete',
          readAt: null,
          data: { path: ['action'], equals: 'add_photo' },
        },
      }).catch(() => {});
    }

    res.json(updated);
  } catch (error) {
    console.error('Photo upload error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete a photo
router.delete('/photos/:index', authenticate, async (req, res) => {
  try {
    const profile = await prisma.profile.findUnique({ where: { userId: req.userId } });
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    const photos = [...(profile.photos || [])];
    const index = parseInt(req.params.index);
    if (index < 0 || index >= photos.length) {
      return res.status(400).json({ error: 'Invalid photo index' });
    }

    photos.splice(index, 1);
    const updated = await prisma.profile.update({
      where: { userId: req.userId },
      data: { photos },
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get own profile
router.get('/profile', authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      include: { profile: true, profilePrompts: { orderBy: { position: 'asc' } } },
    });
    if (!user?.profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    const referralCount = user.referralCode
      ? await prisma.user.count({ where: { referredBy: user.referralCode } })
      : 0;
    res.json({ ...user.profile, role: user.role, isPremium: user.isPremium, isVerified: user.isVerified, profilePrompts: user.profilePrompts, isPlug: referralCount > 0 });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user profile by ID
router.get('/profile/:userId', authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.userId },
      include: { profile: true, profilePrompts: { orderBy: { position: 'asc' } } },
    });
    if (!user?.profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    const referralCount = user.referralCode
      ? await prisma.user.count({ where: { referredBy: user.referralCode } })
      : 0;
    res.json({
      ...user.profile,
      role: user.role,
      isPremium: user.isPremium,
      isVerified: user.isVerified,
      lastOnline: user.lastOnline,
      profilePrompts: user.profilePrompts,
      isPlug: referralCount > 0,
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Update location
router.put('/location', authenticate, async (req, res) => {
  try {
    const { lat, lng } = req.body;
    await prisma.user.update({
      where: { id: req.userId },
      data: { locationLat: parseFloat(lat), locationLng: parseFloat(lng), lastOnline: new Date() },
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Browse feed
router.get('/feed', authenticate, async (req, res) => {
  try {
    const { sort = 'newest', maxDistance, onlineOnly, minAge, maxAge, page: pageStr = '0', limit: limitStr = '12' } = req.query;
    const page = Math.max(0, parseInt(pageStr) || 0);
    const limit = Math.min(50, Math.max(1, parseInt(limitStr) || 12));
    const currentUser = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, role: true, locationLat: true, locationLng: true },
    });

    // Get blocked user IDs (both directions)
    const blocks = await prisma.block.findMany({
      where: { OR: [{ blockerId: req.userId }, { blockedId: req.userId }] },
    });
    const blockedIds = blocks.map((b) => (b.blockerId === req.userId ? b.blockedId : b.blockerId));

    // Get admin-hidden pairs (both directions)
    const hiddenPairs = await prisma.hiddenPair.findMany({
      where: { OR: [{ user1Id: req.userId }, { user2Id: req.userId }] },
    });
    const hiddenIds = hiddenPairs.map((h) => (h.user1Id === req.userId ? h.user2Id : h.user1Id));

    const excludeIds = [...new Set([req.userId, ...blockedIds, ...hiddenIds])];

    // Check if dummy users should be shown
    const showDummySetting = await prisma.appSetting.findUnique({ where: { key: 'showDummyUsers' } });
    const hideDummies = showDummySetting?.value !== 'true';

    // Get already-liked user IDs (for hasLiked flag)
    const likes = await prisma.like.findMany({
      where: { likerId: req.userId },
      select: { likedId: true },
    });
    const likedIds = new Set(likes.map((l) => l.likedId));

    // Show opposite role in feed
    const targetRole = currentUser.role === 'STEPPER' ? 'BADDIE' : 'STEPPER';

    // Build profile filter — use `is: { age }` when filtering, `isNot: null` otherwise
    const ageFilter = {};
    if (minAge) ageFilter.gte = parseInt(minAge);
    if (maxAge) ageFilter.lte = parseInt(maxAge);

    const profileWhere = Object.keys(ageFilter).length > 0
      ? { is: { age: ageFilter } }
      : { isNot: null };

    const users = await prisma.user.findMany({
      where: {
        id: { notIn: excludeIds },
        role: targetRole,
        isBanned: false,
        isHidden: false,
        ...(hideDummies && { isDummy: false }),
        profile: profileWhere,
        ...(onlineOnly === 'true' && {
          lastOnline: { gte: new Date(Date.now() - 5 * 60 * 1000) },
        }),
      },
      include: { profile: true },
      orderBy: sort === 'newest' ? { createdAt: 'desc' } : { lastOnline: 'desc' },
      take: 50,
    });

    // Batch referral counts for isPlug
    const referralCodes = users.map((u) => u.referralCode).filter(Boolean);
    const referralCounts = referralCodes.length > 0
      ? await prisma.user.groupBy({ by: ['referredBy'], where: { referredBy: { in: referralCodes } }, _count: true })
      : [];
    const referralCountMap = new Map(referralCounts.map((r) => [r.referredBy, r._count]));

    // Batch vibe score calculation — fetch once instead of per-user
    const myAnswers = await prisma.vibeAnswer.findMany({ where: { userId: req.userId } });
    const myAnswerMap = new Map(myAnswers.map((a) => [a.questionId, a.answer]));

    const feedUserIds = users.map((u) => u.id);
    const allTheirAnswers = feedUserIds.length > 0
      ? await prisma.vibeAnswer.findMany({ where: { userId: { in: feedUserIds } } })
      : [];
    const answersByUser = new Map();
    for (const a of allTheirAnswers) {
      if (!answersByUser.has(a.userId)) answersByUser.set(a.userId, []);
      answersByUser.get(a.userId).push(a);
    }

    // Calculate distances and vibe scores
    let results = users.map((user) => {
      let distance = null;
      if (currentUser.locationLat && currentUser.locationLng && user.locationLat && user.locationLng) {
        distance = Math.round(
          getDistanceMiles(currentUser.locationLat, currentUser.locationLng, user.locationLat, user.locationLng)
        );
      }

      // Calculate vibe score from pre-fetched data
      const theirAnswers = answersByUser.get(user.id) || [];
      let shared = 0;
      let matching = 0;
      for (const a of theirAnswers) {
        if (myAnswerMap.has(a.questionId)) {
          shared++;
          if (myAnswerMap.get(a.questionId) === a.answer) matching++;
        }
      }
      const vibeScore = shared > 0 ? Math.round((matching / shared) * 100) : null;

      return {
        id: user.id,
        role: user.role,
        isPremium: user.isPremium,
        isVerified: user.isVerified,
        lastOnline: user.lastOnline,
        profile: {
          ...user.profile,
          photos: user.profile?.photos?.[0] ? [user.profile.photos[0]] : [],
        },
        distance,
        vibeScore,
        hasLiked: likedIds.has(user.id),
        isPlug: user.referralCode ? (referralCountMap.get(user.referralCode) || 0) > 0 : false,
      };
    });

    // Filter by distance
    if (maxDistance && currentUser.locationLat) {
      const maxDist = parseInt(maxDistance);
      results = results.filter((u) => u.distance !== null && u.distance <= maxDist);
    }

    // Sort by distance if requested
    if (sort === 'distance') {
      results.sort((a, b) => (a.distance ?? 9999) - (b.distance ?? 9999));
    } else if (sort === 'vibe') {
      results.sort((a, b) => (b.vibeScore ?? 0) - (a.vibeScore ?? 0));
    }

    // Paginate results
    const start = page * limit;
    const paginatedResults = results.slice(start, start + limit);
    const hasMore = start + limit < results.length;

    res.json({ users: paginatedResults, hasMore, page });
  } catch (error) {
    console.error('Feed error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get available profile prompts
router.get('/prompts', authenticate, (req, res) => {
  res.json({ prompts: PROFILE_PROMPTS });
});

// Get user's answered prompts
router.get('/prompts/mine', authenticate, async (req, res) => {
  try {
    const prompts = await prisma.profilePrompt.findMany({
      where: { userId: req.userId },
      orderBy: { position: 'asc' },
    });
    res.json(prompts);
  } catch (error) {
    console.error('Get prompts error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Save profile prompts (max 3)
router.put('/prompts', authenticate, async (req, res) => {
  try {
    const { prompts } = req.body;
    if (!Array.isArray(prompts) || prompts.length > 3) {
      return res.status(400).json({ error: 'Max 3 prompts allowed' });
    }

    // Validate prompt text is from allowed list
    for (const p of prompts) {
      if (!PROFILE_PROMPTS.includes(p.prompt) || !p.answer?.trim()) {
        return res.status(400).json({ error: 'Invalid prompt or empty answer' });
      }
    }

    // Delete old and create new in transaction
    await prisma.$transaction(async (tx) => {
      await tx.profilePrompt.deleteMany({ where: { userId: req.userId } });
      for (let i = 0; i < prompts.length; i++) {
        await tx.profilePrompt.create({
          data: {
            userId: req.userId,
            prompt: prompts[i].prompt,
            answer: prompts[i].answer.trim(),
            position: i,
          },
        });
      }
    });

    const saved = await prisma.profilePrompt.findMany({
      where: { userId: req.userId },
      orderBy: { position: 'asc' },
    });

    // Auto-dismiss "add prompts" notification if prompts saved
    if (saved.length > 0) {
      prisma.notification.deleteMany({
        where: {
          userId: req.userId,
          type: 'profile_incomplete',
          readAt: null,
          data: { path: ['action'], equals: 'add_prompts' },
        },
      }).catch(() => {});
    }

    res.json(saved);
  } catch (error) {
    console.error('Save prompts error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Track profile view
router.post('/profile/:userId/view', authenticate, async (req, res) => {
  try {
    const viewedId = req.params.userId;
    // Skip own profile
    if (viewedId === req.userId) return res.json({ success: true });

    // Throttle: 1 view per viewer per viewed per 24h
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const existing = await prisma.profileView.findFirst({
      where: { viewerId: req.userId, viewedId, createdAt: { gte: since } },
    });
    if (existing) return res.json({ success: true, throttled: true });

    await prisma.profileView.create({
      data: { viewerId: req.userId, viewedId },
    });

    // Get viewer name for notification
    const viewer = await prisma.profile.findUnique({ where: { userId: req.userId } });
    const viewerName = viewer?.displayName || 'Someone';

    // Create notification
    const notification = await prisma.notification.create({
      data: {
        userId: viewedId,
        type: 'profile_view',
        title: 'New Profile View',
        body: `${viewerName} viewed your profile`,
        data: { viewerId: req.userId, viewerName },
      },
    });

    // Emit socket event
    const { io } = await import('../../server.js');
    io.to(viewedId).emit('notification', notification);

    res.json({ success: true });
  } catch (error) {
    console.error('Profile view error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get notification preferences
router.get('/notifications', authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { notificationsEnabled: true },
    });
    res.json({ notificationsEnabled: user?.notificationsEnabled ?? true });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Update notification preferences
router.put('/notifications', authenticate, async (req, res) => {
  try {
    const { enabled } = req.body;
    await prisma.user.update({
      where: { id: req.userId },
      data: { notificationsEnabled: !!enabled },
    });
    res.json({ notificationsEnabled: !!enabled });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete account
router.delete('/account', authenticate, async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'Password required' });

    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Incorrect password' });

    const userId = req.userId;

    await prisma.$transaction(async (tx) => {
      // Delete messages sent by user
      await tx.message.deleteMany({ where: { senderId: userId } });
      // Delete conversations (remaining messages cascade)
      await tx.conversation.deleteMany({ where: { OR: [{ user1Id: userId }, { user2Id: userId }] } });
      // Delete likes
      await tx.like.deleteMany({ where: { OR: [{ likerId: userId }, { likedId: userId }] } });
      // Delete matches
      await tx.match.deleteMany({ where: { OR: [{ user1Id: userId }, { user2Id: userId }] } });
      // Delete blocks
      await tx.block.deleteMany({ where: { OR: [{ blockerId: userId }, { blockedId: userId }] } });
      // Delete reports
      await tx.report.deleteMany({ where: { OR: [{ reporterId: userId }, { reportedId: userId }] } });
      // Delete move interests for user's moves, then user's moves
      const userMoves = await tx.move.findMany({ where: { stepperId: userId }, select: { id: true } });
      if (userMoves.length) {
        await tx.moveInterest.deleteMany({ where: { moveId: { in: userMoves.map((m) => m.id) } } });
      }
      await tx.move.deleteMany({ where: { stepperId: userId } });
      // Delete move interests where user is the baddie
      await tx.moveInterest.deleteMany({ where: { baddieId: userId } });
      // Delete hidden pairs
      await tx.hiddenPair.deleteMany({ where: { OR: [{ user1Id: userId }, { user2Id: userId }] } });
      // Delete user (Profile, VibeAnswer, Subscription cascade automatically)
      await tx.user.delete({ where: { id: userId } });
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
