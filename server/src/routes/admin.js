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

export default router;
