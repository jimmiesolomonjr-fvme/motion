import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import webpush from 'web-push';
import config from '../config/index.js';

const prisma = new PrismaClient();

// Configure web-push if VAPID keys are set
if (config.vapid.publicKey && config.vapid.privateKey) {
  webpush.setVapidDetails(config.vapid.email, config.vapid.publicKey, config.vapid.privateKey);
}

async function sendPushNotification(recipientId, payload) {
  if (!config.vapid.publicKey || !config.vapid.privateKey) return;
  try {
    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId: recipientId },
    });
    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload)
        );
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        }
      }
    }
  } catch {
    // Push is best-effort
  }
}

export function setupSocketHandlers(io) {
  // Auth middleware for sockets
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication required'));

    try {
      const decoded = jwt.verify(token, config.jwt.secret);
      socket.userId = decoded.userId;
      socket.userRole = decoded.role;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', async (socket) => {
    // Join user's personal room
    socket.join(socket.userId);

    // Update online status
    await prisma.user.update({
      where: { id: socket.userId },
      data: { lastOnline: new Date() },
    }).catch(() => {});

    // Join conversation rooms
    socket.on('join-conversation', (conversationId) => {
      socket.join(`conv:${conversationId}`);
    });

    socket.on('leave-conversation', (conversationId) => {
      socket.leave(`conv:${conversationId}`);
    });

    // Send message via socket
    socket.on('send-message', async (data) => {
      try {
        const { conversationId, content, contentType = 'TEXT', replyToId } = data;

        const conversation = await prisma.conversation.findUnique({
          where: { id: conversationId },
        });

        if (!conversation) return;
        if (conversation.user1Id !== socket.userId && conversation.user2Id !== socket.userId) return;

        // Muted check
        const senderUser = await prisma.user.findUnique({
          where: { id: socket.userId },
          select: { isPremium: true, isMuted: true, isAdmin: true },
        });

        if (senderUser?.isMuted) {
          socket.emit('send-message-error', { conversationId, error: 'Your messaging privileges have been suspended' });
          return;
        }

        // Premium check for Steppers (unless free messaging is on or user is admin)
        if (socket.userRole === 'STEPPER' && !senderUser?.isAdmin) {
          const freeMessaging = await prisma.appSetting.findUnique({ where: { key: 'freeMessaging' } }).catch(() => null);
          if (freeMessaging?.value !== 'true') {
            if (!senderUser?.isPremium) {
              socket.emit('send-message-error', { conversationId, error: 'Premium subscription required' });
              return;
            }
          }
        }

        const message = await prisma.message.create({
          data: { conversationId, senderId: socket.userId, content, contentType, replyToId: replyToId || null },
          include: { replyTo: { select: { id: true, content: true, contentType: true, senderId: true } } },
        });

        await prisma.conversation.update({
          where: { id: conversationId },
          data: { lastMessageAt: new Date() },
        });

        // Send to conversation room
        io.to(`conv:${conversationId}`).emit('new-message', message);

        // Also notify the other user if not in the conversation room (respect notification prefs)
        const otherUserId = conversation.user1Id === socket.userId ? conversation.user2Id : conversation.user1Id;
        const recipient = await prisma.user.findUnique({
          where: { id: otherUserId },
          select: { notificationsEnabled: true },
        });
        if (recipient?.notificationsEnabled !== false) {
          io.to(otherUserId).emit('message-notification', {
            conversationId,
            message,
          });

          // Send web push notification
          const senderProfile = await prisma.profile.findUnique({
            where: { userId: socket.userId },
            select: { displayName: true },
          });
          const title = senderProfile?.displayName || 'New message';
          const body = contentType === 'TEXT' ? content.substring(0, 100) : (contentType === 'VOICE' ? 'Voice note' : 'Photo');
          sendPushNotification(otherUserId, { title, body, conversationId });
        }
      } catch (error) {
        console.error('Socket send-message error:', error);
        socket.emit('send-message-error', { conversationId: data?.conversationId, error: 'Failed to send message' });
      }
    });

    // Typing indicator
    socket.on('typing', (data) => {
      socket.to(`conv:${data.conversationId}`).emit('user-typing', {
        userId: socket.userId,
        conversationId: data.conversationId,
      });
    });

    socket.on('stop-typing', (data) => {
      socket.to(`conv:${data.conversationId}`).emit('user-stop-typing', {
        userId: socket.userId,
        conversationId: data.conversationId,
      });
    });

    // Message reaction (toggle)
    socket.on('react-message', async (data) => {
      try {
        const { messageId, emoji, conversationId } = data;
        if (!messageId || !emoji || !conversationId) return;

        const existing = await prisma.messageReaction.findUnique({
          where: { messageId_userId_emoji: { messageId, userId: socket.userId, emoji } },
        });

        if (existing) {
          await prisma.messageReaction.delete({ where: { id: existing.id } });
        } else {
          await prisma.messageReaction.create({
            data: { messageId, userId: socket.userId, emoji },
          });
        }

        const reactions = await prisma.messageReaction.findMany({
          where: { messageId },
          select: { id: true, userId: true, emoji: true },
        });

        io.to(`conv:${conversationId}`).emit('message-reaction', { messageId, reactions });
      } catch (error) {
        console.error('React message error:', error);
      }
    });

    // Read receipt
    socket.on('mark-read', async (data) => {
      try {
        await prisma.message.updateMany({
          where: {
            conversationId: data.conversationId,
            senderId: { not: socket.userId },
            readAt: null,
          },
          data: { readAt: new Date() },
        });

        socket.to(`conv:${data.conversationId}`).emit('messages-read', {
          conversationId: data.conversationId,
          readBy: socket.userId,
        });
      } catch (error) {
        console.error('Mark read error:', error);
      }
    });

    // Disconnect
    socket.on('disconnect', async () => {
      await prisma.user.update({
        where: { id: socket.userId },
        data: { lastOnline: new Date() },
      }).catch(() => {});
    });
  });
}
