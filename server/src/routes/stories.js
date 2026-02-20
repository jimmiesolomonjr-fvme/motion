import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth.js';
import { upload, toDataUrl } from '../middleware/upload.js';

const router = Router();
const prisma = new PrismaClient();

// Create a story
router.post('/', authenticate, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Photo is required' });
    }

    const photo = req.file.buffer ? toDataUrl(req.file) : `/uploads/${req.file.filename}`;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const story = await prisma.story.create({
      data: {
        userId: req.userId,
        photo,
        caption: req.body.caption || null,
        expiresAt,
      },
      include: {
        user: { include: { profile: { select: { photos: true, displayName: true } } } },
      },
    });

    res.status(201).json(story);
  } catch (error) {
    console.error('Create story error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get active stories grouped by user
router.get('/', authenticate, async (req, res) => {
  try {
    const stories = await prisma.story.findMany({
      where: { expiresAt: { gt: new Date() } },
      include: {
        user: { include: { profile: { select: { photos: true, displayName: true } } } },
        views: { where: { viewerId: req.userId }, select: { id: true } },
        likes: { where: { userId: req.userId }, select: { id: true } },
        _count: { select: { views: true, likes: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Group by user
    const grouped = {};
    for (const story of stories) {
      if (!grouped[story.userId]) {
        grouped[story.userId] = {
          userId: story.userId,
          displayName: story.user.profile?.displayName || 'User',
          avatar: story.user.profile?.photos,
          stories: [],
          hasUnviewed: false,
        };
      }
      const viewed = story.views.length > 0;
      grouped[story.userId].stories.push({
        id: story.id,
        photo: story.photo,
        caption: story.caption,
        createdAt: story.createdAt,
        expiresAt: story.expiresAt,
        viewed,
        viewCount: story._count.views,
        likeCount: story._count.likes,
        hasLiked: story.likes.length > 0,
      });
      if (!viewed) grouped[story.userId].hasUnviewed = true;
    }

    // Own stories first, then unviewed, then viewed
    const result = Object.values(grouped).sort((a, b) => {
      if (a.userId === req.userId) return -1;
      if (b.userId === req.userId) return 1;
      if (a.hasUnviewed && !b.hasUnviewed) return -1;
      if (!a.hasUnviewed && b.hasUnviewed) return 1;
      return 0;
    });

    res.json(result);
  } catch (error) {
    console.error('Get stories error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Mark story as viewed
router.post('/:storyId/view', authenticate, async (req, res) => {
  try {
    const story = await prisma.story.findUnique({ where: { id: req.params.storyId } });
    if (!story) return res.status(404).json({ error: 'Story not found' });

    // Skip self-views
    if (story.userId === req.userId) {
      return res.json({ success: true });
    }

    await prisma.storyView.upsert({
      where: { storyId_viewerId: { storyId: req.params.storyId, viewerId: req.userId } },
      create: { storyId: req.params.storyId, viewerId: req.userId },
      update: {},
    });

    res.json({ success: true });
  } catch (error) {
    console.error('View story error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Like a story
router.post('/:storyId/like', authenticate, async (req, res) => {
  try {
    const story = await prisma.story.findUnique({ where: { id: req.params.storyId } });
    if (!story) return res.status(404).json({ error: 'Story not found' });

    // Can't like own story
    if (story.userId === req.userId) {
      return res.status(400).json({ error: 'Cannot like your own story' });
    }

    await prisma.storyLike.upsert({
      where: { storyId_userId: { storyId: req.params.storyId, userId: req.userId } },
      create: { storyId: req.params.storyId, userId: req.userId },
      update: {},
    });

    // Create notification for story owner
    const liker = await prisma.user.findUnique({
      where: { id: req.userId },
      include: { profile: { select: { displayName: true } } },
    });

    await prisma.notification.create({
      data: {
        userId: story.userId,
        type: 'story_like',
        title: 'Liked your story',
        body: `${liker?.profile?.displayName || 'Someone'} liked your story`,
        data: { storyId: story.id, likerId: req.userId },
      },
    });

    const likeCount = await prisma.storyLike.count({ where: { storyId: req.params.storyId } });

    res.json({ success: true, likeCount });
  } catch (error) {
    console.error('Like story error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete own story
router.delete('/:storyId', authenticate, async (req, res) => {
  try {
    const story = await prisma.story.findUnique({ where: { id: req.params.storyId } });
    if (!story || story.userId !== req.userId) {
      return res.status(404).json({ error: 'Story not found' });
    }

    await prisma.story.delete({ where: { id: req.params.storyId } });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete story error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
