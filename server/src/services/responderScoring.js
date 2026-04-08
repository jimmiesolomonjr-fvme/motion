import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function getTopResponders(userId, limit = 5) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: { select: { age: true, city: true } } },
  });
  if (!user || !user.profile) return [];

  const oppositeRole = user.role === 'STEPPER' ? 'BADDIE' : 'STEPPER';
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Get blocked IDs (both directions)
  const blocks = await prisma.block.findMany({
    where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
  });
  const blockedIds = blocks.map((b) => (b.blockerId === userId ? b.blockedId : b.blockerId));

  const candidates = await prisma.user.findMany({
    where: {
      role: oppositeRole,
      isBanned: false,
      isHidden: false,
      isDummy: false,
      lastOnline: { gte: oneDayAgo },
      profile: { isNot: null },
      id: { notIn: [userId, ...blockedIds] },
    },
    include: { profile: { select: { age: true, city: true } } },
    take: 50,
    orderBy: { lastOnline: 'desc' },
  });

  if (candidates.length === 0) return [];

  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const candidateIds = candidates.map((c) => c.id);

  // Batch: messages sent in last 7 days by candidates
  const recentMessages = await prisma.message.groupBy({
    by: ['senderId'],
    where: { senderId: { in: candidateIds }, createdAt: { gte: oneWeekAgo } },
    _count: true,
  });
  const messageCounts = new Map(recentMessages.map((r) => [r.senderId, r._count]));

  // Batch: replies (messages where candidate is sender AND conversation has messages from someone else)
  const recentReplies = await prisma.message.findMany({
    where: {
      senderId: { in: candidateIds },
      createdAt: { gte: oneWeekAgo },
      conversation: {
        messages: { some: { senderId: { notIn: candidateIds }, createdAt: { gte: oneWeekAgo } } },
      },
    },
    select: { senderId: true },
    distinct: ['senderId'],
  });
  const replierIds = new Set(recentReplies.map((r) => r.senderId));

  const scored = candidates.map((c) => {
    let score = 0;
    if ((messageCounts.get(c.id) || 0) >= 1) score += 3;
    if (replierIds.has(c.id)) score += 2;
    if (c.lastOnline >= oneHourAgo) score += 1;
    if (user.profile.city && c.profile?.city === user.profile.city) score += 1;
    if (user.profile.age && c.profile?.age && Math.abs(user.profile.age - c.profile.age) <= 5) score += 1;
    return { id: c.id, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.id);
}
