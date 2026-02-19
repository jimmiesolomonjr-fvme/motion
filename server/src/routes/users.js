import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth.js';
import { upload, toDataUrl } from '../middleware/upload.js';
import { getDistanceMiles } from '../utils/distance.js';
import { validateAge } from '../utils/validators.js';

const router = Router();
const prisma = new PrismaClient();

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
      include: { profile: true },
    });
    if (!user?.profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    res.json({ ...user.profile, role: user.role, isPremium: user.isPremium, isVerified: user.isVerified });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user profile by ID
router.get('/profile/:userId', authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.userId },
      include: { profile: true },
    });
    if (!user?.profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    res.json({
      ...user.profile,
      role: user.role,
      isPremium: user.isPremium,
      isVerified: user.isVerified,
      lastOnline: user.lastOnline,
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
    const { sort = 'newest', maxDistance, onlineOnly } = req.query;
    const currentUser = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, role: true, locationLat: true, locationLng: true },
    });

    // Get blocked user IDs (both directions)
    const blocks = await prisma.block.findMany({
      where: { OR: [{ blockerId: req.userId }, { blockedId: req.userId }] },
    });
    const blockedIds = blocks.map((b) => (b.blockerId === req.userId ? b.blockedId : b.blockerId));

    const excludeIds = [...new Set([req.userId, ...blockedIds])];

    // Show opposite role in feed
    const targetRole = currentUser.role === 'STEPPER' ? 'BADDIE' : 'STEPPER';

    const users = await prisma.user.findMany({
      where: {
        id: { notIn: excludeIds },
        role: targetRole,
        isBanned: false,
        profile: { isNot: null },
        ...(onlineOnly === 'true' && {
          lastOnline: { gte: new Date(Date.now() - 5 * 60 * 1000) },
        }),
      },
      include: { profile: true },
      orderBy: sort === 'newest' ? { createdAt: 'desc' } : { lastOnline: 'desc' },
      take: 50,
    });

    // Calculate distances and vibe scores
    let results = await Promise.all(
      users.map(async (user) => {
        let distance = null;
        if (currentUser.locationLat && currentUser.locationLng && user.locationLat && user.locationLng) {
          distance = Math.round(
            getDistanceMiles(currentUser.locationLat, currentUser.locationLng, user.locationLat, user.locationLng)
          );
        }

        // Calculate vibe score
        const myAnswers = await prisma.vibeAnswer.findMany({ where: { userId: req.userId } });
        const theirAnswers = await prisma.vibeAnswer.findMany({ where: { userId: user.id } });
        const myMap = new Map(myAnswers.map((a) => [a.questionId, a.answer]));
        let shared = 0;
        let matching = 0;
        for (const a of theirAnswers) {
          if (myMap.has(a.questionId)) {
            shared++;
            if (myMap.get(a.questionId) === a.answer) matching++;
          }
        }
        const vibeScore = shared > 0 ? Math.round((matching / shared) * 100) : null;

        return {
          id: user.id,
          role: user.role,
          isPremium: user.isPremium,
          isVerified: user.isVerified,
          lastOnline: user.lastOnline,
          profile: user.profile,
          distance,
          vibeScore,
        };
      })
    );

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

    res.json(results);
  } catch (error) {
    console.error('Feed error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
