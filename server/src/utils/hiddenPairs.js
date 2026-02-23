import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Get all user IDs hidden from a given user (both directions).
 * Returns a Set for O(1) lookup.
 */
export async function getHiddenIds(userId) {
  const pairs = await prisma.hiddenPair.findMany({
    where: { OR: [{ user1Id: userId }, { user2Id: userId }] },
    select: { user1Id: true, user2Id: true },
  });
  return new Set(pairs.map((p) => (p.user1Id === userId ? p.user2Id : p.user1Id)));
}

/**
 * Check if two specific users are in a hidden pair.
 */
export async function isHiddenFrom(userId1, userId2) {
  const pair = await prisma.hiddenPair.findFirst({
    where: {
      OR: [
        { user1Id: userId1, user2Id: userId2 },
        { user1Id: userId2, user2Id: userId1 },
      ],
    },
  });
  return !!pair;
}
