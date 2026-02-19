import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/admin.js';

const router = Router();
const prisma = new PrismaClient();

// Dashboard stats
router.get('/stats', authenticate, requireAdmin, async (req, res) => {
  try {
    const [totalUsers, steppers, baddies, premiumUsers, pendingReports, totalMatches] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: 'STEPPER' } }),
      prisma.user.count({ where: { role: 'BADDIE' } }),
      prisma.user.count({ where: { isPremium: true } }),
      prisma.report.count({ where: { status: 'PENDING' } }),
      prisma.match.count(),
    ]);

    res.json({ totalUsers, steppers, baddies, premiumUsers, pendingReports, totalMatches });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get reports
router.get('/reports', authenticate, requireAdmin, async (req, res) => {
  try {
    const { status = 'PENDING' } = req.query;
    const reports = await prisma.report.findMany({
      where: { status },
      include: {
        reporter: { include: { profile: true } },
        reported: { include: { profile: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(reports);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Update report status
router.put('/reports/:reportId', authenticate, requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['REVIEWED', 'ACTIONED'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const report = await prisma.report.update({
      where: { id: req.params.reportId },
      data: { status },
    });

    res.json(report);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Search users
router.get('/users', authenticate, requireAdmin, async (req, res) => {
  try {
    const { search, page = 1 } = req.query;
    const take = 20;
    const skip = (parseInt(page) - 1) * take;

    const where = search
      ? {
          OR: [
            { email: { contains: search, mode: 'insensitive' } },
            { profile: { displayName: { contains: search, mode: 'insensitive' } } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include: { profile: true },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      users: users.map((u) => ({
        id: u.id,
        email: u.email,
        role: u.role,
        isPremium: u.isPremium,
        isBanned: u.isBanned,
        isVerified: u.isVerified,
        createdAt: u.createdAt,
        profile: u.profile,
      })),
      total,
      pages: Math.ceil(total / take),
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Ban/unban user
router.put('/users/:userId/ban', authenticate, requireAdmin, async (req, res) => {
  try {
    const { banned } = req.body;
    const user = await prisma.user.update({
      where: { id: req.params.userId },
      data: { isBanned: !!banned },
    });
    res.json({ id: user.id, isBanned: user.isBanned });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Verify/unverify user
router.put('/users/:userId/verify', authenticate, requireAdmin, async (req, res) => {
  try {
    const { verified } = req.body;
    const user = await prisma.user.update({
      where: { id: req.params.userId },
      data: { isVerified: !!verified },
    });
    res.json({ id: user.id, isVerified: user.isVerified });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ===== Vibe Questions CRUD =====

// List all vibe questions
router.get('/vibe-questions', authenticate, requireAdmin, async (req, res) => {
  try {
    const questions = await prisma.vibeQuestion.findMany({
      include: { _count: { select: { answers: true } } },
      orderBy: [{ category: 'asc' }, { createdAt: 'desc' }],
    });
    res.json(questions.map((q) => ({
      id: q.id,
      questionText: q.questionText,
      category: q.category,
      isActive: q.isActive,
      answerCount: q._count.answers,
      createdAt: q.createdAt,
    })));
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Create vibe question
router.post('/vibe-questions', authenticate, requireAdmin, async (req, res) => {
  try {
    const { questionText, category } = req.body;
    if (!questionText || !category) {
      return res.status(400).json({ error: 'questionText and category are required' });
    }
    const question = await prisma.vibeQuestion.create({
      data: { questionText, category },
    });
    res.status(201).json(question);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Update vibe question
router.put('/vibe-questions/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { questionText, category, isActive } = req.body;
    const data = {};
    if (questionText !== undefined) data.questionText = questionText;
    if (category !== undefined) data.category = category;
    if (isActive !== undefined) data.isActive = isActive;

    const question = await prisma.vibeQuestion.update({
      where: { id: req.params.id },
      data,
    });
    res.json(question);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete vibe question
router.delete('/vibe-questions/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    await prisma.vibeQuestion.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ===== Hidden Pairs =====

// List all hidden pairs
router.get('/hidden-pairs', authenticate, requireAdmin, async (req, res) => {
  try {
    const pairs = await prisma.hiddenPair.findMany({
      include: {
        user1: { include: { profile: true } },
        user2: { include: { profile: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(pairs.map((p) => ({
      id: p.id,
      reason: p.reason,
      createdAt: p.createdAt,
      user1: { id: p.user1.id, email: p.user1.email, displayName: p.user1.profile?.displayName },
      user2: { id: p.user2.id, email: p.user2.email, displayName: p.user2.profile?.displayName },
    })));
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Create hidden pair
router.post('/hidden-pairs', authenticate, requireAdmin, async (req, res) => {
  try {
    const { user1Id, user2Id, reason } = req.body;
    if (!user1Id || !user2Id) {
      return res.status(400).json({ error: 'user1Id and user2Id are required' });
    }
    if (user1Id === user2Id) {
      return res.status(400).json({ error: 'Cannot hide a user from themselves' });
    }
    // Sort IDs for consistent unique constraint
    const [u1, u2] = [user1Id, user2Id].sort();
    const pair = await prisma.hiddenPair.create({
      data: { user1Id: u1, user2Id: u2, reason },
    });
    res.status(201).json(pair);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'This pair is already hidden' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete hidden pair
router.delete('/hidden-pairs/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    await prisma.hiddenPair.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
