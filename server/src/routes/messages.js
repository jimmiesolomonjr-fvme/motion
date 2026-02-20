import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth.js';
import { requirePremium } from '../middleware/premium.js';
import { upload, uploadVoice, toDataUrl } from '../middleware/upload.js';

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

// Start conversation with a matched user or move interest
router.post('/start/:userId', authenticate, async (req, res) => {
  try {
    const otherUserId = req.params.userId;

    // Check match exists
    const [u1, u2] = [req.userId, otherUserId].sort();
    const match = await prisma.match.findUnique({
      where: { user1Id_user2Id: { user1Id: u1, user2Id: u2 } },
    });

    if (!match) {
      // Allow Baddies to message Steppers directly (no match required)
      const currentUserData = await prisma.user.findUnique({
        where: { id: req.userId },
        select: { role: true },
      });
      const otherUserData = await prisma.user.findUnique({
        where: { id: otherUserId },
        select: { role: true },
      });

      const baddieToStepper = currentUserData?.role === 'BADDIE' && otherUserData?.role === 'STEPPER';

      if (!baddieToStepper) {
        // Check for MoveInterest as fallback
        const moveInterest = await prisma.moveInterest.findFirst({
          where: {
            OR: [
              { baddieId: otherUserId, move: { stepperId: req.userId } },
              { baddieId: req.userId, move: { stepperId: otherUserId } },
            ],
          },
        });

        if (!moveInterest) {
          return res.status(400).json({ error: 'You must match with a user or have a move interest before messaging' });
        }
      }
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

// Upload image in chat
router.post('/:conversationId/image', authenticate, requirePremium, upload.single('image'), async (req, res) => {
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
        contentType: 'IMAGE',
      },
    });

    await prisma.conversation.update({
      where: { id: req.params.conversationId },
      data: { lastMessageAt: new Date() },
    });

    // Emit via socket so chat updates in real-time
    try {
      const { io } = await import('../../server.js');
      io.to(`conv:${req.params.conversationId}`).emit('new-message', message);
      const otherUserId = conversation.user1Id === req.userId ? conversation.user2Id : conversation.user1Id;
      io.to(otherUserId).emit('message-notification', { conversationId: req.params.conversationId, message });
    } catch {
      // Socket notification is best-effort
    }

    res.status(201).json(message);
  } catch (error) {
    console.error('Image upload error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get icebreaker prompts for a conversation with a user
router.get('/icebreakers/:userId', authenticate, async (req, res) => {
  const fallbacks = [
    "What's your idea of a perfect date?",
    "What are you doing this weekend?",
    "If you could travel anywhere tomorrow, where would you go?",
    "What's something that always makes you smile?",
    "What's the best thing you've eaten lately?",
  ];

  try {
    const otherUserId = req.params.userId;
    const otherUser = await prisma.user.findUnique({
      where: { id: otherUserId },
      include: { profile: true, profilePrompts: { orderBy: { position: 'asc' } } },
    });

    if (!otherUser?.profile) {
      return res.json({ icebreakers: fallbacks.slice(0, 3).map((t) => ({ text: t })) });
    }

    const icebreakers = [];
    const name = otherUser.profile.displayName;

    // From their profile prompts — turn into a real question
    if (otherUser.profilePrompts?.length > 0) {
      const p = otherUser.profilePrompts[0];
      icebreakers.push({ text: `I saw your answer about "${p.prompt.replace(/…$/, '')}" — I'd love to hear more!` });
    }

    // From their bio — reference it naturally
    if (otherUser.profile.bio && otherUser.profile.bio.length > 10) {
      icebreakers.push({ text: `Your bio caught my eye — what's the story behind it?` });
    }

    // From lookingFor — frame as a real message
    if (otherUser.profile.lookingFor) {
      icebreakers.push({ text: `What does "${otherUser.profile.lookingFor}" look like to you?` });
    }

    // Fill remaining with generic sendable messages
    let i = 0;
    while (icebreakers.length < 3 && i < fallbacks.length) {
      if (!icebreakers.some((ib) => ib.text === fallbacks[i])) {
        icebreakers.push({ text: fallbacks[i] });
      }
      i++;
    }

    res.json({ icebreakers: icebreakers.slice(0, 3) });
  } catch (error) {
    console.error('Icebreakers error:', error);
    res.json({ icebreakers: fallbacks.slice(0, 3).map((t) => ({ text: t })) });
  }
});

// Delete a conversation
router.delete('/conversations/:conversationId', authenticate, async (req, res) => {
  try {
    const conversation = await prisma.conversation.findUnique({
      where: { id: req.params.conversationId },
    });

    if (!conversation || (conversation.user1Id !== req.userId && conversation.user2Id !== req.userId)) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    await prisma.conversation.delete({ where: { id: conversation.id } });

    res.json({ deleted: true });
  } catch (error) {
    console.error('Delete conversation error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
