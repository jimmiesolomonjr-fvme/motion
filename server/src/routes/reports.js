import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

// Report a user
router.post('/', authenticate, async (req, res) => {
  try {
    const { reportedId, reason, details } = req.body;

    if (!reportedId || !reason) {
      return res.status(400).json({ error: 'Reported user and reason are required' });
    }

    const validReasons = ['fake_profile', 'harassment', 'spam', 'inappropriate_content', 'other'];
    if (!validReasons.includes(reason)) {
      return res.status(400).json({ error: 'Invalid reason' });
    }

    const report = await prisma.report.create({
      data: { reporterId: req.userId, reportedId, reason, details },
    });

    res.status(201).json(report);
  } catch (error) {
    console.error('Report error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Block a user
router.post('/block', authenticate, async (req, res) => {
  try {
    const { blockedId } = req.body;
    if (!blockedId) return res.status(400).json({ error: 'Blocked user ID required' });

    await prisma.block.upsert({
      where: { blockerId_blockedId: { blockerId: req.userId, blockedId } },
      update: {},
      create: { blockerId: req.userId, blockedId },
    });

    // Remove any existing conversation
    await prisma.conversation.deleteMany({
      where: {
        OR: [
          { user1Id: req.userId, user2Id: blockedId },
          { user1Id: blockedId, user2Id: req.userId },
        ],
      },
    });

    res.json({ blocked: true });
  } catch (error) {
    console.error('Block error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Unblock a user
router.delete('/block/:userId', authenticate, async (req, res) => {
  try {
    await prisma.block.deleteMany({
      where: { blockerId: req.userId, blockedId: req.params.userId },
    });
    res.json({ unblocked: true });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get blocked users
router.get('/blocked', authenticate, async (req, res) => {
  try {
    const blocks = await prisma.block.findMany({
      where: { blockerId: req.userId },
      include: { blocked: { include: { profile: true } } },
    });

    res.json(blocks.map((b) => ({
      id: b.blocked.id,
      profile: b.blocked.profile,
      blockedAt: b.createdAt,
    })));
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
