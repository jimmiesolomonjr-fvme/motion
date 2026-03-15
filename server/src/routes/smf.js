import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

const MAX_ROUNDS_PER_WINDOW = 3;
const WINDOW_HOURS = 6;
const VALID_PICKS = ['smash', 'marry', 'friendzone'];

const SMF_MESSAGES = {
  smash: {
    titles: (name) => [
      `${name} rated you Smash 🔥`,
      `${name} picked Smash on you 😏`,
      `${name} said Smash — no hesitation 🫣`,
    ],
    bodies: [
      'Go see what they look like 👀',
      'The attraction is real. Tap to check them out.',
      'You caught their eye. See their profile.',
    ],
  },
  marry: {
    titles: (name) => [
      `${name} rated you Marry 💍`,
      `${name} picked Marry — you're the one 💒`,
      `${name} sees wifey/hubby material 💍`,
    ],
    bodies: [
      'They see forever in you. Tap to check them out.',
      'Ring energy. Go see their profile.',
      'You\'re giving long-term vibes. See who thinks so.',
    ],
  },
  friendzone: {
    titles: () => [
      'Someone Friendzoned you 😂',
      'You got hit with the "just friends" 🫠',
      'Friendzone alert 💙',
    ],
    bodies: [
      'It happens to the best of us. Play again and see who\'s feeling you.',
      'Not everyone\'s your person — but someone out there is.',
      'At least they didn\'t ghost you. Check your SMF stats.',
    ],
  },
};

function randomSmfMessage(pick, name) {
  const msgs = SMF_MESSAGES[pick];
  const titles = msgs.titles(name);
  const title = titles[Math.floor(Math.random() * titles.length)];
  const body = msgs.bodies[Math.floor(Math.random() * msgs.bodies.length)];
  return { title, body };
}

function windowStart() {
  return new Date(Date.now() - WINDOW_HOURS * 60 * 60 * 1000);
}

function windowResetsAt(oldestRoundDate) {
  return new Date(new Date(oldestRoundDate).getTime() + WINDOW_HOURS * 60 * 60 * 1000);
}

// GET /api/smf/round — get 3 random opposite-role profiles for a new round
router.get('/round', authenticate, async (req, res) => {
  try {
    const winStart = windowStart();

    const recentRounds = await prisma.smfRound.findMany({
      where: { playerId: req.userId, createdAt: { gte: winStart } },
      orderBy: { createdAt: 'asc' },
      include: { picks: { select: { targetId: true } } },
    });

    const roundsInWindow = recentRounds.length;

    if (roundsInWindow >= MAX_ROUNDS_PER_WINDOW) {
      const resetsAt = windowResetsAt(recentRounds[0].createdAt);
      return res.json({ limited: true, resetsAt, roundsPlayed: roundsInWindow, roundsLeft: 0 });
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

    // Already picked in this window — prevent repeats
    const pickedTodayIds = recentRounds.flatMap((r) => r.picks.map((p) => p.targetId));

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

    const users = candidates.slice(0, 3).map((u) => {
      const photos = Array.isArray(u.profile.photos) ? u.profile.photos.filter(Boolean) : [];
      return {
        id: u.id,
        displayName: u.profile.displayName,
        photo: photos[0] || null,
        photos,
        age: u.profile.age,
        city: u.profile.city,
      };
    });

    if (users.length < 3) {
      return res.json({ limited: true, resetsAt: new Date(Date.now() + WINDOW_HOURS * 60 * 60 * 1000), roundsPlayed: roundsInWindow, roundsLeft: 0, notEnoughUsers: true });
    }

    res.json({ users, roundsPlayed: roundsInWindow, roundsLeft: MAX_ROUNDS_PER_WINDOW - roundsInWindow });
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

    // Race condition guard: check window limit again
    const winStart = windowStart();
    const roundsInWindow = await prisma.smfRound.count({
      where: { playerId: req.userId, createdAt: { gte: winStart } },
    });

    if (roundsInWindow >= MAX_ROUNDS_PER_WINDOW) {
      return res.status(429).json({ error: 'Round limit reached — try again later' });
    }

    // Fetch the picker's profile for personalized notifications
    const pickerProfile = await prisma.profile.findUnique({
      where: { userId: req.userId },
      select: { displayName: true, photos: true },
    });
    const pickerName = pickerProfile?.displayName || 'Someone';
    const pickerPhoto = Array.isArray(pickerProfile?.photos) && pickerProfile.photos.length > 0
      ? pickerProfile.photos[0] : null;

    // Create round + picks in a transaction
    const notifEntries = [];
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

      // Create notifications for each target (random message with picker's name)
      for (const p of picks) {
        const { title, body } = randomSmfMessage(p.pick, pickerName);
        notifEntries.push({ userId: p.userId, type: 'smf_pick', title, body });
      }

      await tx.notification.createMany({ data: notifEntries });

      return r;
    });

    // Emit real-time notifications via Socket.io
    try {
      const { io } = await import('../../server.js');
      for (let i = 0; i < picks.length; i++) {
        const isFriendzone = picks[i].pick === 'friendzone';
        io.to(picks[i].userId).emit('notification', {
          type: 'smf_pick',
          title: notifEntries[i].title,
          body: notifEntries[i].body,
          data: isFriendzone ? {} : { pickerId: req.userId, pickerName, pickerPhoto },
        });
      }
    } catch (socketErr) {
      console.error('SMF socket emit error:', socketErr);
    }

    const roundsLeft = MAX_ROUNDS_PER_WINDOW - (roundsInWindow + 1);
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
