import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

// Create a Move (Steppers only)
router.post('/', authenticate, async (req, res) => {
  try {
    if (req.userRole !== 'STEPPER') {
      return res.status(403).json({ error: 'Only Steppers can create Moves' });
    }

    const { title, description, date, location, maxInterest = 10 } = req.body;

    if (!title || !description || !date || !location) {
      return res.status(400).json({ error: 'Title, description, date, and location are required' });
    }

    const move = await prisma.move.create({
      data: {
        stepperId: req.userId,
        title,
        description,
        date: new Date(date),
        location,
        maxInterest,
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
    // Steppers only see their own moves (unless admin)
    const currentUser = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { isAdmin: true },
    });
    const whereClause = {
      isActive: true,
      date: { gte: new Date() },
    };
    if (req.userRole === 'STEPPER' && !currentUser?.isAdmin) {
      whereClause.stepperId = req.userId;
    }

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
      orderBy: { date: 'asc' },
    });

    // Check which moves the current user has expressed interest in
    const userInterests = await prisma.moveInterest.findMany({
      where: { baddieId: req.userId },
      select: { moveId: true },
    });
    const interestedMoveIds = new Set(userInterests.map((i) => i.moveId));

    const result = moves.map((m) => ({
      id: m.id,
      title: m.title,
      description: m.description,
      date: m.date,
      location: m.location,
      maxInterest: m.maxInterest,
      interestCount: m._count.interests,
      createdAt: m.createdAt,
      hasInterest: interestedMoveIds.has(m.id),
      interestedBaddies: m.interests.map((i) => ({
        id: i.baddie.id,
        displayName: i.baddie.profile?.displayName,
        photo: Array.isArray(i.baddie.profile?.photos) ? i.baddie.profile.photos[0] : null,
      })),
      stepper: {
        id: m.stepper.id,
        isVerified: m.stepper.isVerified,
        profile: m.stepper.profile,
      },
    }));

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

    const moves = await prisma.move.findMany({
      where: { stepperId: req.userId },
      include: {
        interests: {
          include: { baddie: { include: { profile: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(moves);
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

    if (move._count.interests >= move.maxInterest) {
      return res.status(400).json({ error: 'This Move has reached maximum interest' });
    }

    const interest = await prisma.moveInterest.create({
      data: {
        moveId: req.params.moveId,
        baddieId: req.userId,
        message: req.body.message || null,
      },
    });

    res.status(201).json(interest);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Already expressed interest' });
    }
    console.error('Move interest error:', error);
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

// Delete a Move (Stepper only)
router.delete('/:moveId', authenticate, async (req, res) => {
  try {
    const move = await prisma.move.findUnique({ where: { id: req.params.moveId } });
    if (!move || move.stepperId !== req.userId) {
      return res.status(404).json({ error: 'Move not found' });
    }

    await prisma.move.update({
      where: { id: req.params.moveId },
      data: { isActive: false },
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
