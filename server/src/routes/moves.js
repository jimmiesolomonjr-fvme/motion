import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth.js';
import { upload, uploadToCloud } from '../middleware/upload.js';

const router = Router();
const prisma = new PrismaClient();

const BLOCKED_WORDS = ['sex', 'fuck', 'pussy', 'dick', 'shit', 'ass', 'bitch', 'nigga', 'nigger', 'whore', 'slut', 'cock', 'cum'];

function containsOffensiveWords(text) {
  if (!text) return false;
  return BLOCKED_WORDS.some((word) => new RegExp(`\\b${word}\\b`, 'i').test(text));
}

// Auto-complete past moves: CONFIRMED past-date → COMPLETED, OPEN past-date → CANCELLED
async function autoCompletePastMoves() {
  const now = new Date();
  await prisma.move.updateMany({
    where: { status: 'CONFIRMED', date: { lt: now } },
    data: { status: 'COMPLETED' },
  });
  await prisma.move.updateMany({
    where: { status: 'OPEN', date: { lt: now } },
    data: { status: 'CANCELLED', isActive: false },
  });
}

// Create a Move (Steppers only)
router.post('/', authenticate, upload.single('photo'), async (req, res) => {
  try {
    if (req.userRole !== 'STEPPER') {
      return res.status(403).json({ error: 'Only Steppers can create Moves' });
    }

    const { title, description, date, location, maxInterest = 10, category, isAnytime } = req.body;

    if (!title || !description || !date || !location) {
      return res.status(400).json({ error: 'Title, description, date, and location are required' });
    }

    if (containsOffensiveWords(title) || containsOffensiveWords(description)) {
      return res.status(400).json({ error: 'Move contains inappropriate language' });
    }

    let photo = null;
    if (req.file) {
      photo = await uploadToCloud(req.file, 'motion/moves');
    }

    const anytime = isAnytime === 'true' || isAnytime === true;
    let moveDate = new Date(date);
    if (anytime) {
      moveDate.setHours(23, 59, 0, 0);
    }

    const move = await prisma.move.create({
      data: {
        stepperId: req.userId,
        title,
        description,
        date: moveDate,
        location,
        maxInterest: parseInt(maxInterest) || 10,
        category: category || null,
        photo,
        isAnytime: anytime,
      },
      include: { stepper: { include: { profile: true } } },
    });

    res.status(201).json(move);
  } catch (error) {
    console.error('Create move error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get active Moves
router.get('/', authenticate, async (req, res) => {
  try {
    await autoCompletePastMoves();

    const { category, sort, before, after } = req.query;

    const currentUser = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { isAdmin: true },
    });

    const twoHoursFromNow = new Date(Date.now() + 2 * 60 * 60 * 1000);

    const whereClause = {
      isActive: true,
      status: { in: ['OPEN', 'CONFIRMED'] },
      date: { gte: new Date() },
    };

    // Baddies: hide moves within 2h (interest already closed)
    if (req.userRole === 'BADDIE') {
      whereClause.date = { gte: twoHoursFromNow };
    }

    // Steppers only see their own moves (unless admin)
    if (req.userRole === 'STEPPER' && !currentUser?.isAdmin) {
      whereClause.stepperId = req.userId;
    }

    if (category) {
      whereClause.category = category;
    }
    if (before) {
      whereClause.date = { ...whereClause.date, lte: new Date(before) };
    }
    if (after) {
      whereClause.date = { ...whereClause.date, gte: new Date(after) };
    }

    let orderBy = { date: 'asc' };
    if (sort === 'newest') orderBy = { createdAt: 'desc' };
    // 'popular' sort handled after fetch

    const moves = await prisma.move.findMany({
      where: whereClause,
      include: {
        stepper: { include: { profile: true } },
        _count: { select: { interests: true } },
        interests: {
          take: 3,
          include: { baddie: { include: { profile: { select: { photos: true, displayName: true } } } } },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: sort === 'popular' ? { createdAt: 'desc' } : orderBy,
    });

    // Check which moves the current user has expressed interest in
    const userInterests = await prisma.moveInterest.findMany({
      where: { baddieId: req.userId },
      select: { moveId: true },
    });
    const interestedMoveIds = new Set(userInterests.map((i) => i.moveId));

    // Check which moves the current user has saved
    const userSaved = await prisma.savedMove.findMany({
      where: { userId: req.userId },
      select: { moveId: true },
    });
    const savedMoveIds = new Set(userSaved.map((s) => s.moveId));

    const now = Date.now();

    const isBaddie = req.userRole === 'BADDIE';

    let result = moves.map((m) => {
      const hoursUntil = (new Date(m.date).getTime() - now) / (1000 * 60 * 60);
      return {
        id: m.id,
        title: m.title,
        description: m.description,
        date: m.date,
        location: m.location,
        maxInterest: m.maxInterest,
        status: m.status,
        category: m.category,
        photo: m.photo,
        isAnytime: m.isAnytime,
        selectedBaddieId: m.selectedBaddieId,
        interestCount: m._count.interests,
        createdAt: m.createdAt,
        hasInterest: interestedMoveIds.has(m.id),
        isSaved: savedMoveIds.has(m.id),
        interestClosingSoon: hoursUntil <= 4 && hoursUntil > 2,
        interestClosed: hoursUntil <= 2,
        interestedBaddies: isBaddie ? [] : m.interests.map((i) => ({
          id: i.baddie.id,
          displayName: i.baddie.profile?.displayName,
          photo: Array.isArray(i.baddie.profile?.photos) ? i.baddie.profile.photos[0] : null,
        })),
        stepper: {
          id: m.stepper.id,
          isVerified: m.stepper.isVerified,
          profile: m.stepper.profile,
        },
      };
    });

    if (sort === 'popular') {
      result.sort((a, b) => b.interestCount - a.interestCount);
    }

    res.json(result);
  } catch (error) {
    console.error('Get moves error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get Stepper's own moves with interests
router.get('/mine', authenticate, async (req, res) => {
  try {
    if (req.userRole !== 'STEPPER') {
      return res.status(403).json({ error: 'Only Steppers have Moves' });
    }

    await autoCompletePastMoves();

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const moves = await prisma.move.findMany({
      where: {
        stepperId: req.userId,
        isActive: true,
        OR: [
          { status: 'OPEN', date: { gte: new Date() } },
          { status: 'CONFIRMED' },
          { status: 'COMPLETED', date: { gte: thirtyDaysAgo } },
        ],
      },
      include: {
        interests: {
          include: { baddie: { include: { profile: true } } },
          orderBy: { createdAt: 'desc' },
        },
        selectedBaddie: { include: { profile: true } },
      },
      orderBy: { date: 'asc' },
    });

    const result = moves.map((m) => ({
      ...m,
      dressCode: m.dressCode,
      playlistLink: m.playlistLink,
      stepperOnMyWay: m.stepperOnMyWay,
      baddieOnMyWay: m.baddieOnMyWay,
    }));

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all interests across stepper's moves (for messages page)
router.get('/interests', authenticate, async (req, res) => {
  try {
    if (req.userRole !== 'STEPPER') {
      return res.status(403).json({ error: 'Only Steppers have move interests' });
    }

    const interests = await prisma.moveInterest.findMany({
      where: { move: { stepperId: req.userId } },
      include: {
        baddie: { include: { profile: true } },
        move: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(interests.map((i) => ({
      id: i.id,
      moveId: i.move.id,
      moveTitle: i.move.title,
      message: i.message,
      counterProposal: i.counterProposal,
      createdAt: i.createdAt,
      baddie: {
        id: i.baddie.id,
        lastOnline: i.baddie.lastOnline,
        profile: i.baddie.profile,
      },
    })));
  } catch (error) {
    console.error('Get move interests error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get saved moves
router.get('/saved', authenticate, async (req, res) => {
  try {
    await autoCompletePastMoves();

    const saved = await prisma.savedMove.findMany({
      where: { userId: req.userId },
      include: {
        move: {
          include: {
            stepper: { include: { profile: true } },
            _count: { select: { interests: true } },
            interests: {
              take: 3,
              include: { baddie: { include: { profile: { select: { photos: true, displayName: true } } } } },
              orderBy: { createdAt: 'desc' },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const userInterests = await prisma.moveInterest.findMany({
      where: { baddieId: req.userId },
      select: { moveId: true },
    });
    const interestedMoveIds = new Set(userInterests.map((i) => i.moveId));

    const now = Date.now();

    const isBaddieSaved = req.userRole === 'BADDIE';

    const result = saved.map((s) => {
      const m = s.move;
      const hoursUntil = (new Date(m.date).getTime() - now) / (1000 * 60 * 60);
      return {
        id: m.id,
        title: m.title,
        description: m.description,
        date: m.date,
        location: m.location,
        maxInterest: m.maxInterest,
        status: m.status,
        category: m.category,
        photo: m.photo,
        isAnytime: m.isAnytime,
        selectedBaddieId: m.selectedBaddieId,
        interestCount: m._count.interests,
        createdAt: m.createdAt,
        hasInterest: interestedMoveIds.has(m.id),
        isSaved: true,
        interestClosingSoon: hoursUntil <= 4 && hoursUntil > 2,
        interestClosed: hoursUntil <= 2,
        interestedBaddies: isBaddieSaved ? [] : m.interests.map((i) => ({
          id: i.baddie.id,
          displayName: i.baddie.profile?.displayName,
          photo: Array.isArray(i.baddie.profile?.photos) ? i.baddie.profile.photos[0] : null,
        })),
        stepper: {
          id: m.stepper.id,
          isVerified: m.stepper.isVerified,
          profile: m.stepper.profile,
        },
      };
    });

    res.json(result);
  } catch (error) {
    console.error('Get saved moves error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get expired moves (Steppers only)
router.get('/expired', authenticate, async (req, res) => {
  try {
    if (req.userRole !== 'STEPPER') {
      return res.status(403).json({ error: 'Only Steppers can view expired Moves' });
    }

    await autoCompletePastMoves();

    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    const moves = await prisma.move.findMany({
      where: {
        stepperId: req.userId,
        status: { in: ['CANCELLED', 'COMPLETED'] },
        date: { gte: ninetyDaysAgo },
      },
      include: {
        _count: { select: { interests: true } },
      },
      orderBy: { date: 'desc' },
    });

    const result = moves.map((m) => ({
      id: m.id,
      title: m.title,
      description: m.description,
      date: m.date,
      location: m.location,
      category: m.category,
      photo: m.photo,
      isAnytime: m.isAnytime,
      maxInterest: m.maxInterest,
      status: m.status,
      interestCount: m._count.interests,
      createdAt: m.createdAt,
    }));

    res.json(result);
  } catch (error) {
    console.error('Get expired moves error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Clear all expired moves (Steppers only)
router.delete('/expired/clear', authenticate, async (req, res) => {
  try {
    if (req.userRole !== 'STEPPER') {
      return res.status(403).json({ error: 'Only Steppers can clear expired Moves' });
    }

    await prisma.move.deleteMany({
      where: {
        stepperId: req.userId,
        status: { in: ['CANCELLED', 'COMPLETED'] },
      },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Clear expired moves error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get move history for a user's profile
router.get('/history/:userId', authenticate, async (req, res) => {
  try {
    const targetUser = await prisma.user.findUnique({
      where: { id: req.params.userId },
      select: { role: true },
    });

    if (!targetUser || targetUser.role !== 'STEPPER') {
      return res.json({ completedCount: 0, recentMoves: [] });
    }

    const completedCount = await prisma.move.count({
      where: { stepperId: req.params.userId, status: 'COMPLETED' },
    });

    const recentMoves = await prisma.move.findMany({
      where: { stepperId: req.params.userId, status: 'COMPLETED' },
      select: { title: true, date: true, category: true, location: true },
      orderBy: { date: 'desc' },
      take: 5,
    });

    res.json({ completedCount, recentMoves });
  } catch (error) {
    console.error('Get move history error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Express interest in a Move (Baddies only)
router.post('/:moveId/interest', authenticate, async (req, res) => {
  try {
    if (req.userRole !== 'BADDIE') {
      return res.status(403).json({ error: 'Only Baddies can express interest in Moves' });
    }

    const move = await prisma.move.findUnique({
      where: { id: req.params.moveId },
      include: { _count: { select: { interests: true } } },
    });

    if (!move || !move.isActive) {
      return res.status(404).json({ error: 'Move not found or no longer active' });
    }

    if (move.status !== 'OPEN') {
      return res.status(400).json({ error: 'This Move is no longer accepting interest' });
    }

    // 2-hour window check
    const hoursUntilMove = (new Date(move.date).getTime() - Date.now()) / (1000 * 60 * 60);
    if (hoursUntilMove <= 2) {
      return res.status(400).json({ error: 'Interest window has closed (less than 2 hours before the Move)' });
    }

    if (move._count.interests >= move.maxInterest) {
      return res.status(400).json({ error: 'This Move has reached maximum interest' });
    }

    const interest = await prisma.moveInterest.create({
      data: {
        moveId: req.params.moveId,
        baddieId: req.userId,
        message: req.body.message || null,
        counterProposal: req.body.counterProposal || null,
      },
    });

    // Create notification for Stepper
    const baddieProfile = await prisma.profile.findUnique({
      where: { userId: req.userId },
      select: { displayName: true },
    });

    await prisma.notification.create({
      data: {
        userId: move.stepperId,
        type: 'move_interest',
        title: 'New Interest',
        body: `${baddieProfile?.displayName || 'Someone'} is interested in "${move.title}"`,
        data: { moveId: move.id, baddieId: req.userId },
      },
    });

    // Emit socket notification
    try {
      const { io } = await import('../../server.js');
      if (io) {
        io.to(move.stepperId).emit('notification', {
          type: 'move_interest',
          moveId: move.id,
          baddieId: req.userId,
        });
      }
    } catch {}

    res.status(201).json(interest);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Already expressed interest' });
    }
    console.error('Move interest error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Repost a Move (Stepper only - creates a new move from an expired one)
router.post('/:moveId/repost', authenticate, async (req, res) => {
  try {
    const original = await prisma.move.findUnique({
      where: { id: req.params.moveId },
    });

    if (!original || original.stepperId !== req.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { date, isAnytime } = req.body;
    if (!date) {
      return res.status(400).json({ error: 'Date is required for repost' });
    }

    const anytime = isAnytime === 'true' || isAnytime === true;
    let moveDate = new Date(date);
    if (anytime) {
      moveDate.setHours(23, 59, 0, 0);
    }

    const newMove = await prisma.move.create({
      data: {
        stepperId: req.userId,
        title: original.title,
        description: original.description,
        date: moveDate,
        location: original.location,
        category: original.category,
        photo: original.photo,
        maxInterest: original.maxInterest,
        isAnytime: anytime,
        status: 'OPEN',
        isActive: true,
      },
      include: { stepper: { include: { profile: true } } },
    });

    res.status(201).json(newMove);
  } catch (error) {
    console.error('Repost move error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Select a Baddie for a Move (Stepper only)
router.put('/:moveId/select/:baddieId', authenticate, async (req, res) => {
  try {
    const move = await prisma.move.findUnique({
      where: { id: req.params.moveId },
      include: {
        interests: { select: { baddieId: true } },
      },
    });

    if (!move || move.stepperId !== req.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (move.status !== 'OPEN') {
      return res.status(400).json({ error: 'Move is not open for selection' });
    }

    const baddieHasInterest = move.interests.some((i) => i.baddieId === req.params.baddieId);
    if (!baddieHasInterest) {
      return res.status(400).json({ error: 'This Baddie has not expressed interest' });
    }

    const updated = await prisma.move.update({
      where: { id: req.params.moveId },
      data: { status: 'CONFIRMED', selectedBaddieId: req.params.baddieId },
      include: {
        stepper: { include: { profile: true } },
        selectedBaddie: { include: { profile: true } },
        interests: {
          include: { baddie: { include: { profile: true } } },
        },
      },
    });

    // Notify selected Baddie
    await prisma.notification.create({
      data: {
        userId: req.params.baddieId,
        type: 'move_selected',
        title: 'You\'ve been chosen!',
        body: `You've been chosen for "${move.title}"!`,
        data: { moveId: move.id },
      },
    });

    // Notify non-selected Baddies
    const otherBaddies = move.interests
      .filter((i) => i.baddieId !== req.params.baddieId)
      .map((i) => i.baddieId);

    if (otherBaddies.length > 0) {
      await prisma.notification.createMany({
        data: otherBaddies.map((baddieId) => ({
          userId: baddieId,
          type: 'move_closed',
          title: 'Move Confirmed',
          body: `"${move.title}" has been confirmed with someone else`,
          data: { moveId: move.id },
        })),
      });
    }

    // Emit socket events
    try {
      const { io } = await import('../../server.js');
      if (io) {
        io.to(req.params.baddieId).emit('notification', {
          type: 'move_selected',
          moveId: move.id,
        });
        otherBaddies.forEach((baddieId) => {
          io.to(baddieId).emit('notification', {
            type: 'move_closed',
            moveId: move.id,
          });
        });
      }
    } catch {}

    res.json(updated);
  } catch (error) {
    console.error('Select baddie error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update planning details for a confirmed Move
router.put('/:moveId/planning', authenticate, async (req, res) => {
  try {
    const move = await prisma.move.findUnique({
      where: { id: req.params.moveId },
    });

    if (!move || move.status !== 'CONFIRMED') {
      return res.status(400).json({ error: 'Move is not confirmed' });
    }

    const isStepper = move.stepperId === req.userId;
    const isBaddie = move.selectedBaddieId === req.userId;

    if (!isStepper && !isBaddie) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { dressCode, playlistLink, onMyWay } = req.body;
    const updateData = {};

    if (dressCode !== undefined) updateData.dressCode = dressCode;
    if (playlistLink !== undefined) updateData.playlistLink = playlistLink;
    if (onMyWay !== undefined) {
      if (isStepper) updateData.stepperOnMyWay = onMyWay;
      if (isBaddie) updateData.baddieOnMyWay = onMyWay;
    }

    const updated = await prisma.move.update({
      where: { id: req.params.moveId },
      data: updateData,
      include: {
        stepper: { include: { profile: true } },
        selectedBaddie: { include: { profile: true } },
      },
    });

    // Emit planning update to the other party
    try {
      const { io } = await import('../../server.js');
      if (io) {
        const targetId = isStepper ? move.selectedBaddieId : move.stepperId;
        io.to(targetId).emit('move-planning-update', {
          moveId: move.id,
          ...updateData,
        });
      }
    } catch {}

    res.json(updated);
  } catch (error) {
    console.error('Update planning error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Save a move
router.post('/:moveId/save', authenticate, async (req, res) => {
  try {
    const saved = await prisma.savedMove.create({
      data: { userId: req.userId, moveId: req.params.moveId },
    });
    res.status(201).json(saved);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Already saved' });
    }
    console.error('Save move error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Unsave a move
router.delete('/:moveId/save', authenticate, async (req, res) => {
  try {
    await prisma.savedMove.deleteMany({
      where: { userId: req.userId, moveId: req.params.moveId },
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Unsave move error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete a move interest (Stepper only - for their own moves)
router.delete('/interests/:interestId', authenticate, async (req, res) => {
  try {
    const interest = await prisma.moveInterest.findUnique({
      where: { id: req.params.interestId },
      include: { move: { select: { stepperId: true } } },
    });

    if (!interest || interest.move.stepperId !== req.userId) {
      return res.status(404).json({ error: 'Interest not found' });
    }

    await prisma.moveInterest.delete({ where: { id: req.params.interestId } });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete interest error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete a Move (owner or admin)
router.delete('/:moveId', authenticate, async (req, res) => {
  try {
    const move = await prisma.move.findUnique({ where: { id: req.params.moveId } });
    if (!move) {
      return res.status(404).json({ error: 'Move not found' });
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { isAdmin: true },
    });

    if (move.stepperId !== req.userId && !currentUser?.isAdmin) {
      return res.status(403).json({ error: 'Not authorized to delete this move' });
    }

    await prisma.move.update({
      where: { id: req.params.moveId },
      data: { isActive: false, status: 'CANCELLED' },
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
