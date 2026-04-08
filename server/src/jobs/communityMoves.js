import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { runPipeline } from '../services/communityMovePipeline.js';

const prisma = new PrismaClient();

async function expireCommunityMoves() {
  try {
    const now = new Date();

    // Expire community moves past expiresAt
    await prisma.move.updateMany({
      where: {
        isCommunity: true,
        isActive: true,
        expiresAt: { lt: now },
      },
      data: { isActive: false, status: 'CANCELLED' },
    });

    // Expire pending pairings past expiresAt
    const expiredPairings = await prisma.communityMovePairing.updateMany({
      where: {
        status: 'PENDING',
        expiresAt: { lt: now },
      },
      data: { status: 'EXPIRED', resolvedAt: now },
    });

    if (expiredPairings.count > 0) {
      console.log(`[community-moves] Expired ${expiredPairings.count} pairings`);

      // Return expired pairing users to pool
      const expired = await prisma.communityMovePairing.findMany({
        where: { status: 'EXPIRED', resolvedAt: now },
        select: { moveId: true, baddieId: true, stepperId: true },
      });

      for (const p of expired) {
        await prisma.communityMovePool.updateMany({
          where: { moveId: p.moveId, userId: { in: [p.baddieId, p.stepperId] } },
          data: { paired: false, pairedAt: null },
        });
      }
    }
  } catch (err) {
    console.error('[community-moves] Expiry error:', err);
  }
}

export function startCommunityMovesJob() {
  // Pipeline: Mon/Thu 9am ET (14:00 UTC during EDT, 13:00 during EST)
  // Using 14:00 UTC (9am EDT)
  cron.schedule('0 14 * * 1,4', () => {
    console.log('[community-moves] Running pipeline...');
    runPipeline().catch((err) => console.error('[community-moves] Pipeline error:', err));
  });

  // Hourly expiry check
  cron.schedule('0 * * * *', () => {
    expireCommunityMoves();
  });

  console.log('[community-moves] Scheduled pipeline (Mon/Thu 9am ET) + hourly expiry');
}
