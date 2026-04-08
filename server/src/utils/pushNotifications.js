import { PrismaClient } from '@prisma/client';
import webpush from 'web-push';
import config from '../config/index.js';

const prisma = new PrismaClient();

if (config.vapid.publicKey && config.vapid.privateKey) {
  webpush.setVapidDetails(config.vapid.email, config.vapid.publicKey, config.vapid.privateKey);
}

export async function sendPushNotification(recipientId, payload) {
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
