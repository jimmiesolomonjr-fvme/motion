import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

const MAX_ROUNDS_PER_WINDOW = 3;
const WINDOW_HOURS = 6;
const VALID_PICKS = ['smash', 'marry', 'friendzone'];

const SMF_NOTIFICATION = {
  smash: {
    titles: (name) => [
      `${name} rated you Smash 🔥`,
      `${name} picked Smash on you 😏`,
      `${name} said Smash — no hesitation 🫣`,
    ],
    bodies: [
      'They sent you a message — go see it 👀',
      'The attraction is real. Check your inbox.',
      'You caught their eye. They slid in your DMs.',
    ],
  },
  marry: {
    titles: (name) => [
      `${name} rated you Marry 💍`,
      `${name} picked Marry — you're the one 💒`,
      `${name} sees wifey/hubby material 💍`,
    ],
    bodies: [
      'They sent you a message — go see it 💍',
      'Ring energy. Check your inbox.',
      'You\'re giving long-term vibes. They slid in your DMs.',
    ],
  },
};

const SMF_INBOX_MESSAGES = {
  smash: [
    "I picked Smash on you in SMF... so yeah, I think you're fine 😏🔥",
    "You got my Smash vote. No hesitation. Wanna talk about it? 😌",
    "SMF said Smash, and I meant it. Come say hi 🫣🔥",
  ],
  marry: [
    "I picked Marry on you in SMF... ring shopping might be premature, but hi 💍😂",
    "You got my Marry vote. I see long-term vibes here 💒✨",
    "SMF said Marry — I don't play about that one. Let's chat 💍😏",
  ],
};

function randomNotification(pick, name) {
  const msgs = SMF_NOTIFICATION[pick];
  const titles = msgs.titles(name);
  const title = titles[Math.floor(Math.random() * titles.length)];
  const body = msgs.bodies[Math.floor(Math.random() * msgs.bodies.length)];
  return { title, body };
}

function randomInboxMessage(pick) {
  const msgs = SMF_INBOX_MESSAGES[pick];
  return msgs[Math.floor(Math.random() * msgs.length)];
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

    // Create round + picks + inbox messages for Smash/Marry in a transaction
    const socketPayloads = []; // { targetId, notification?, message? }
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

      // Only Smash and Marry get notifications + inbox messages
      for (const p of picks) {
        if (p.pick === 'friendzone') continue;

        // Upsert conversation (sort IDs for unique constraint)
        const [user1Id, user2Id] = [req.userId, p.userId].sort();
        const conversation = await tx.conversation.upsert({
          where: { user1Id_user2Id: { user1Id, user2Id } },
          create: { user1Id, user2Id },
          update: {},
        });

        // Create inbox message from picker
        const messageContent = randomInboxMessage(p.pick);
        const message = await tx.message.create({
          data: {
            conversationId: conversation.id,
            senderId: req.userId,
            content: messageContent,
            contentType: 'TEXT',
          },
        });

        // Update conversation timestamp
        await tx.conversation.update({
          where: { id: conversation.id },
          data: { lastMessageAt: new Date() },
        });

        // Create notification with conversationId
        const { title, body } = randomNotification(p.pick, pickerName);
        const notification = await tx.notification.create({
          data: {
            userId: p.userId,
            type: 'smf_pick',
            title,
            body,
            data: { pickerId: req.userId, pickerName, pickerPhoto, conversationId: conversation.id },
          },
        });

        socketPayloads.push({
          targetId: p.userId,
          notification: { type: 'smf_pick', title, body, data: { pickerId: req.userId, pickerName, pickerPhoto, conversationId: conversation.id } },
          message: { id: message.id, conversationId: conversation.id, senderId: req.userId, content: messageContent, contentType: 'TEXT', createdAt: message.createdAt },
        });
      }

      return r;
    });

    // Emit real-time notifications + message events via Socket.io
    try {
      const { io } = await import('../../server.js');
      for (const payload of socketPayloads) {
        io.to(payload.targetId).emit('notification', payload.notification);
        io.to(payload.targetId).emit('message-notification', {
          conversationId: payload.message.conversationId,
          message: payload.message,
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
