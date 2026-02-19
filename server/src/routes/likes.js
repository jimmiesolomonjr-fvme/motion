import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

// Like a user
router.post('/:userId', authenticate, async (req, res) => {
  try {
    const likedId = req.params.userId;
    if (likedId === req.userId) {
      return res.status(400).json({ error: 'Cannot like yourself' });
    }

    // Check if already liked
    const existing = await prisma.like.findUnique({
      where: { likerId_likedId: { likerId: req.userId, likedId } },
    });
    if (existing) {
      return res.status(409).json({ error: 'Already liked' });
    }

    // Check if blocked
    const blocked = await prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: req.userId, blockedId: likedId },
          { blockerId: likedId, blockedId: req.userId },
        ],
      },
    });
    if (blocked) {
      return res.status(400).json({ error: 'Cannot like blocked user' });
    }

    await prisma.like.create({
      data: { likerId: req.userId, likedId },
    });

    // Check for mutual like (match)
    const mutualLike = await prisma.like.findUnique({
      where: { likerId_likedId: { likerId: likedId, likedId: req.userId } },
    });

    let match = null;
    if (mutualLike) {
      const [u1, u2] = [req.userId, likedId].sort();
      match = await prisma.match.upsert({
        where: { user1Id_user2Id: { user1Id: u1, user2Id: u2 } },
        update: {},
        create: { user1Id: u1, user2Id: u2 },
      });

      // Notify the other user about the match via socket
      try {
        const { io } = await import('../../server.js');
        const currentProfile = await prisma.profile.findUnique({ where: { userId: req.userId } });
        io.to(likedId).emit('match-notification', {
          matchId: match.id,
          user: {
            id: req.userId,
            displayName: currentProfile?.displayName,
            photo: currentProfile?.photos?.[0] || null,
          },
        });
      } catch {
        // Socket notification is best-effort
      }
    }

    res.json({ liked: true, matched: !!match, match });
  } catch (error) {
    console.error('Like error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Check if current user has liked a specific user
router.get('/check/:userId', authenticate, async (req, res) => {
  try {
    const like = await prisma.like.findUnique({
      where: { likerId_likedId: { likerId: req.userId, likedId: req.params.userId } },
    });
    res.json({ hasLiked: !!like });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Unlike a user
router.delete('/:userId', authenticate, async (req, res) => {
  try {
    await prisma.like.deleteMany({
      where: { likerId: req.userId, likedId: req.params.userId },
    });
    res.json({ unliked: true });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get matches
router.get('/matches', authenticate, async (req, res) => {
  try {
    const matches = await prisma.match.findMany({
      where: { OR: [{ user1Id: req.userId }, { user2Id: req.userId }] },
      include: {
        user1: { include: { profile: true } },
        user2: { include: { profile: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const result = matches.map((m) => {
      const other = m.user1Id === req.userId ? m.user2 : m.user1;
      return {
        matchId: m.id,
        matchedAt: m.createdAt,
        user: {
          id: other.id,
          role: other.role,
          isPremium: other.isPremium,
          isVerified: other.isVerified,
          lastOnline: other.lastOnline,
          profile: other.profile,
        },
      };
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Unmatch a user
router.delete('/unmatch/:userId', authenticate, async (req, res) => {
  try {
    const otherUserId = req.params.userId;
    const [u1, u2] = [req.userId, otherUserId].sort();

    const match = await prisma.match.findUnique({
      where: { user1Id_user2Id: { user1Id: u1, user2Id: u2 } },
    });

    if (!match) {
      return res.status(404).json({ error: 'Match not found' });
    }

    await prisma.$transaction(async (tx) => {
      // Delete match
      await tx.match.delete({ where: { id: match.id } });
      // Delete likes in both directions
      await tx.like.deleteMany({
        where: {
          OR: [
            { likerId: req.userId, likedId: otherUserId },
            { likerId: otherUserId, likedId: req.userId },
          ],
        },
      });
      // Find and delete conversation between the two users (messages cascade)
      const conv = await tx.conversation.findFirst({
        where: {
          OR: [
            { user1Id: req.userId, user2Id: otherUserId },
            { user1Id: otherUserId, user2Id: req.userId },
          ],
        },
      });
      if (conv) {
        await tx.conversation.delete({ where: { id: conv.id } });
      }
    });

    res.json({ unmatched: true });
  } catch (error) {
    console.error('Unmatch error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
