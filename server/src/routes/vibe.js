import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth.js';
import { getHiddenIds, isHiddenFrom } from '../utils/hiddenPairs.js';

const router = Router();
const prisma = new PrismaClient();

// Get unanswered questions (25 per 12h window)
router.get('/questions', authenticate, async (req, res) => {
  try {
    const windowStart = new Date(Date.now() - 12 * 60 * 60 * 1000);

    const answeredInWindow = await prisma.vibeAnswer.count({
      where: { userId: req.userId, answeredAt: { gte: windowStart } },
    });

    if (answeredInWindow >= 25) {
      const resetsAt = new Date(windowStart.getTime() + 12 * 60 * 60 * 1000);
      return res.json({ questions: [], remaining: 0, resetsAt: resetsAt.toISOString() });
    }

    const answeredIds = (
      await prisma.vibeAnswer.findMany({
        where: { userId: req.userId },
        select: { questionId: true },
      })
    ).map((a) => a.questionId);

    const [questions, user] = await Promise.all([
      prisma.vibeQuestion.findMany({
        where: {
          isActive: true,
          ...(answeredIds.length > 0 && { id: { notIn: answeredIds } }),
        },
        take: 25 - answeredInWindow,
      }),
      prisma.user.findUnique({
        where: { id: req.userId },
        select: { vibeStreak: true },
      }),
    ]);

    res.json({ questions, remaining: 25 - answeredInWindow, vibeStreak: user?.vibeStreak || 0 });
  } catch (error) {
    console.error('Vibe questions error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Answer a question
router.post('/answer', authenticate, async (req, res) => {
  try {
    const { questionId, answer } = req.body;

    if (typeof answer !== 'boolean') {
      return res.status(400).json({ error: 'Answer must be true or false' });
    }

    const windowStart = new Date(Date.now() - 12 * 60 * 60 * 1000);
    const answeredInWindow = await prisma.vibeAnswer.count({
      where: { userId: req.userId, answeredAt: { gte: windowStart } },
    });

    if (answeredInWindow >= 25) {
      return res.status(400).json({ error: 'Daily limit reached' });
    }

    const vibeAnswer = await prisma.vibeAnswer.upsert({
      where: { userId_questionId: { userId: req.userId, questionId } },
      update: { answer, answeredAt: new Date() },
      create: { userId: req.userId, questionId, answer },
    });

    // Compute streak
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { vibeStreak: true, vibeLastAnsweredDate: true, vibeMatchShownAt: true, role: true },
    });

    const todayStr = new Date().toISOString().slice(0, 10);
    const lastStr = user.vibeLastAnsweredDate
      ? new Date(user.vibeLastAnsweredDate).toISOString().slice(0, 10)
      : null;

    let newStreak = user.vibeStreak;
    if (lastStr === todayStr) {
      // Already answered today — no change
    } else {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().slice(0, 10);
      newStreak = lastStr === yesterdayStr ? user.vibeStreak + 1 : 1;
    }

    await prisma.user.update({
      where: { id: req.userId },
      data: { vibeStreak: newStreak, vibeLastAnsweredDate: new Date() },
    });

    // Check for vibeMatch (once per 24h)
    let vibeMatchResult = null;
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const shouldCheck = !user.vibeMatchShownAt || new Date(user.vibeMatchShownAt) < twentyFourHoursAgo;

    if (shouldCheck) {
      const oppositeRole = user.role === 'STEPPER' ? 'BADDIE' : 'STEPPER';
      const hiddenIds = await getHiddenIds(req.userId);
      const excludeIds = [req.userId, ...hiddenIds];

      const recentMatch = await prisma.vibeAnswer.findFirst({
        where: {
          questionId,
          answer,
          answeredAt: { gte: twentyFourHoursAgo },
          userId: { notIn: excludeIds },
          user: { role: oppositeRole, isBanned: false, isHidden: false },
        },
        include: {
          user: { include: { profile: { select: { displayName: true, photos: true } } } },
        },
      });

      if (recentMatch) {
        vibeMatchResult = {
          userId: recentMatch.userId,
          displayName: recentMatch.user.profile?.displayName || 'Someone',
          photo: Array.isArray(recentMatch.user.profile?.photos) ? recentMatch.user.profile.photos[0] : null,
        };
        await prisma.user.update({
          where: { id: req.userId },
          data: { vibeMatchShownAt: new Date() },
        });
      }
    }

    res.json({ ...vibeAnswer, vibeStreak: newStreak, vibeMatch: vibeMatchResult });
  } catch (error) {
    console.error('Vibe answer error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get top 3 vibe matches
router.get('/top-matches', authenticate, async (req, res) => {
  try {
    const currentUser = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { role: true },
    });
    const oppositeRole = currentUser.role === 'STEPPER' ? 'BADDIE' : 'STEPPER';

    const myAnswers = await prisma.vibeAnswer.findMany({
      where: { userId: req.userId },
    });

    if (myAnswers.length < 5) {
      return res.json({ matches: [], minAnswers: 5 - myAnswers.length });
    }

    const myMap = new Map(myAnswers.map((a) => [a.questionId, a.answer]));

    // Get all opposite-role users who have answers (exclude hidden pairs)
    const hiddenIds = await getHiddenIds(req.userId);
    const excludeIds = hiddenIds.size > 0 ? [req.userId, ...hiddenIds] : [req.userId];

    const candidates = await prisma.user.findMany({
      where: {
        id: { notIn: excludeIds },
        role: oppositeRole,
        isBanned: false,
        isHidden: false,
        vibeAnswers: { some: {} },
      },
      select: {
        id: true,
        profile: { select: { displayName: true, photos: true } },
        vibeAnswers: { select: { questionId: true, answer: true } },
      },
    });

    const scores = candidates
      .map((c) => {
        let shared = 0;
        let matching = 0;
        for (const a of c.vibeAnswers) {
          if (myMap.has(a.questionId)) {
            shared++;
            if (myMap.get(a.questionId) === a.answer) matching++;
          }
        }
        if (shared < 5) return null;
        return {
          userId: c.id,
          displayName: c.profile?.displayName || 'Unknown',
          photo: Array.isArray(c.profile?.photos) ? c.profile.photos[0] : null,
          score: Math.round((matching / shared) * 100),
          shared,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    res.json({ matches: scores });
  } catch (error) {
    console.error('Top matches error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get vibe score with another user
router.get('/score/:userId', authenticate, async (req, res) => {
  try {
    if (await isHiddenFrom(req.userId, req.params.userId)) {
      return res.json({ score: null, sharedQuestions: 0, matchingAnswers: 0 });
    }

    const myAnswers = await prisma.vibeAnswer.findMany({ where: { userId: req.userId } });
    const theirAnswers = await prisma.vibeAnswer.findMany({ where: { userId: req.params.userId } });

    const myMap = new Map(myAnswers.map((a) => [a.questionId, a.answer]));
    let shared = 0;
    let matching = 0;

    for (const a of theirAnswers) {
      if (myMap.has(a.questionId)) {
        shared++;
        if (myMap.get(a.questionId) === a.answer) matching++;
      }
    }

    const score = shared > 0 ? Math.round((matching / shared) * 100) : null;

    res.json({ score, sharedQuestions: shared, matchingAnswers: matching });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
