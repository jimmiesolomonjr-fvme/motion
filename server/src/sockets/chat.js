import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import config from '../config/index.js';

const prisma = new PrismaClient();

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
        const { conversationId, content, contentType = 'TEXT' } = data;

        const conversation = await prisma.conversation.findUnique({
          where: { id: conversationId },
        });

        if (!conversation) return;
        if (conversation.user1Id !== socket.userId && conversation.user2Id !== socket.userId) return;

        // Premium check for Steppers (unless free messaging is on)
        if (socket.userRole === 'STEPPER') {
          const freeMessaging = await prisma.appSetting.findUnique({ where: { key: 'freeMessaging' } }).catch(() => null);
          if (freeMessaging?.value !== 'true') {
            const user = await prisma.user.findUnique({
              where: { id: socket.userId },
              select: { isPremium: true },
            });
            if (!user?.isPremium) {
              socket.emit('error', { message: 'Premium subscription required' });
              return;
            }
          }
        }

        const message = await prisma.message.create({
          data: { conversationId, senderId: socket.userId, content, contentType },
        });

        await prisma.conversation.update({
          where: { id: conversationId },
          data: { lastMessageAt: new Date() },
        });

        // Send to conversation room
        io.to(`conv:${conversationId}`).emit('new-message', message);

        // Also notify the other user if not in the conversation room
        const otherUserId = conversation.user1Id === socket.userId ? conversation.user2Id : conversation.user1Id;
        io.to(otherUserId).emit('message-notification', {
          conversationId,
          message,
        });
      } catch (error) {
        console.error('Socket send-message error:', error);
        socket.emit('error', { message: 'Failed to send message' });
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
