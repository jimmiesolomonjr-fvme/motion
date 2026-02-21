import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth.js';

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

    const questions = await prisma.vibeQuestion.findMany({
      where: {
        isActive: true,
        ...(answeredIds.length > 0 && { id: { notIn: answeredIds } }),
      },
      take: 25 - answeredInWindow,
    });

    res.json({ questions, remaining: 25 - answeredInWindow });
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

    res.json(vibeAnswer);
  } catch (error) {
    console.error('Vibe answer error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get vibe score with another user
router.get('/score/:userId', authenticate, async (req, res) => {
  try {
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
