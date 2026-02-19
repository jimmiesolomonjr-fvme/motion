import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function calculateVibeScore(userId1, userId2) {
  const [answers1, answers2] = await Promise.all([
    prisma.vibeAnswer.findMany({ where: { userId: userId1 } }),
    prisma.vibeAnswer.findMany({ where: { userId: userId2 } }),
  ]);

  const map1 = new Map(answers1.map((a) => [a.questionId, a.answer]));
  let shared = 0;
  let matching = 0;

  for (const a of answers2) {
    if (map1.has(a.questionId)) {
      shared++;
      if (map1.get(a.questionId) === a.answer) matching++;
    }
  }

  return {
    score: shared > 0 ? Math.round((matching / shared) * 100) : null,
    sharedQuestions: shared,
    matchingAnswers: matching,
  };
}
