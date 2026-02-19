import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth.js';
import { requirePremium } from '../middleware/premium.js';
import { uploadVoice, toDataUrl } from '../middleware/upload.js';

const router = Router();
const prisma = new PrismaClient();

// Get all conversations
router.get('/conversations', authenticate, async (req, res) => {
  try {
    const conversations = await prisma.conversation.findMany({
      where: { OR: [{ user1Id: req.userId }, { user2Id: req.userId }] },
      include: {
        user1: { include: { profile: true } },
        user2: { include: { profile: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { lastMessageAt: 'desc' },
    });

    const result = conversations.map((c) => {
      const other = c.user1Id === req.userId ? c.user2 : c.user1;
      const lastMessage = c.messages[0] || null;
      return {
        id: c.id,
        lastMessageAt: c.lastMessageAt,
        otherUser: {
          id: other.id,
          role: other.role,
          lastOnline: other.lastOnline,
          profile: other.profile,
        },
        lastMessage: lastMessage
          ? {
              content: lastMessage.content,
              contentType: lastMessage.contentType,
              senderId: lastMessage.senderId,
              createdAt: lastMessage.createdAt,
              read: !!lastMessage.readAt,
            }
          : null,
      };
    });

    res.json(result);
  } catch (error) {
    console.error('Conversations error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get messages for a conversation
router.get('/:conversationId', authenticate, async (req, res) => {
  try {
    const conversation = await prisma.conversation.findUnique({
      where: { id: req.params.conversationId },
    });

    if (!conversation || (conversation.user1Id !== req.userId && conversation.user2Id !== req.userId)) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const messages = await prisma.message.findMany({
      where: { conversationId: req.params.conversationId },
      orderBy: { createdAt: 'asc' },
    });

    // Mark unread messages as read
    await prisma.message.updateMany({
      where: {
        conversationId: req.params.conversationId,
        senderId: { not: req.userId },
        readAt: null,
      },
      data: { readAt: new Date() },
    });

    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Send a message
router.post('/:conversationId', authenticate, requirePremium, async (req, res) => {
  try {
    const { content, contentType = 'TEXT' } = req.body;
    const conversation = await prisma.conversation.findUnique({
      where: { id: req.params.conversationId },
    });

    if (!conversation || (conversation.user1Id !== req.userId && conversation.user2Id !== req.userId)) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const message = await prisma.message.create({
      data: {
        conversationId: req.params.conversationId,
        senderId: req.userId,
        content,
        contentType,
      },
    });

    await prisma.conversation.update({
      where: { id: req.params.conversationId },
      data: { lastMessageAt: new Date() },
    });

    res.status(201).json(message);
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Start conversation with a matched user
router.post('/start/:userId', authenticate, requirePremium, async (req, res) => {
  try {
    const otherUserId = req.params.userId;

    // Check match exists
    const [u1, u2] = [req.userId, otherUserId].sort();
    const match = await prisma.match.findUnique({
      where: { user1Id_user2Id: { user1Id: u1, user2Id: u2 } },
    });

    if (!match) {
      return res.status(400).json({ error: 'You must match with a user before messaging' });
    }

    // Check if conversation already exists
    const existing = await prisma.conversation.findFirst({
      where: {
        OR: [
          { user1Id: req.userId, user2Id: otherUserId },
          { user1Id: otherUserId, user2Id: req.userId },
        ],
      },
    });

    if (existing) {
      return res.json(existing);
    }

    const conversation = await prisma.conversation.create({
      data: { user1Id: req.userId, user2Id: otherUserId },
    });

    res.status(201).json(conversation);
  } catch (error) {
    console.error('Start conversation error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Upload voice note
router.post('/:conversationId/voice', authenticate, requirePremium, uploadVoice.single('voice'), async (req, res) => {
  try {
    const conversation = await prisma.conversation.findUnique({
      where: { id: req.params.conversationId },
    });

    if (!conversation || (conversation.user1Id !== req.userId && conversation.user2Id !== req.userId)) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const message = await prisma.message.create({
      data: {
        conversationId: req.params.conversationId,
        senderId: req.userId,
        content: req.file.buffer ? toDataUrl(req.file) : `/uploads/${req.file.filename}`,
        contentType: 'VOICE',
      },
    });

    await prisma.conversation.update({
      where: { id: req.params.conversationId },
      data: { lastMessageAt: new Date() },
    });

    res.status(201).json(message);
  } catch (error) {
    console.error('Voice upload error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
