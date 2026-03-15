import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { deleteFromCloud } from '../middleware/upload.js';

const prisma = new PrismaClient();

async function cleanupExpiredStories() {
  try {
    const expired = await prisma.story.findMany({
      where: { expiresAt: { lt: new Date() } },
      select: { id: true, photo: true },
    });

    if (expired.length === 0) return;

    // Delete from Cloudinary first
    for (const story of expired) {
      if (story.photo) {
        await deleteFromCloud(story.photo).catch((err) =>
          console.error(`[story-cleanup] Failed to delete cloud file for story ${story.id}:`, err.message)
        );
      }
    }

    // Delete from DB (cascade removes views + likes)
    await prisma.story.deleteMany({
      where: { id: { in: expired.map((s) => s.id) } },
    });

    console.log(`[story-cleanup] Cleaned up ${expired.length} expired stories`);
  } catch (err) {
    console.error('[story-cleanup] Error:', err);
  }
}

export function startStoryCleanupJob() {
  // Run every hour
  cron.schedule('0 * * * *', () => {
    cleanupExpiredStories();
  });
  console.log('[story-cleanup] Scheduled hourly');
}
