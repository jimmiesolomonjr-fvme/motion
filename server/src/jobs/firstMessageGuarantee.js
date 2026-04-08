import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { getTopResponders } from '../services/responderScoring.js';
import { sendPushNotification } from '../utils/pushNotifications.js';

const prisma = new PrismaClient();

async function runFirstMessageGuarantee() {
  try {
    // Check admin toggle
    const toggle = await prisma.appSetting.findUnique({ where: { key: 'firstMessageGuaranteeEnabled' } });
    if (toggle?.value === 'false') return;

    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

    // Find active activations within 24h window
    const activations = await prisma.userActivation.findMany({
      where: {
        needsFirstMessage: true,
        activationStatus: { in: ['PENDING', 'NUDGED'] },
        createdAt: { gte: twentyFourHoursAgo },
      },
      include: {
        user: { select: { id: true, isBanned: true, isHidden: true, role: true } },
      },
    });

    let nudgedCount = 0;
    for (const activation of activations) {
      // Skip banned/hidden users
      if (activation.user.isBanned || activation.user.isHidden) continue;

      // Idempotency: skip if nudged recently and already nudged twice
      if (activation.lastNudgedAt && activation.lastNudgedAt >= twoHoursAgo && activation.nudgeCount >= 2) {
        continue;
      }

      const responderIds = await getTopResponders(activation.userId, 5);
      if (responderIds.length === 0) continue;

      // Get new user's profile for the notification
      const newUserProfile = await prisma.profile.findUnique({
        where: { userId: activation.userId },
        select: { displayName: true, photos: true },
      });
      if (!newUserProfile) continue;

      const io = await getIo();

      for (const responderId of responderIds) {
        // Create notification for each responder
        const notification = await prisma.notification.create({
          data: {
            userId: responderId,
            type: 'new_user_priority',
            title: 'New member nearby',
            body: `${newUserProfile.displayName} just joined — be the first to say hi!`,
            data: { targetUserId: activation.userId, targetName: newUserProfile.displayName },
          },
        });

        // Emit socket event
        if (io) {
          io.to(responderId).emit('notification', notification);
        }

        // Push notification
        sendPushNotification(responderId, {
          title: 'New member nearby',
          body: `${newUserProfile.displayName} just joined — be the first to say hi!`,
        }).catch(() => {});
      }

      // Update activation
      await prisma.userActivation.update({
        where: { id: activation.id },
        data: {
          nudgeCount: activation.nudgeCount + 1,
          lastNudgedAt: now,
          activationStatus: 'NUDGED',
          boostedResponderIds: [...new Set([...activation.boostedResponderIds, ...responderIds])],
        },
      });

      nudgedCount++;
    }

    // Expire old activations
    const expired = await prisma.userActivation.updateMany({
      where: {
        needsFirstMessage: true,
        activationStatus: { in: ['PENDING', 'NUDGED'] },
        createdAt: { lt: twentyFourHoursAgo },
      },
      data: {
        activationStatus: 'EXPIRED',
        needsFirstMessage: false,
      },
    });

    if (nudgedCount > 0 || expired.count > 0) {
      console.log(`[first-message-guarantee] Nudged ${nudgedCount} activations, expired ${expired.count}`);
    }
  } catch (err) {
    console.error('[first-message-guarantee] Error:', err);
  }
}

async function getIo() {
  try {
    const { io } = await import('../../server.js');
    return io;
  } catch {
    return null;
  }
}

export function startFirstMessageGuaranteeJob() {
  // Run every 15 minutes
  cron.schedule('*/15 * * * *', () => {
    runFirstMessageGuarantee();
  });
  console.log('[first-message-guarantee] Scheduled every 15 minutes');
}

// Export for manual triggering from admin
export { runFirstMessageGuarantee };
