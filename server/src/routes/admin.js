import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/admin.js';
import { sendEmail, sendBulkEmails, brandedTemplate } from '../services/email.js';
import { deleteFromCloud } from '../middleware/upload.js';

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

// Engagement stats
router.get('/engagement', authenticate, requireAdmin, async (req, res) => {
  try {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const [
      dailyActiveUsers,
      weeklyActiveUsers,
      messagesToday,
      messagesThisWeek,
      profileViewsToday,
      profileViewsThisWeek,
      likesToday,
      likesThisWeek,
      matchesThisWeek,
      activeConversations,
      smfRoundsToday,
      smfRoundsThisWeek,
    ] = await Promise.all([
      prisma.user.count({ where: { lastOnline: { gte: todayStart } } }),
      prisma.user.count({ where: { lastOnline: { gte: weekAgo } } }),
      prisma.message.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.message.count({ where: { createdAt: { gte: weekAgo } } }),
      prisma.profileView.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.profileView.count({ where: { createdAt: { gte: weekAgo } } }),
      prisma.like.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.like.count({ where: { createdAt: { gte: weekAgo } } }),
      prisma.match.count({ where: { createdAt: { gte: weekAgo } } }),
      prisma.conversation.count({ where: { lastMessageAt: { gte: weekAgo } } }),
      prisma.smfRound.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.smfRound.count({ where: { createdAt: { gte: weekAgo } } }),
    ]);

    res.json({
      dailyActiveUsers,
      weeklyActiveUsers,
      messagesToday,
      messagesThisWeek,
      profileViewsToday,
      profileViewsThisWeek,
      likesToday,
      likesThisWeek,
      matchesThisWeek,
      activeConversations,
      smfRoundsToday,
      smfRoundsThisWeek,
    });
  } catch (error) {
    console.error('Engagement stats error:', error);
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
    // Attach conversationId to each report for admin context
    reports.forEach((r) => { r.conversationId = r.conversationId || null; });
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
        referralCode: u.referralCode,
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
    const { muted, reason } = req.body;
    const user = await prisma.user.update({
      where: { id: req.params.userId },
      data: {
        isMuted: !!muted,
        muteReason: muted ? (reason || null) : null,
      },
    });
    res.json({ id: user.id, isMuted: user.isMuted, muteReason: user.muteReason });
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

    // Delete related records in dependency order
    const uid = req.params.userId;
    await prisma.$transaction(async (tx) => {
      // Tips (no cascade on tipperId/creatorId)
      await tx.tip.deleteMany({ where: { OR: [{ tipperId: uid }, { creatorId: uid }] } });
      // Message reactions
      await tx.messageReaction.deleteMany({ where: { userId: uid } });
      // Messages in ALL conversations involving this user (not just sent by them)
      const convos = await tx.conversation.findMany({
        where: { OR: [{ user1Id: uid }, { user2Id: uid }] },
        select: { id: true },
      });
      const convoIds = convos.map((c) => c.id);
      if (convoIds.length > 0) {
        await tx.message.deleteMany({ where: { conversationId: { in: convoIds } } });
      }
      await tx.conversation.deleteMany({ where: { id: { in: convoIds } } });
      // Move participants (no cascade on baddieId)
      await tx.moveParticipant.deleteMany({ where: { baddieId: uid } });
      // Move interests on this user's moves + by this user
      const userMoves = await tx.move.findMany({ where: { creatorId: uid }, select: { id: true } });
      const moveIds = userMoves.map((m) => m.id);
      if (moveIds.length > 0) {
        await tx.moveInterest.deleteMany({ where: { moveId: { in: moveIds } } });
        await tx.savedMove.deleteMany({ where: { moveId: { in: moveIds } } });
        await tx.moveParticipant.deleteMany({ where: { moveId: { in: moveIds } } });
      }
      await tx.moveInterest.deleteMany({ where: { userId: uid } });
      await tx.savedMove.deleteMany({ where: { userId: uid } });
      await tx.move.deleteMany({ where: { creatorId: uid } });
      // Push subscriptions
      await tx.pushSubscription.deleteMany({ where: { userId: uid } });
      // Social
      await tx.like.deleteMany({ where: { OR: [{ likerId: uid }, { likedId: uid }] } });
      await tx.match.deleteMany({ where: { OR: [{ user1Id: uid }, { user2Id: uid }] } });
      await tx.block.deleteMany({ where: { OR: [{ blockerId: uid }, { blockedId: uid }] } });
      await tx.report.deleteMany({ where: { OR: [{ reporterId: uid }, { reportedId: uid }] } });
      await tx.hiddenPair.deleteMany({ where: { OR: [{ user1Id: uid }, { user2Id: uid }] } });
      // Notifications & views
      await tx.notification.deleteMany({ where: { userId: uid } });
      await tx.profileView.deleteMany({ where: { OR: [{ viewerId: uid }, { viewedId: uid }] } });
      // Stories (likes/views cascade, but clean up references to this user)
      await tx.storyLike.deleteMany({ where: { userId: uid } });
      await tx.storyView.deleteMany({ where: { viewerId: uid } });
      await tx.story.deleteMany({ where: { userId: uid } });
      // Profile & vibe
      await tx.profilePrompt.deleteMany({ where: { userId: uid } });
      await tx.vibeAnswer.deleteMany({ where: { userId: uid } });
      await tx.subscription.deleteMany({ where: { userId: uid } });
      await tx.profile.deleteMany({ where: { userId: uid } });
      // Finally delete the user
      await tx.user.delete({ where: { id: uid } });
    });

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

// ===== Re-engagement: newest members email template =====

// Preview newest members (returns both role sets for admin preview)
router.get('/email/newest-members', authenticate, requireAdmin, async (req, res) => {
  try {
    const [newestBaddies, newestSteppers] = await Promise.all([
      prisma.user.findMany({
        where: { role: 'BADDIE', isBanned: false, isAdmin: false, isDummy: false },
        include: { profile: { select: { displayName: true, photos: true, city: true } } },
        orderBy: { createdAt: 'desc' },
        take: 6,
      }),
      prisma.user.findMany({
        where: { role: 'STEPPER', isBanned: false, isAdmin: false, isDummy: false },
        include: { profile: { select: { displayName: true, photos: true, city: true } } },
        orderBy: { createdAt: 'desc' },
        take: 6,
      }),
    ]);

    const toCards = (members) => members.map((m) => {
      const name = m.profile?.displayName || 'New Member';
      const city = m.profile?.city || '';
      const photos = m.profile?.photos || [];
      let photoUrl = '';
      if (photos.length > 0) {
        const p = photos[0];
        if (p.includes('/video/upload/')) {
          photoUrl = p.replace('/video/upload/', '/video/upload/so_0,w_200,h_200,c_fill,f_jpg/');
        } else if (p.includes('/upload/')) {
          photoUrl = p.replace('/upload/', '/upload/w_200,h_200,c_fill,f_auto,q_auto/');
        } else {
          photoUrl = p;
        }
      }
      return { name, city, photoUrl };
    });

    res.json({
      baddieCards: toCards(newestBaddies),
      stepperCards: toCards(newestSteppers),
    });
  } catch (error) {
    console.error('Newest members email error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Send newest-members re-engagement emails (role-aware: Steppers see Baddies, Baddies see Steppers)
router.post('/email/send-newest-members', authenticate, requireAdmin, async (req, res) => {
  try {
    const { baddieBodyHtml, stepperBodyHtml, subject } = req.body;
    if (!subject?.trim() || !baddieBodyHtml?.trim() || !stepperBodyHtml?.trim()) {
      return res.status(400).json({ error: 'Subject and both email bodies are required' });
    }

    const [steppers, baddies] = await Promise.all([
      prisma.user.findMany({
        where: { role: 'STEPPER', isBanned: false, isAdmin: false, isDummy: false },
        select: { id: true, email: true },
      }),
      prisma.user.findMany({
        where: { role: 'BADDIE', isBanned: false, isAdmin: false, isDummy: false },
        select: { id: true, email: true },
      }),
    ]);

    // Steppers receive the email showing newest Baddies
    // Baddies receive the email showing newest Steppers
    const [stepperResult, baddieResult] = await Promise.all([
      steppers.length > 0
        ? sendBulkEmails({ users: steppers, subject, bodyHtml: baddieBodyHtml })
        : { sent: 0, failed: 0, errors: [] },
      baddies.length > 0
        ? sendBulkEmails({ users: baddies, subject, bodyHtml: stepperBodyHtml })
        : { sent: 0, failed: 0, errors: [] },
    ]);

    res.json({
      sent: stepperResult.sent + baddieResult.sent,
      failed: stepperResult.failed + baddieResult.failed,
      errors: [...stepperResult.errors, ...baddieResult.errors],
    });
  } catch (error) {
    console.error('Newest members send error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ===== Referral Leaderboard =====

// Get referral leaderboard
router.get('/referrals', authenticate, requireAdmin, async (req, res) => {
  try {
    // Find all users who were referred (have a referredBy value)
    const referredUsers = await prisma.user.findMany({
      where: { referredBy: { not: null } },
      select: { id: true, email: true, referredBy: true, createdAt: true, profile: { select: { displayName: true } } },
      orderBy: { createdAt: 'desc' },
    });

    // Group by referredBy (which stores the referrer's user ID)
    const referrerIdMap = {};
    for (const u of referredUsers) {
      if (!referrerIdMap[u.referredBy]) referrerIdMap[u.referredBy] = [];
      referrerIdMap[u.referredBy].push({ id: u.id, email: u.email, displayName: u.profile?.displayName, createdAt: u.createdAt });
    }

    // Look up the referrer user for each ID
    const referrerIds = Object.keys(referrerIdMap);
    const referrers = referrerIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: referrerIds } },
          include: { profile: { select: { displayName: true, photos: true } } },
        })
      : [];

    const referrerByIdMap = {};
    for (const r of referrers) {
      referrerByIdMap[r.id] = r;
    }

    const leaderboard = referrerIds.map((referrerId) => {
      const referrer = referrerByIdMap[referrerId];
      return {
        user: referrer
          ? { id: referrer.id, email: referrer.email, displayName: referrer.profile?.displayName, photos: referrer.profile?.photos, referralCode: referrer.referralCode }
          : { id: referrerId, email: null, displayName: `Unknown (${referrerId})`, photos: [], referralCode: null },
        referrals: referrerIdMap[referrerId],
        count: referrerIdMap[referrerId].length,
      };
    });

    leaderboard.sort((a, b) => b.count - a.count);

    res.json(leaderboard);
  } catch (error) {
    console.error('Referral leaderboard error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Set custom referral code for a user
router.put('/users/:userId/referral-code', authenticate, requireAdmin, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'Code is required' });
    }

    const cleaned = code.trim().toUpperCase();
    if (cleaned.length < 3 || cleaned.length > 20) {
      return res.status(400).json({ error: 'Code must be 3-20 characters' });
    }
    if (!/^[A-Z0-9-]+$/.test(cleaned)) {
      return res.status(400).json({ error: 'Code can only contain letters, numbers, and hyphens' });
    }

    // Check uniqueness
    const existing = await prisma.user.findFirst({ where: { referralCode: cleaned, id: { not: req.params.userId } } });
    if (existing) {
      return res.status(409).json({ error: 'This code is already taken' });
    }

    const user = await prisma.user.update({
      where: { id: req.params.userId },
      data: { referralCode: cleaned },
    });

    res.json({ id: user.id, referralCode: user.referralCode });
  } catch (error) {
    console.error('Set referral code error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ===== User Messages (admin debug) =====

// Get all messages for a user
router.get('/users/:userId/messages', authenticate, requireAdmin, async (req, res) => {
  try {
    const userId = req.params.userId;

    const conversations = await prisma.conversation.findMany({
      where: { OR: [{ user1Id: userId }, { user2Id: userId }] },
      include: {
        user1: { include: { profile: { select: { displayName: true } } } },
        user2: { include: { profile: { select: { displayName: true } } } },
        messages: {
          orderBy: { createdAt: 'asc' },
          include: { sender: { include: { profile: { select: { displayName: true } } } } },
        },
      },
      orderBy: { lastMessageAt: 'desc' },
    });

    const result = conversations.map((c) => {
      const other = c.user1Id === userId ? c.user2 : c.user1;
      return {
        conversationId: c.id,
        otherUser: { id: other.id, email: other.email, displayName: other.profile?.displayName },
        messageCount: c.messages.length,
        messages: c.messages.map((m) => ({
          id: m.id,
          senderId: m.senderId,
          senderName: m.sender?.profile?.displayName || m.sender?.email,
          content: m.content,
          contentType: m.contentType,
          createdAt: m.createdAt,
          readAt: m.readAt,
        })),
      };
    });

    res.json({ userId, totalConversations: result.length, conversations: result });
  } catch (error) {
    console.error('Admin user messages error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Deletion log (deduplicates on fetch — keeps newest per email+signedUpAt)
router.get('/deletion-log', authenticate, requireAdmin, async (req, res) => {
  try {
    const logs = await prisma.deletionLog.findMany({
      orderBy: { deletedAt: 'desc' },
    });

    // Deduplicate: keep only the first (newest) entry per email+signedUpAt
    const seen = new Set();
    const unique = [];
    const dupeIds = [];
    for (const log of logs) {
      const key = `${log.email}|${log.signedUpAt?.toISOString()}`;
      if (seen.has(key)) {
        dupeIds.push(log.id);
      } else {
        seen.add(key);
        unique.push(log);
      }
    }

    // Clean up duplicate rows in the background
    if (dupeIds.length > 0) {
      prisma.deletionLog.deleteMany({ where: { id: { in: dupeIds } } }).catch(() => {});
    }

    res.json(unique);
  } catch (error) {
    console.error('Deletion log error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete a deletion-log entry and its Cloudinary photos
router.delete('/deletion-log/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const log = await prisma.deletionLog.findUnique({ where: { id: req.params.id } });
    if (!log) {
      return res.status(404).json({ error: 'Deletion log entry not found' });
    }

    // Clean up Cloudinary photos
    const photos = Array.isArray(log.photos) ? log.photos : [];
    await Promise.all(photos.map((url) => deleteFromCloud(url).catch(() => {})));

    await prisma.deletionLog.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete deletion-log error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Activation stats + list ──
router.get('/activation', authenticate, requireAdmin, async (req, res) => {
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [newUsers24h, waiting, messaged, replied, expired, total] = await Promise.all([
      prisma.user.count({ where: { createdAt: { gte: twentyFourHoursAgo } } }),
      prisma.userActivation.count({ where: { activationStatus: { in: ['PENDING', 'NUDGED'] }, needsFirstMessage: true } }),
      prisma.userActivation.count({ where: { activationStatus: 'MESSAGED' } }),
      prisma.userActivation.count({ where: { activationStatus: 'REPLIED' } }),
      prisma.userActivation.count({ where: { activationStatus: 'EXPIRED' } }),
      prisma.userActivation.count(),
    ]);

    // Count onboarding complete (have profile + photos) from last 24h
    const onboardingComplete = await prisma.user.count({
      where: {
        createdAt: { gte: twentyFourHoursAgo },
        profile: { isNot: null },
      },
    });

    const activations = await prisma.userActivation.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        user: {
          include: { profile: { select: { displayName: true, photos: true, city: true } } },
        },
      },
    });

    res.json({
      stats: { newUsers24h, onboardingComplete, waiting, messaged, replied, expired, total },
      activations: activations.map((a) => ({
        id: a.id,
        userId: a.userId,
        displayName: a.user.profile?.displayName || 'No profile',
        photo: Array.isArray(a.user.profile?.photos) ? a.user.profile.photos[0] : null,
        city: a.user.profile?.city,
        role: a.user.role,
        activationStatus: a.activationStatus,
        needsFirstMessage: a.needsFirstMessage,
        nudgeCount: a.nudgeCount,
        lastNudgedAt: a.lastNudgedAt,
        firstInboundMessageAt: a.firstInboundMessageAt,
        firstReplyAt: a.firstReplyAt,
        createdAt: a.createdAt,
      })),
    });
  } catch (error) {
    console.error('Activation stats error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Activation metrics ──
router.get('/activation/metrics', authenticate, requireAdmin, async (req, res) => {
  try {
    const allActivations = await prisma.userActivation.findMany();
    const total = allActivations.length;
    if (total === 0) {
      return res.json({ messaged: 0, medianTimeMin: 0, replied: 0, nudgeConversion: 0 });
    }

    const messagedCount = allActivations.filter((a) => ['MESSAGED', 'REPLIED'].includes(a.activationStatus)).length;
    const repliedCount = allActivations.filter((a) => a.activationStatus === 'REPLIED').length;
    const nudgedCount = allActivations.filter((a) => a.nudgeCount > 0).length;
    const nudgedAndMessaged = allActivations.filter((a) => a.nudgeCount > 0 && ['MESSAGED', 'REPLIED'].includes(a.activationStatus)).length;

    // Median time to first message
    const timesToMessage = allActivations
      .filter((a) => a.firstInboundMessageAt)
      .map((a) => (new Date(a.firstInboundMessageAt).getTime() - new Date(a.createdAt).getTime()) / 60000);
    timesToMessage.sort((a, b) => a - b);
    const medianTimeMin = timesToMessage.length > 0
      ? Math.round(timesToMessage[Math.floor(timesToMessage.length / 2)])
      : 0;

    res.json({
      messaged: total > 0 ? Math.round((messagedCount / total) * 100) : 0,
      medianTimeMin,
      replied: messagedCount > 0 ? Math.round((repliedCount / messagedCount) * 100) : 0,
      nudgeConversion: nudgedCount > 0 ? Math.round((nudgedAndMessaged / nudgedCount) * 100) : 0,
    });
  } catch (error) {
    console.error('Activation metrics error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Manual nudge ──
router.post('/activation/:userId/nudge', authenticate, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const activation = await prisma.userActivation.findUnique({ where: { userId } });
    if (!activation) return res.status(404).json({ error: 'No activation found' });

    // Import and run the scoring + nudge logic
    const { getTopResponders } = await import('../services/responderScoring.js');
    const { sendPushNotification } = await import('../utils/pushNotifications.js');
    const { io } = await import('../../server.js');

    const responderIds = await getTopResponders(userId, 5);
    const profile = await prisma.profile.findUnique({ where: { userId }, select: { displayName: true } });

    for (const responderId of responderIds) {
      const notification = await prisma.notification.create({
        data: {
          userId: responderId,
          type: 'new_user_priority',
          title: 'New member nearby',
          body: `${profile?.displayName || 'Someone'} just joined — be the first to say hi!`,
          data: { targetUserId: userId, targetName: profile?.displayName },
        },
      });
      io.to(responderId).emit('notification', notification);
      sendPushNotification(responderId, {
        title: 'New member nearby',
        body: `${profile?.displayName || 'Someone'} just joined — be the first to say hi!`,
      }).catch(() => {});
    }

    await prisma.userActivation.update({
      where: { userId },
      data: {
        nudgeCount: activation.nudgeCount + 1,
        lastNudgedAt: new Date(),
        activationStatus: activation.activationStatus === 'PENDING' ? 'NUDGED' : activation.activationStatus,
        boostedResponderIds: [...new Set([...activation.boostedResponderIds, ...responderIds])],
      },
    });

    res.json({ success: true, nudgedResponders: responderIds.length });
  } catch (error) {
    console.error('Manual nudge error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Manual boost (reset nudge cooldown) ──
router.post('/activation/:userId/boost', authenticate, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const activation = await prisma.userActivation.findUnique({ where: { userId } });
    if (!activation) return res.status(404).json({ error: 'No activation found' });

    await prisma.userActivation.update({
      where: { userId },
      data: {
        lastNudgedAt: null,
        nudgeCount: 0,
        needsFirstMessage: true,
        activationStatus: 'PENDING',
      },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Manual boost error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ===== Community Moves Admin =====

// Get active community moves + stats
router.get('/community-moves', authenticate, requireAdmin, async (req, res) => {
  try {
    const moves = await prisma.move.findMany({
      where: { isCommunity: true },
      include: {
        _count: { select: { communityMovePool: true, communityMovePairings: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const result = moves.map((m) => ({
      id: m.id,
      title: m.title,
      description: m.description,
      photo: m.photo,
      date: m.date,
      location: m.location,
      category: m.category,
      status: m.status,
      isActive: m.isActive,
      vibeTagsCommunity: m.vibeTagsCommunity,
      sourceApi: m.sourceApi,
      poolCount: m._count.communityMovePool,
      pairingCount: m._count.communityMovePairings,
      communityMatchCount: m.communityMatchCount,
      expiresAt: m.expiresAt,
      pipelineRunId: m.pipelineRunId,
      createdAt: m.createdAt,
    }));

    res.json(result);
  } catch (error) {
    console.error('Admin community moves error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get pipeline run history
router.get('/community-moves/pipeline-runs', authenticate, requireAdmin, async (req, res) => {
  try {
    const runs = await prisma.pipelineRunLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    res.json(runs);
  } catch (error) {
    console.error('Pipeline runs error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Manual pipeline trigger
router.post('/community-moves/run-pipeline', authenticate, requireAdmin, async (req, res) => {
  try {
    const { runPipeline } = await import('../services/communityMovePipeline.js');
    const result = await runPipeline(req.body.city);
    res.json(result);
  } catch (error) {
    console.error('Manual pipeline error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Unpublish a community move
router.delete('/community-moves/:moveId', authenticate, requireAdmin, async (req, res) => {
  try {
    await prisma.move.update({
      where: { id: req.params.moveId },
      data: { isActive: false, status: 'CANCELLED' },
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Unpublish community move error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ===== Synthetic Users Admin =====

// Overview stats
router.get('/synthetic/overview', authenticate, requireAdmin, async (req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [total, activeToday, actionsToday, messagesToday, likesToday, movesToday] = await Promise.all([
      prisma.syntheticProfile.count(),
      prisma.syntheticProfile.count({ where: { lastActiveAt: { gte: todayStart } } }),
      prisma.syntheticActionLog.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.syntheticActionLog.count({ where: { actionType: 'send_message', createdAt: { gte: todayStart } } }),
      prisma.syntheticActionLog.count({ where: { actionType: 'like', createdAt: { gte: todayStart } } }),
      prisma.syntheticActionLog.count({ where: { actionType: 'post_move', createdAt: { gte: todayStart } } }),
    ]);

    res.json({ total, activeToday, actionsToday, messagesToday, likesToday, movesToday });
  } catch (error) {
    console.error('Synthetic overview error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// List all synthetic users
router.get('/synthetic/users', authenticate, requireAdmin, async (req, res) => {
  try {
    const profiles = await prisma.syntheticProfile.findMany({
      include: {
        user: { include: { profile: true } },
        _count: { select: { actions: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(profiles.map((sp) => ({
      id: sp.id,
      userId: sp.userId,
      displayName: sp.user.profile?.displayName || 'Unknown',
      role: sp.user.role,
      photo: sp.user.profile?.photos?.[0] || null,
      city: sp.user.profile?.city,
      isActive: sp.isActive,
      lastActiveAt: sp.lastActiveAt,
      actionCount: sp._count.actions,
      createdAt: sp.createdAt,
    })));
  } catch (error) {
    console.error('Synthetic users list error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Single synthetic user detail
router.get('/synthetic/users/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const sp = await prisma.syntheticProfile.findUnique({
      where: { id: req.params.id },
      include: {
        user: { include: { profile: true } },
        actions: { orderBy: { createdAt: 'desc' }, take: 50 },
      },
    });
    if (!sp) return res.status(404).json({ error: 'Not found' });

    res.json({
      id: sp.id,
      userId: sp.userId,
      displayName: sp.user.profile?.displayName,
      role: sp.user.role,
      photo: sp.user.profile?.photos?.[0] || null,
      city: sp.user.profile?.city,
      isActive: sp.isActive,
      lastActiveAt: sp.lastActiveAt,
      lastReflectionAt: sp.lastReflectionAt,
      personaConfig: sp.personaConfig,
      dailySchedule: sp.dailySchedule,
      memoryStream: sp.memoryStream,
      emotionalState: sp.emotionalState,
      currentGoals: sp.currentGoals,
      actions: sp.actions.map((a) => ({
        id: a.id,
        actionType: a.actionType,
        targetUserId: a.targetUserId,
        metadata: a.actionMetadata,
        createdAt: a.createdAt,
      })),
    });
  } catch (error) {
    console.error('Synthetic user detail error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Toggle activate/deactivate
router.put('/synthetic/users/:id/toggle', authenticate, requireAdmin, async (req, res) => {
  try {
    const sp = await prisma.syntheticProfile.findUnique({ where: { id: req.params.id } });
    if (!sp) return res.status(404).json({ error: 'Not found' });

    const updated = await prisma.syntheticProfile.update({
      where: { id: req.params.id },
      data: { isActive: !sp.isActive },
    });

    res.json({ id: updated.id, isActive: updated.isActive });
  } catch (error) {
    console.error('Synthetic toggle error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Activate + run immediate cycle
router.post('/synthetic/users/:id/activate', authenticate, requireAdmin, async (req, res) => {
  try {
    const sp = await prisma.syntheticProfile.update({
      where: { id: req.params.id },
      data: { isActive: true },
    });

    // Run immediate cycle
    try {
      const { runAgentCycle } = await import('../synthetic/agentLoop.js');
      runAgentCycle(sp.id).catch((err) => console.error('[synthetic] Immediate cycle error:', err.message));
    } catch {}

    res.json({ id: sp.id, isActive: true, cycleTriggered: true });
  } catch (error) {
    console.error('Synthetic activate error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Generate new persona (stub — behind feature flag)
router.post('/synthetic/generate', authenticate, requireAdmin, async (req, res) => {
  res.status(501).json({ error: 'Persona generation not yet implemented' });
});

// Import preset persona JSON
router.post('/synthetic/import', authenticate, requireAdmin, async (req, res) => {
  try {
    const { persona } = req.body;
    if (!persona?.email || !persona?.role || !persona?.displayName) {
      return res.status(400).json({ error: 'Invalid persona: email, role, displayName required' });
    }

    const { validatePersonaQuality, seedPrebuiltPersonas } = await import('../synthetic/personaGenerator.js');
    const { valid, errors } = validatePersonaQuality(persona);
    if (!valid) {
      return res.status(400).json({ error: `Validation failed: ${errors.join(', ')}` });
    }

    // Use the seeder with a single persona
    const { PREBUILT_PERSONAS } = await import('../synthetic/personas.js');
    // Temporarily add to list — the seeder is idempotent
    PREBUILT_PERSONAS.push(persona);
    const result = await seedPrebuiltPersonas();
    PREBUILT_PERSONAS.pop(); // remove temp entry

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Synthetic import error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Purge ALL synthetic users + related data
router.delete('/synthetic/purge', authenticate, requireAdmin, async (req, res) => {
  try {
    const syntheticUsers = await prisma.user.findMany({
      where: { isSynthetic: true },
      select: { id: true },
    });
    const ids = syntheticUsers.map((u) => u.id);

    if (ids.length === 0) {
      return res.json({ purged: 0 });
    }

    await prisma.$transaction(async (tx) => {
      // Synthetic-specific tables
      await tx.syntheticActionLog.deleteMany({ where: { syntheticProfile: { userId: { in: ids } } } });
      await tx.syntheticProfile.deleteMany({ where: { userId: { in: ids } } });

      // Standard user data (same pattern as admin delete)
      await tx.tip.deleteMany({ where: { OR: [{ tipperId: { in: ids } }, { creatorId: { in: ids } }] } });
      await tx.messageReaction.deleteMany({ where: { userId: { in: ids } } });
      const convos = await tx.conversation.findMany({
        where: { OR: [{ user1Id: { in: ids } }, { user2Id: { in: ids } }] },
        select: { id: true },
      });
      const convoIds = convos.map((c) => c.id);
      if (convoIds.length > 0) {
        await tx.message.deleteMany({ where: { conversationId: { in: convoIds } } });
      }
      await tx.conversation.deleteMany({ where: { id: { in: convoIds } } });
      await tx.moveParticipant.deleteMany({ where: { baddieId: { in: ids } } });
      const userMoves = await tx.move.findMany({ where: { creatorId: { in: ids } }, select: { id: true } });
      const moveIds = userMoves.map((m) => m.id);
      if (moveIds.length > 0) {
        await tx.moveInterest.deleteMany({ where: { moveId: { in: moveIds } } });
        await tx.savedMove.deleteMany({ where: { moveId: { in: moveIds } } });
        await tx.moveParticipant.deleteMany({ where: { moveId: { in: moveIds } } });
      }
      await tx.moveInterest.deleteMany({ where: { userId: { in: ids } } });
      await tx.savedMove.deleteMany({ where: { userId: { in: ids } } });
      await tx.move.deleteMany({ where: { creatorId: { in: ids } } });
      await tx.pushSubscription.deleteMany({ where: { userId: { in: ids } } });
      await tx.like.deleteMany({ where: { OR: [{ likerId: { in: ids } }, { likedId: { in: ids } }] } });
      await tx.match.deleteMany({ where: { OR: [{ user1Id: { in: ids } }, { user2Id: { in: ids } }] } });
      await tx.block.deleteMany({ where: { OR: [{ blockerId: { in: ids } }, { blockedId: { in: ids } }] } });
      await tx.report.deleteMany({ where: { OR: [{ reporterId: { in: ids } }, { reportedId: { in: ids } }] } });
      await tx.hiddenPair.deleteMany({ where: { OR: [{ user1Id: { in: ids } }, { user2Id: { in: ids } }] } });
      await tx.notification.deleteMany({ where: { userId: { in: ids } } });
      await tx.profileView.deleteMany({ where: { OR: [{ viewerId: { in: ids } }, { viewedId: { in: ids } }] } });
      await tx.storyLike.deleteMany({ where: { userId: { in: ids } } });
      await tx.storyView.deleteMany({ where: { viewerId: { in: ids } } });
      await tx.story.deleteMany({ where: { userId: { in: ids } } });
      await tx.profilePrompt.deleteMany({ where: { userId: { in: ids } } });
      await tx.vibeAnswer.deleteMany({ where: { userId: { in: ids } } });
      await tx.subscription.deleteMany({ where: { userId: { in: ids } } });
      await tx.smfRound.deleteMany({ where: { playerId: { in: ids } } });
      await tx.userActivation.deleteMany({ where: { userId: { in: ids } } });
      await tx.profile.deleteMany({ where: { userId: { in: ids } } });
      await tx.user.deleteMany({ where: { id: { in: ids } } });
    });

    res.json({ purged: ids.length });
  } catch (error) {
    console.error('Synthetic purge error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Analytics — synthetic-to-real activity ratio
router.get('/synthetic/analytics', authenticate, requireAdmin, async (req, res) => {
  try {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const syntheticUserIds = (await prisma.user.findMany({
      where: { isSynthetic: true },
      select: { id: true },
    })).map((u) => u.id);

    const [synMessages, realMessages, synLikes, realLikes, synVibeAnswers, realVibeAnswers] = await Promise.all([
      prisma.message.count({ where: { senderId: { in: syntheticUserIds }, createdAt: { gte: weekAgo } } }),
      prisma.message.count({ where: { senderId: { notIn: syntheticUserIds }, createdAt: { gte: weekAgo } } }),
      prisma.like.count({ where: { likerId: { in: syntheticUserIds }, createdAt: { gte: weekAgo } } }),
      prisma.like.count({ where: { likerId: { notIn: syntheticUserIds }, createdAt: { gte: weekAgo } } }),
      prisma.vibeAnswer.count({ where: { userId: { in: syntheticUserIds }, answeredAt: { gte: weekAgo } } }),
      prisma.vibeAnswer.count({ where: { userId: { notIn: syntheticUserIds }, answeredAt: { gte: weekAgo } } }),
    ]);

    res.json({
      messages: { synthetic: synMessages, real: realMessages, ratio: realMessages > 0 ? (synMessages / realMessages).toFixed(2) : 'N/A' },
      likes: { synthetic: synLikes, real: realLikes, ratio: realLikes > 0 ? (synLikes / realLikes).toFixed(2) : 'N/A' },
      vibeAnswers: { synthetic: synVibeAnswers, real: realVibeAnswers, ratio: realVibeAnswers > 0 ? (synVibeAnswers / realVibeAnswers).toFixed(2) : 'N/A' },
    });
  } catch (error) {
    console.error('Synthetic analytics error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
