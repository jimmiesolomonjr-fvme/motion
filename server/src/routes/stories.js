import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth.js';
import { uploadMedia, uploadToCloud, uploadVideoToCloud, deleteFromCloud } from '../middleware/upload.js';
import { getHiddenIds, isHiddenFrom } from '../utils/hiddenPairs.js';

const router = Router();
const prisma = new PrismaClient();

// Create a story
router.post('/', authenticate, uploadMedia.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Photo or video is required' });
    }

    // Max 3 active stories per user
    const activeCount = await prisma.story.count({
      where: { userId: req.userId, expiresAt: { gt: new Date() } },
    });
    if (activeCount >= 3) {
      return res.status(400).json({ error: 'You can only have 3 active stories at a time' });
    }

    const isVideo = req.file.mimetype.startsWith('video/');
    const photo = isVideo
      ? await uploadVideoToCloud(req.file, 'motion/stories', 15)
      : await uploadToCloud(req.file, 'motion/stories');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Parse optional text overlay
    let textOverlay = null;
    if (req.body.textOverlay) {
      try {
        const parsed = JSON.parse(req.body.textOverlay);
        if (parsed.text && typeof parsed.text === 'string' && parsed.text.trim()) {
          const validFonts = ['classic', 'modern', 'handwritten', 'typewriter', 'bold'];
          const validAligns = ['left', 'center', 'right'];
          textOverlay = {
            text: parsed.text.trim().slice(0, 200),
            hasBackground: !!parsed.hasBackground,
            fontStyle: validFonts.includes(parsed.fontStyle) ? parsed.fontStyle : 'classic',
            color: /^#[0-9A-Fa-f]{6}$/.test(parsed.color) ? parsed.color : '#FFFFFF',
            fontSize: Math.max(16, Math.min(48, Number(parsed.fontSize) || 24)),
            align: validAligns.includes(parsed.align) ? parsed.align : 'center',
            xPercent: Math.max(0, Math.min(100, Number(parsed.xPercent) || 50)),
            yPercent: Math.max(0, Math.min(100, Number(parsed.yPercent) || 50)),
          };
          // Backwards compat: keep style if old client sends it
          if (parsed.style && !parsed.fontStyle) {
            textOverlay.color = parsed.style === 'dark-on-light' ? '#111827' : '#FFFFFF';
          }
        }
      } catch {
        // Invalid JSON — ignore
      }
    }

    const story = await prisma.story.create({
      data: {
        userId: req.userId,
        photo,
        caption: req.body.caption || null,
        textOverlay,
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

// Get active stories grouped by user (default: all roles, optional ?role=STEPPER|BADDIE filter)
router.get('/', authenticate, async (req, res) => {
  try {
    const roleFilter = req.query.role; // optional: 'STEPPER' or 'BADDIE'

    const hiddenIds = await getHiddenIds(req.userId);
    const excludeIds = hiddenIds.size > 0 ? [...hiddenIds] : [];

    const roleCondition = roleFilter
      ? [{ userId: req.userId }, { user: { role: roleFilter } }]
      : [{ userId: req.userId }, { user: { role: 'STEPPER' } }, { user: { role: 'BADDIE' } }];

    const stories = await prisma.story.findMany({
      where: {
        expiresAt: { gt: new Date() },
        ...(excludeIds.length > 0 && { userId: { notIn: excludeIds } }),
        user: { isHidden: false, isBanned: false },
        OR: roleCondition,
      },
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
        textOverlay: story.textOverlay || null,
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

    if (await isHiddenFrom(req.userId, story.userId)) {
      return res.status(403).json({ error: 'Story not found' });
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

    if (await isHiddenFrom(req.userId, story.userId)) {
      return res.status(403).json({ error: 'Story not found' });
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

// Reply to a story
router.post('/:storyId/reply', authenticate, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content?.trim()) {
      return res.status(400).json({ error: 'Reply content is required' });
    }

    const story = await prisma.story.findUnique({ where: { id: req.params.storyId } });
    if (!story) return res.status(404).json({ error: 'Story not found' });
    if (story.expiresAt < new Date()) return res.status(400).json({ error: 'Story has expired' });
    if (story.userId === req.userId) return res.status(400).json({ error: 'Cannot reply to your own story' });

    // Check hidden pairs
    if (await isHiddenFrom(req.userId, story.userId)) {
      return res.status(403).json({ error: 'Cannot reply to this story' });
    }

    // Check blocks
    const block = await prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: req.userId, blockedId: story.userId },
          { blockerId: story.userId, blockedId: req.userId },
        ],
      },
    });
    if (block) return res.status(403).json({ error: 'Cannot reply to this story' });

    // Premium check for Steppers + mute check
    const currentUser = await prisma.user.findUnique({
      where: { id: req.userId },
      include: { profile: { select: { displayName: true } } },
    });

    if (currentUser.isMuted) {
      return res.status(403).json({ error: 'You are muted and cannot reply to stories' });
    }
    if (currentUser.role === 'STEPPER' && !currentUser.isPremium) {
      const freeMessagingSetting = await prisma.appSetting.findUnique({ where: { key: 'freeMessaging' } });
      if (freeMessagingSetting?.value !== 'true') {
        return res.status(403).json({ error: 'Premium required to reply to stories' });
      }
    }

    // Find or create conversation
    const existing = await prisma.conversation.findFirst({
      where: {
        OR: [
          { user1Id: req.userId, user2Id: story.userId },
          { user1Id: story.userId, user2Id: req.userId },
        ],
      },
    });

    const conversation = existing || await prisma.conversation.create({
      data: { user1Id: req.userId, user2Id: story.userId },
    });

    // Create message
    const message = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderId: req.userId,
        content: `Replied to your story: ${content.trim()}`,
        contentType: 'TEXT',
      },
      include: {
        sender: { include: { profile: { select: { displayName: true, photos: true } } } },
      },
    });

    // Update conversation lastMessageAt
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date() },
    });

    // Emit socket events
    try {
      const { io } = await import('../../server.js');
      io.to(`conv:${conversation.id}`).emit('new-message', message);
      io.to(story.userId).emit('message-notification', { conversationId: conversation.id, message });
    } catch {
      // Socket notification is best-effort
    }

    // Create notification
    await prisma.notification.create({
      data: {
        userId: story.userId,
        type: 'story_reply',
        title: 'Replied to your story',
        body: `${currentUser?.profile?.displayName || 'Someone'} replied to your story`,
        data: { storyId: story.id, replierId: req.userId, conversationId: conversation.id },
      },
    });

    res.status(201).json({ conversationId: conversation.id, message });
  } catch (error) {
    console.error('Reply to story error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete story (own or admin)
router.delete('/:storyId', authenticate, async (req, res) => {
  try {
    const story = await prisma.story.findUnique({ where: { id: req.params.storyId } });
    if (!story) return res.status(404).json({ error: 'Story not found' });

    const currentUser = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { isAdmin: true },
    });
    if (story.userId !== req.userId && !currentUser?.isAdmin) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await prisma.story.delete({ where: { id: req.params.storyId } });
    // Clean up from Cloudinary
    deleteFromCloud(story.photo).catch(() => {});
    res.json({ success: true });
  } catch (error) {
    console.error('Delete story error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
