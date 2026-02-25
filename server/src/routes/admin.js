import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/admin.js';
import { sendEmail, sendBulkEmails, brandedTemplate } from '../services/email.js';

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
        isMuted: u.isMuted,
        isHidden: u.isHidden,
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

// Mute/unmute user
router.put('/users/:userId/mute', authenticate, requireAdmin, async (req, res) => {
  try {
    const { muted } = req.body;
    const user = await prisma.user.update({
      where: { id: req.params.userId },
      data: { isMuted: !!muted },
    });
    res.json({ id: user.id, isMuted: user.isMuted });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete user (admin only)
router.delete('/users/:userId', authenticate, requireAdmin, async (req, res) => {
  try {
    const targetUser = await prisma.user.findUnique({ where: { id: req.params.userId } });
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (targetUser.isAdmin) {
      return res.status(403).json({ error: 'Cannot delete an admin user' });
    }

    // Delete related records that don't cascade automatically
    await prisma.$transaction([
      prisma.messageReaction.deleteMany({ where: { userId: req.params.userId } }),
      prisma.pushSubscription.deleteMany({ where: { userId: req.params.userId } }),
      prisma.moveInterest.deleteMany({ where: { userId: req.params.userId } }),
      prisma.move.deleteMany({ where: { creatorId: req.params.userId } }),
      prisma.message.deleteMany({ where: { senderId: req.params.userId } }),
      prisma.conversation.deleteMany({ where: { OR: [{ user1Id: req.params.userId }, { user2Id: req.params.userId }] } }),
      prisma.like.deleteMany({ where: { OR: [{ likerId: req.params.userId }, { likedId: req.params.userId }] } }),
      prisma.match.deleteMany({ where: { OR: [{ user1Id: req.params.userId }, { user2Id: req.params.userId }] } }),
      prisma.block.deleteMany({ where: { OR: [{ blockerId: req.params.userId }, { blockedId: req.params.userId }] } }),
      prisma.report.deleteMany({ where: { OR: [{ reporterId: req.params.userId }, { reportedId: req.params.userId }] } }),
      prisma.hiddenPair.deleteMany({ where: { OR: [{ user1Id: req.params.userId }, { user2Id: req.params.userId }] } }),
      prisma.notification.deleteMany({ where: { userId: req.params.userId } }),
      prisma.profileView.deleteMany({ where: { OR: [{ viewerId: req.params.userId }, { viewedId: req.params.userId }] } }),
      prisma.storyLike.deleteMany({ where: { userId: req.params.userId } }),
      prisma.storyView.deleteMany({ where: { viewerId: req.params.userId } }),
      prisma.story.deleteMany({ where: { userId: req.params.userId } }),
      prisma.profilePrompt.deleteMany({ where: { userId: req.params.userId } }),
      prisma.vibeAnswer.deleteMany({ where: { userId: req.params.userId } }),
      prisma.subscription.deleteMany({ where: { userId: req.params.userId } }),
      prisma.profile.deleteMany({ where: { userId: req.params.userId } }),
      prisma.user.delete({ where: { id: req.params.userId } }),
    ]);

    res.json({ success: true });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ===== Vibe Stats =====

router.get('/vibe-stats', authenticate, requireAdmin, async (req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      totalQuestions,
      activeQuestions,
      totalAnswers,
      activeToday,
      avgStreakResult,
      questionDistribution,
    ] = await Promise.all([
      prisma.vibeQuestion.count(),
      prisma.vibeQuestion.count({ where: { isActive: true } }),
      prisma.vibeAnswer.count(),
      prisma.vibeAnswer.groupBy({
        by: ['userId'],
        where: { answeredAt: { gte: todayStart } },
      }).then((r) => r.length),
      prisma.user.aggregate({
        _avg: { vibeStreak: true },
        where: { vibeStreak: { gt: 0 } },
      }),
      prisma.vibeQuestion.findMany({
        where: { isActive: true },
        select: {
          id: true,
          questionText: true,
          category: true,
          answers: { select: { answer: true } },
        },
        orderBy: { category: 'asc' },
      }),
    ]);

    const perQuestion = questionDistribution.map((q) => {
      const total = q.answers.length;
      const trueCount = q.answers.filter((a) => a.answer === true).length;
      return {
        id: q.id,
        questionText: q.questionText,
        category: q.category,
        totalAnswers: total,
        truePercent: total > 0 ? Math.round((trueCount / total) * 100) : 0,
        falsePercent: total > 0 ? Math.round(((total - trueCount) / total) * 100) : 0,
      };
    });

    // Avg answers per user
    const distinctUsers = await prisma.vibeAnswer.groupBy({ by: ['userId'] });
    const avgPerUser = distinctUsers.length > 0
      ? Math.round(totalAnswers / distinctUsers.length)
      : 0;

    res.json({
      totalQuestions,
      activeQuestions,
      totalAnswers,
      activeToday,
      avgStreak: Math.round((avgStreakResult._avg.vibeStreak || 0) * 10) / 10,
      avgPerUser,
      perQuestion,
    });
  } catch (error) {
    console.error('Vibe stats error:', error);
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
      responseOptions: q.responseOptions,
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
    const { questionText, category, responseOptions } = req.body;
    if (!questionText || !category) {
      return res.status(400).json({ error: 'questionText and category are required' });
    }
    const data = { questionText, category };
    if (responseOptions) data.responseOptions = responseOptions;
    const question = await prisma.vibeQuestion.create({ data });
    res.status(201).json(question);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Update vibe question
router.put('/vibe-questions/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { questionText, category, isActive, responseOptions } = req.body;
    const data = {};
    if (questionText !== undefined) data.questionText = questionText;
    if (category !== undefined) data.category = category;
    if (isActive !== undefined) data.isActive = isActive;
    if (responseOptions !== undefined) data.responseOptions = responseOptions;

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

// ===== App Settings =====

// Get all settings
router.get('/settings', authenticate, requireAdmin, async (req, res) => {
  try {
    const settings = await prisma.appSetting.findMany();
    const obj = {};
    settings.forEach((s) => { obj[s.key] = s.value; });
    res.json(obj);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Update a setting
router.put('/settings/:key', authenticate, requireAdmin, async (req, res) => {
  try {
    const { value } = req.body;
    const setting = await prisma.appSetting.upsert({
      where: { key: req.params.key },
      update: { value: String(value) },
      create: { key: req.params.key, value: String(value) },
    });
    res.json(setting);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ===== Broadcast messaging =====

router.post('/broadcast', authenticate, requireAdmin, async (req, res) => {
  try {
    const { content, targetRole } = req.body;
    if (!content?.trim()) {
      return res.status(400).json({ error: 'Message content is required' });
    }
    if (targetRole && !['STEPPER', 'BADDIE'].includes(targetRole)) {
      return res.status(400).json({ error: 'Invalid targetRole' });
    }

    const adminUser = await prisma.user.findUnique({ where: { id: req.userId } });

    const userWhere = { isBanned: false, isAdmin: false };
    if (targetRole) userWhere.role = targetRole;
    const users = await prisma.user.findMany({
      where: userWhere,
      select: { id: true },
    });

    // Process in batches of 50
    const BATCH_SIZE = 50;
    let sent = 0;
    for (let i = 0; i < users.length; i += BATCH_SIZE) {
      const batch = users.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(async (targetUser) => {
        // Find or create conversation with admin
        const existing = await prisma.conversation.findFirst({
          where: {
            OR: [
              { user1Id: adminUser.id, user2Id: targetUser.id },
              { user1Id: targetUser.id, user2Id: adminUser.id },
            ],
          },
        });

        const conversation = existing || await prisma.conversation.create({
          data: { user1Id: adminUser.id, user2Id: targetUser.id },
        });

        await prisma.message.create({
          data: {
            conversationId: conversation.id,
            senderId: adminUser.id,
            content: content.trim(),
            contentType: 'TEXT',
          },
        });

        await prisma.conversation.update({
          where: { id: conversation.id },
          data: { lastMessageAt: new Date() },
        });

        // Emit socket notification (best-effort)
        try {
          const { io } = await import('../../server.js');
          io.to(targetUser.id).emit('message-notification', { conversationId: conversation.id });
        } catch {}

        sent++;
      }));
    }

    res.json({ sent });
  } catch (error) {
    console.error('Broadcast error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ===== Shadow-hide user from all =====

// Toggle isHidden for a user
router.put('/users/:userId/hide', authenticate, requireAdmin, async (req, res) => {
  try {
    const { hidden } = req.body;
    const user = await prisma.user.update({
      where: { id: req.params.userId },
      data: { isHidden: !!hidden },
    });
    res.json({ id: user.id, isHidden: user.isHidden });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ===== Email Campaigns =====

function buildEmailTargetWhere(targetRole, targetFilter) {
  const where = { isBanned: false, isAdmin: false, isDummy: false };
  if (targetRole && ['STEPPER', 'BADDIE'].includes(targetRole)) {
    where.role = targetRole;
  }
  if (targetFilter === 'incomplete_profile') {
    where.OR = [
      { profile: null },
      { profile: { photos: { equals: [] } } },
    ];
  }
  return where;
}

// Preview: get count of matching recipients
router.post('/email/preview', authenticate, requireAdmin, async (req, res) => {
  try {
    const { targetRole, targetFilter } = req.body;
    const where = buildEmailTargetWhere(targetRole, targetFilter);
    const count = await prisma.user.count({ where });
    res.json({ count });
  } catch (error) {
    console.error('Email preview error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Send test email to the admin's own email
router.post('/email/test', authenticate, requireAdmin, async (req, res) => {
  try {
    const { subject, bodyHtml } = req.body;
    if (!subject?.trim() || !bodyHtml?.trim()) {
      return res.status(400).json({ error: 'Subject and body are required' });
    }

    const testEmail = process.env.ADMIN_TEST_EMAIL || 'jimmiesolomonjr@gmail.com';
    const html = brandedTemplate(bodyHtml);
    const result = await sendEmail({ to: testEmail, subject: `[TEST] ${subject}`, html });

    if (result.success) {
      res.json({ success: true, email: testEmail });
    } else {
      res.status(500).json({ error: result.error || 'Failed to send test email' });
    }
  } catch (error) {
    console.error('Email test error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Send email campaign
router.post('/email/send', authenticate, requireAdmin, async (req, res) => {
  try {
    const { subject, bodyHtml, targetRole, targetFilter } = req.body;
    if (!subject?.trim() || !bodyHtml?.trim()) {
      return res.status(400).json({ error: 'Subject and body are required' });
    }

    const where = buildEmailTargetWhere(targetRole, targetFilter);
    const users = await prisma.user.findMany({
      where,
      select: { id: true, email: true },
    });

    if (users.length === 0) {
      return res.json({ sent: 0, failed: 0, errors: [] });
    }

    const result = await sendBulkEmails({ users, subject, bodyHtml });
    res.json(result);
  } catch (error) {
    console.error('Email send error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
