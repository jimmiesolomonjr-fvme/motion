import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth.js';
import { upload, uploadToCloud, deleteFromCloud } from '../middleware/upload.js';
import { getHiddenIds, isHiddenFrom } from '../utils/hiddenPairs.js';

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

// Create a Move (both Steppers and Baddies)
router.post('/', authenticate, upload.single('photo'), async (req, res) => {
  try {
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
        creatorId: req.userId,
        stepperId: req.userRole === 'STEPPER' ? req.userId : null,
        title,
        description,
        date: moveDate,
        location,
        maxInterest: parseInt(maxInterest) || 10,
        category: category || null,
        photo,
        isAnytime: anytime,
      },
      include: {
        creator: { include: { profile: true } },
        stepper: { include: { profile: true } },
      },
    });

    res.status(201).json(move);
  } catch (error) {
    console.error('Create move error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Edit a Move (creator only, OPEN only, within 10 minutes)
router.put('/:moveId', authenticate, upload.single('photo'), async (req, res) => {
  try {
    const move = await prisma.move.findUnique({ where: { id: req.params.moveId } });

    if (!move) {
      return res.status(404).json({ error: 'Move not found' });
    }
    if (move.creatorId !== req.userId) {
      return res.status(403).json({ error: 'Not authorized to edit this move' });
    }
    if (move.status !== 'OPEN') {
      return res.status(400).json({ error: 'Only OPEN moves can be edited' });
    }
    if ((Date.now() - new Date(move.createdAt).getTime()) / 60000 > 10) {
      return res.status(400).json({ error: 'Editing window has expired (10 minutes)' });
    }

    const { title, description, date, location, maxInterest, category, isAnytime } = req.body;

    if (containsOffensiveWords(title) || containsOffensiveWords(description)) {
      return res.status(400).json({ error: 'Move contains inappropriate language' });
    }

    const updateData = {};
    if (title) updateData.title = title;
    if (description) updateData.description = description;
    if (location) updateData.location = location;
    if (maxInterest) updateData.maxInterest = parseInt(maxInterest) || move.maxInterest;
    if (category !== undefined) updateData.category = category || null;

    if (date) {
      const anytime = isAnytime === 'true' || isAnytime === true;
      let moveDate = new Date(date);
      if (anytime) {
        moveDate.setHours(23, 59, 0, 0);
      }
      updateData.date = moveDate;
      updateData.isAnytime = anytime;
    }

    if (req.file) {
      // Delete old photo from cloud if it exists
      if (move.photo) {
        await deleteFromCloud(move.photo);
      }
      updateData.photo = await uploadToCloud(req.file, 'motion/moves');
    }

    const updated = await prisma.move.update({
      where: { id: req.params.moveId },
      data: updateData,
      include: {
        creator: { include: { profile: true } },
        stepper: { include: { profile: true } },
      },
    });

    res.json(updated);
  } catch (error) {
    console.error('Edit move error:', error);
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
      select: { isAdmin: true, role: true },
    });

    const hiddenIds = await getHiddenIds(req.userId);
    const twoHoursFromNow = new Date(Date.now() + 2 * 60 * 60 * 1000);

    const whereClause = {
      isActive: true,
      status: { in: ['OPEN', 'CONFIRMED'] },
      date: { gte: new Date() },
      ...(hiddenIds.size > 0 && { creatorId: { notIn: [...hiddenIds] } }),
    };

    // Hide moves within 2h (interest already closed) for non-creators
    if (!currentUser?.isAdmin) {
      whereClause.OR = [
        { date: { gte: twoHoursFromNow } },
        { creatorId: req.userId },
      ];
    }

    // Steppers only see their own Stepper-created moves + Baddie proposals (unless admin)
    if (currentUser?.role === 'STEPPER' && !currentUser?.isAdmin) {
      whereClause.OR = [
        { creatorId: req.userId },
        // Baddie proposals — show to Steppers
        { creator: { role: 'BADDIE' }, date: { gte: twoHoursFromNow } },
      ];
    }

    // Baddies see Stepper-created moves (not other Baddies' own) + their own
    if (currentUser?.role === 'BADDIE') {
      whereClause.OR = [
        { creatorId: req.userId },
        { creator: { role: 'STEPPER' }, date: { gte: twoHoursFromNow } },
      ];
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
        creator: { include: { profile: true } },
        stepper: { include: { profile: true } },
        _count: { select: { interests: true } },
        interests: {
          take: 3,
          include: { user: { include: { profile: { select: { photos: true, displayName: true } } } } },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: sort === 'popular' ? { createdAt: 'desc' } : orderBy,
    });

    // Check which moves the current user has expressed interest in
    const userInterests = await prisma.moveInterest.findMany({
      where: { userId: req.userId },
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

    const isCreator = (m) => m.creatorId === req.userId;

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
        stepperId: m.stepperId,
        creatorId: m.creatorId,
        interestCount: m._count.interests,
        createdAt: m.createdAt,
        hasInterest: interestedMoveIds.has(m.id),
        isSaved: savedMoveIds.has(m.id),
        interestClosingSoon: hoursUntil <= 4 && hoursUntil > 2,
        interestClosed: hoursUntil <= 2,
        interestedUsers: isCreator(m) ? m.interests.map((i) => ({
          id: i.user.id,
          displayName: i.user.profile?.displayName,
          photo: Array.isArray(i.user.profile?.photos) ? i.user.profile.photos[0] : null,
        })) : [],
        creator: {
          id: m.creator.id,
          role: m.creator.role,
          isVerified: m.creator.isVerified,
          profile: m.creator.profile,
        },
        stepper: m.stepper ? {
          id: m.stepper.id,
          isVerified: m.stepper.isVerified,
          profile: m.stepper.profile,
        } : null,
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

// Get user's own moves with interests
router.get('/mine', authenticate, async (req, res) => {
  try {
    await autoCompletePastMoves();

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const moves = await prisma.move.findMany({
      where: {
        creatorId: req.userId,
        isActive: true,
        OR: [
          { status: 'OPEN', date: { gte: new Date() } },
          { status: 'CONFIRMED' },
          { status: 'COMPLETED', date: { gte: thirtyDaysAgo } },
        ],
      },
      include: {
        creator: { include: { profile: true } },
        interests: {
          include: { user: { include: { profile: true } } },
          orderBy: { createdAt: 'desc' },
        },
        selectedBaddie: { include: { profile: true } },
        stepper: { include: { profile: true } },
        participants: {
          include: { baddie: { include: { profile: true } } },
        },
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

// Get all interests across user's moves (for messages page)
router.get('/interests', authenticate, async (req, res) => {
  try {
    const hiddenIds = await getHiddenIds(req.userId);

    const interests = await prisma.moveInterest.findMany({
      where: {
        move: { creatorId: req.userId },
        ...(hiddenIds.size > 0 && { userId: { notIn: [...hiddenIds] } }),
      },
      include: {
        user: { include: { profile: true } },
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
      user: {
        id: i.user.id,
        lastOnline: i.user.lastOnline,
        profile: i.user.profile,
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

    const hiddenIds = await getHiddenIds(req.userId);

    const saved = await prisma.savedMove.findMany({
      where: {
        userId: req.userId,
        ...(hiddenIds.size > 0 && { move: { creatorId: { notIn: [...hiddenIds] } } }),
      },
      include: {
        move: {
          include: {
            creator: { include: { profile: true } },
            stepper: { include: { profile: true } },
            _count: { select: { interests: true } },
            interests: {
              take: 3,
              include: { user: { include: { profile: { select: { photos: true, displayName: true } } } } },
              orderBy: { createdAt: 'desc' },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const userInterests = await prisma.moveInterest.findMany({
      where: { userId: req.userId },
      select: { moveId: true },
    });
    const interestedMoveIds = new Set(userInterests.map((i) => i.moveId));

    const now = Date.now();

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
        stepperId: m.stepperId,
        creatorId: m.creatorId,
        interestCount: m._count.interests,
        createdAt: m.createdAt,
        hasInterest: interestedMoveIds.has(m.id),
        isSaved: true,
        interestClosingSoon: hoursUntil <= 4 && hoursUntil > 2,
        interestClosed: hoursUntil <= 2,
        interestedUsers: [],
        creator: {
          id: m.creator.id,
          role: m.creator.role,
          isVerified: m.creator.isVerified,
          profile: m.creator.profile,
        },
        stepper: m.stepper ? {
          id: m.stepper.id,
          isVerified: m.stepper.isVerified,
          profile: m.stepper.profile,
        } : null,
      };
    });

    res.json(result);
  } catch (error) {
    console.error('Get saved moves error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get expired moves
router.get('/expired', authenticate, async (req, res) => {
  try {
    await autoCompletePastMoves();

    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    const moves = await prisma.move.findMany({
      where: {
        creatorId: req.userId,
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

// Clear all expired moves
router.delete('/expired/clear', authenticate, async (req, res) => {
  try {
    await prisma.move.deleteMany({
      where: {
        creatorId: req.userId,
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
    if (await isHiddenFrom(req.userId, req.params.userId)) {
      return res.json({ completedCount: 0, recentMoves: [] });
    }

    const completedCount = await prisma.move.count({
      where: { creatorId: req.params.userId, status: 'COMPLETED' },
    });

    const recentMoves = await prisma.move.findMany({
      where: { creatorId: req.params.userId, status: 'COMPLETED' },
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

// Express interest in a Move (opposite role of creator)
router.post('/:moveId/interest', authenticate, async (req, res) => {
  try {
    const move = await prisma.move.findUnique({
      where: { id: req.params.moveId },
      include: {
        creator: { select: { role: true } },
        _count: { select: { interests: true } },
      },
    });

    if (!move || !move.isActive) {
      return res.status(404).json({ error: 'Move not found or no longer active' });
    }

    // Must be opposite role of creator
    if (move.creator.role === req.userRole) {
      return res.status(403).json({ error: 'You can only express interest in moves from the other role' });
    }

    if (move.status !== 'OPEN') {
      return res.status(400).json({ error: 'This Move is no longer accepting interest' });
    }

    if (await isHiddenFrom(req.userId, move.creatorId)) {
      return res.status(403).json({ error: 'Cannot interact with this Move' });
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
        userId: req.userId,
        message: req.body.message || null,
        counterProposal: req.body.counterProposal || null,
      },
    });

    // Create notification for move creator
    const userProfile = await prisma.profile.findUnique({
      where: { userId: req.userId },
      select: { displayName: true },
    });

    await prisma.notification.create({
      data: {
        userId: move.creatorId,
        type: 'move_interest',
        title: 'New Interest',
        body: `${userProfile?.displayName || 'Someone'} is interested in "${move.title}"`,
        data: { moveId: move.id, userId: req.userId },
      },
    });

    // Emit socket notification
    try {
      const { io } = await import('../../server.js');
      if (io) {
        io.to(move.creatorId).emit('notification', {
          type: 'move_interest',
          moveId: move.id,
          userId: req.userId,
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

// Repost a Move (creator only - creates a new move from an expired one)
router.post('/:moveId/repost', authenticate, async (req, res) => {
  try {
    const original = await prisma.move.findUnique({
      where: { id: req.params.moveId },
    });

    if (!original || original.creatorId !== req.userId) {
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
        creatorId: req.userId,
        stepperId: req.userRole === 'STEPPER' ? req.userId : null,
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
      include: {
        creator: { include: { profile: true } },
        stepper: { include: { profile: true } },
      },
    });

    res.status(201).json(newMove);
  } catch (error) {
    console.error('Repost move error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Select a user for a Move (creator only)
router.put('/:moveId/select/:selectedUserId', authenticate, async (req, res) => {
  try {
    const move = await prisma.move.findUnique({
      where: { id: req.params.moveId },
      include: {
        creator: { select: { role: true } },
        interests: { select: { userId: true } },
      },
    });

    if (!move || move.creatorId !== req.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (move.status !== 'OPEN') {
      return res.status(400).json({ error: 'Move is not open for selection' });
    }

    const hasInterest = move.interests.some((i) => i.userId === req.params.selectedUserId);
    if (!hasInterest) {
      return res.status(400).json({ error: 'This user has not expressed interest' });
    }

    // For Baddie proposals selecting a Stepper: set stepperId
    // For Stepper moves selecting a Baddie: set selectedBaddieId
    const updateData = { status: 'CONFIRMED' };
    if (move.creator.role === 'BADDIE') {
      updateData.stepperId = req.params.selectedUserId;
    } else {
      updateData.selectedBaddieId = req.params.selectedUserId;
    }

    const updated = await prisma.move.update({
      where: { id: req.params.moveId },
      data: updateData,
      include: {
        creator: { include: { profile: true } },
        stepper: { include: { profile: true } },
        selectedBaddie: { include: { profile: true } },
        interests: {
          include: { user: { include: { profile: true } } },
        },
      },
    });

    // Notify selected user
    await prisma.notification.create({
      data: {
        userId: req.params.selectedUserId,
        type: 'move_selected',
        title: 'You\'ve been chosen!',
        body: `You've been chosen for "${move.title}"!`,
        data: { moveId: move.id },
      },
    });

    // Notify non-selected users
    const otherUsers = move.interests
      .filter((i) => i.userId !== req.params.selectedUserId)
      .map((i) => i.userId);

    if (otherUsers.length > 0) {
      await prisma.notification.createMany({
        data: otherUsers.map((userId) => ({
          userId,
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
        io.to(req.params.selectedUserId).emit('notification', {
          type: 'move_selected',
          moveId: move.id,
        });
        otherUsers.forEach((userId) => {
          io.to(userId).emit('notification', {
            type: 'move_closed',
            moveId: move.id,
          });
        });
      }
    } catch {}

    res.json(updated);
  } catch (error) {
    console.error('Select user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Select multiple Baddies for a GROUP Move (Stepper only)
router.put('/:moveId/select-group', authenticate, async (req, res) => {
  try {
    const { baddieIds } = req.body;

    if (!Array.isArray(baddieIds) || baddieIds.length === 0) {
      return res.status(400).json({ error: 'At least one user must be selected' });
    }

    const move = await prisma.move.findUnique({
      where: { id: req.params.moveId },
      include: {
        interests: { select: { userId: true } },
      },
    });

    if (!move || move.creatorId !== req.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (move.status !== 'OPEN') {
      return res.status(400).json({ error: 'Move is not open for selection' });
    }

    if (move.category !== 'GROUP') {
      return res.status(400).json({ error: 'This endpoint is only for GROUP moves' });
    }

    // Validate all selected users have expressed interest
    const interestedIds = new Set(move.interests.map((i) => i.userId));
    const invalidIds = baddieIds.filter((id) => !interestedIds.has(id));
    if (invalidIds.length > 0) {
      return res.status(400).json({ error: 'Some selected users have not expressed interest' });
    }

    // Transaction: create participants + confirm move
    const updated = await prisma.$transaction(async (tx) => {
      // Create participant records
      await tx.moveParticipant.createMany({
        data: baddieIds.map((baddieId) => ({
          moveId: move.id,
          baddieId,
        })),
        skipDuplicates: true,
      });

      // Confirm the move (no selectedBaddieId for group)
      return tx.move.update({
        where: { id: move.id },
        data: { status: 'CONFIRMED' },
        include: {
          creator: { include: { profile: true } },
          stepper: { include: { profile: true } },
          interests: {
            include: { user: { include: { profile: true } } },
          },
          participants: {
            include: { baddie: { include: { profile: true } } },
          },
        },
      });
    });

    // Notify selected users
    await prisma.notification.createMany({
      data: baddieIds.map((baddieId) => ({
        userId: baddieId,
        type: 'move_selected',
        title: 'You\'ve been chosen!',
        body: `You've been chosen for the group move "${move.title}"!`,
        data: { moveId: move.id },
      })),
    });

    // Notify non-selected users
    const selectedSet = new Set(baddieIds);
    const otherUsers = move.interests
      .filter((i) => !selectedSet.has(i.userId))
      .map((i) => i.userId);

    if (otherUsers.length > 0) {
      await prisma.notification.createMany({
        data: otherUsers.map((userId) => ({
          userId,
          type: 'move_closed',
          title: 'Move Confirmed',
          body: `"${move.title}" has been confirmed with others`,
          data: { moveId: move.id },
        })),
      });
    }

    // Emit socket events
    try {
      const { io } = await import('../../server.js');
      if (io) {
        baddieIds.forEach((baddieId) => {
          io.to(baddieId).emit('notification', { type: 'move_selected', moveId: move.id });
        });
        otherUsers.forEach((userId) => {
          io.to(userId).emit('notification', { type: 'move_closed', moveId: move.id });
        });
      }
    } catch {}

    res.json(updated);
  } catch (error) {
    console.error('Select group error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update planning details for a confirmed Move
router.put('/:moveId/planning', authenticate, async (req, res) => {
  try {
    const move = await prisma.move.findUnique({
      where: { id: req.params.moveId },
      include: { participants: true },
    });

    if (!move || move.status !== 'CONFIRMED') {
      return res.status(400).json({ error: 'Move is not confirmed' });
    }

    const isCreator = move.creatorId === req.userId;
    const isStepper = move.stepperId === req.userId;
    const isBaddie = move.selectedBaddieId === req.userId;
    const isGroupParticipant = move.category === 'GROUP' && move.participants.some((p) => p.baddieId === req.userId);

    if (!isCreator && !isStepper && !isBaddie && !isGroupParticipant) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { dressCode, playlistLink, onMyWay } = req.body;
    const updateData = {};

    if (dressCode !== undefined) updateData.dressCode = dressCode;
    if (playlistLink !== undefined) updateData.playlistLink = playlistLink;

    if (onMyWay !== undefined) {
      if (isCreator || isStepper) {
        updateData.stepperOnMyWay = onMyWay;
      } else if (isGroupParticipant) {
        await prisma.moveParticipant.updateMany({
          where: { moveId: move.id, baddieId: req.userId },
          data: { onMyWay },
        });
      } else if (isBaddie) {
        updateData.baddieOnMyWay = onMyWay;
      }
    }

    const updated = await prisma.move.update({
      where: { id: req.params.moveId },
      data: updateData,
      include: {
        creator: { include: { profile: true } },
        stepper: { include: { profile: true } },
        selectedBaddie: { include: { profile: true } },
        participants: {
          include: { baddie: { include: { profile: true } } },
        },
      },
    });

    // Emit planning update
    try {
      const { io } = await import('../../server.js');
      if (io) {
        if (move.category === 'GROUP' && move.participants.length > 0) {
          const targetIds = [move.creatorId, move.stepperId, ...move.participants.map((p) => p.baddieId)].filter((id) => id && id !== req.userId);
          targetIds.forEach((id) => {
            io.to(id).emit('move-planning-update', { moveId: move.id, ...updateData });
          });
        } else {
          const otherIds = [move.creatorId, move.stepperId, move.selectedBaddieId].filter((id) => id && id !== req.userId);
          otherIds.forEach((id) => {
            io.to(id).emit('move-planning-update', { moveId: move.id, ...updateData });
          });
        }
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

// Delete a move interest (creator only - for their own moves)
router.delete('/interests/:interestId', authenticate, async (req, res) => {
  try {
    const interest = await prisma.moveInterest.findUnique({
      where: { id: req.params.interestId },
      include: { move: { select: { creatorId: true } } },
    });

    if (!interest || interest.move.creatorId !== req.userId) {
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

    if (move.creatorId !== req.userId && !currentUser?.isAdmin) {
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
