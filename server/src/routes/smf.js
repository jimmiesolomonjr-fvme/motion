import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

const MAX_ROUNDS_PER_DAY = 3;
const VALID_PICKS = ['smash', 'marry', 'friendzone'];

function todayMidnightUTC() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function tomorrowMidnightUTC() {
  const d = todayMidnightUTC();
  d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

// GET /api/smf/round — get 3 random opposite-role profiles for a new round
router.get('/round', authenticate, async (req, res) => {
  try {
    const midnight = todayMidnightUTC();

    const roundsToday = await prisma.smfRound.count({
      where: { playerId: req.userId, createdAt: { gte: midnight } },
    });

    if (roundsToday >= MAX_ROUNDS_PER_DAY) {
      return res.json({ limited: true, resetsAt: tomorrowMidnightUTC(), roundsPlayed: roundsToday, roundsLeft: 0 });
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { role: true },
    });

    const oppositeRole = currentUser.role === 'STEPPER' ? 'BADDIE' : 'STEPPER';

    // Blocked IDs (both directions)
    const blocks = await prisma.block.findMany({
      where: { OR: [{ blockerId: req.userId }, { blockedId: req.userId }] },
    });
    const blockedIds = blocks.map((b) => (b.blockerId === req.userId ? b.blockedId : b.blockerId));

    // Hidden pairs (both directions)
    const hiddenPairs = await prisma.hiddenPair.findMany({
      where: { OR: [{ user1Id: req.userId }, { user2Id: req.userId }] },
    });
    const hiddenIds = hiddenPairs.map((h) => (h.user1Id === req.userId ? h.user2Id : h.user1Id));

    // Already picked today — prevent repeats within the same day
    const todayRounds = await prisma.smfRound.findMany({
      where: { playerId: req.userId, createdAt: { gte: midnight } },
      include: { picks: { select: { targetId: true } } },
    });
    const pickedTodayIds = todayRounds.flatMap((r) => r.picks.map((p) => p.targetId));

    // Check dummy user visibility
    const showDummySetting = await prisma.appSetting.findUnique({ where: { key: 'showDummyUsers' } });
    const hideDummies = showDummySetting?.value !== 'true';

    const excludeIds = [...new Set([req.userId, ...blockedIds, ...hiddenIds, ...pickedTodayIds])];

    // Fetch a pool of candidates and shuffle to pick 3
    const candidates = await prisma.user.findMany({
      where: {
        role: oppositeRole,
        isBanned: false,
        isHidden: false,
        id: { notIn: excludeIds },
        profile: { isNot: null },
        ...(hideDummies ? { isDummy: false } : {}),
      },
      select: {
        id: true,
        profile: { select: { displayName: true, photos: true, age: true, city: true } },
      },
      take: 50,
    });

    // Shuffle and pick 3
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }

    const users = candidates.slice(0, 3).map((u) => ({
      id: u.id,
      displayName: u.profile.displayName,
      photo: Array.isArray(u.profile.photos) && u.profile.photos.length > 0 ? u.profile.photos[0] : null,
      age: u.profile.age,
      city: u.profile.city,
    }));

    if (users.length < 3) {
      return res.json({ limited: true, resetsAt: tomorrowMidnightUTC(), roundsPlayed: roundsToday, roundsLeft: 0, notEnoughUsers: true });
    }

    res.json({ users, roundsPlayed: roundsToday, roundsLeft: MAX_ROUNDS_PER_DAY - roundsToday });
  } catch (err) {
    console.error('SMF round error:', err);
    res.status(500).json({ error: 'Failed to load round' });
  }
});

// POST /api/smf/round — submit picks for a round
router.post('/round', authenticate, async (req, res) => {
  try {
    const { picks } = req.body;

    // Validate picks structure
    if (!Array.isArray(picks) || picks.length !== 3) {
      return res.status(400).json({ error: 'Exactly 3 picks required' });
    }

    const userIds = picks.map((p) => p.userId);
    const pickValues = picks.map((p) => p.pick);

    // Each pick must be valid
    if (!pickValues.every((p) => VALID_PICKS.includes(p))) {
      return res.status(400).json({ error: 'Invalid pick value' });
    }

    // Each category used exactly once
    if (new Set(pickValues).size !== 3) {
      return res.status(400).json({ error: 'Each category must be used exactly once' });
    }

    // No duplicate user IDs
    if (new Set(userIds).size !== 3) {
      return res.status(400).json({ error: 'Duplicate user IDs' });
    }

    // Race condition guard: check daily limit again
    const midnight = todayMidnightUTC();
    const roundsToday = await prisma.smfRound.count({
      where: { playerId: req.userId, createdAt: { gte: midnight } },
    });

    if (roundsToday >= MAX_ROUNDS_PER_DAY) {
      return res.status(429).json({ error: 'Daily limit reached', resetsAt: tomorrowMidnightUTC() });
    }

    // Create round + picks in a transaction
    const round = await prisma.$transaction(async (tx) => {
      const r = await tx.smfRound.create({
        data: {
          playerId: req.userId,
          picks: {
            create: picks.map((p) => ({
              targetId: p.userId,
              pick: p.pick,
            })),
          },
        },
      });

      // Create notifications for each target
      const notifData = picks.map((p) => {
        let title;
        if (p.pick === 'smash') title = 'Someone chose Smash for you 🔥';
        else if (p.pick === 'marry') title = 'Someone chose Marry for you 💍';
        else title = "You've been Friendzoned 😂";

        return {
          userId: p.userId,
          type: 'smf_pick',
          title,
          body: 'Play Smash Marry Friendzone to see how others rate you!',
        };
      });

      await tx.notification.createMany({ data: notifData });

      return r;
    });

    // Emit real-time notifications via Socket.io
    try {
      const { io } = await import('../../server.js');
      for (const p of picks) {
        let title;
        if (p.pick === 'smash') title = 'Someone chose Smash for you 🔥';
        else if (p.pick === 'marry') title = 'Someone chose Marry for you 💍';
        else title = "You've been Friendzoned 😂";

        io.to(p.userId).emit('notification', {
          type: 'smf_pick',
          title,
          body: 'Play Smash Marry Friendzone to see how others rate you!',
        });
      }
    } catch (socketErr) {
      console.error('SMF socket emit error:', socketErr);
    }

    const roundsLeft = MAX_ROUNDS_PER_DAY - (roundsToday + 1);
    res.json({ success: true, roundsLeft });
  } catch (err) {
    console.error('SMF submit error:', err);
    res.status(500).json({ error: 'Failed to submit round' });
  }
});

// GET /api/smf/stats — your personal stats (how others rated you)
router.get('/stats', authenticate, async (req, res) => {
  try {
    const [smashCount, marryCount, friendzoneCount, totalRounds] = await Promise.all([
      prisma.smfPick.count({ where: { targetId: req.userId, pick: 'smash' } }),
      prisma.smfPick.count({ where: { targetId: req.userId, pick: 'marry' } }),
      prisma.smfPick.count({ where: { targetId: req.userId, pick: 'friendzone' } }),
      prisma.smfRound.count({ where: { playerId: req.userId } }),
    ]);

    res.json({ smashCount, marryCount, friendzoneCount, totalRounds });
  } catch (err) {
    console.error('SMF stats error:', err);
    res.status(500).json({ error: 'Failed to load stats' });
  }
});

export default router;
