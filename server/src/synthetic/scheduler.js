import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import config from '../config/index.js';
import { runAgentCycle } from './agentLoop.js';
import { randomJitterMs } from './realism.js';

const prisma = new PrismaClient();

export function startSyntheticScheduler() {
  if (!config.synthetic.enabled) {
    console.log('[synthetic] Scheduler disabled (SYNTHETIC_USERS_ENABLED != true)');
    return;
  }

  const interval = config.synthetic.cycleIntervalMinutes || 10;
  const cronExpr = `*/${interval} * * * *`;

  console.log(`[synthetic] Scheduler started — running every ${interval} minutes`);

  cron.schedule(cronExpr, async () => {
    try {
      // Double-check kill switch: config + AppSetting
      if (!config.synthetic.enabled) return;

      const setting = await prisma.appSetting.findUnique({ where: { key: 'syntheticUsersEnabled' } });
      if (setting?.value !== 'true') return;

      // Get active synthetic profiles
      const profiles = await prisma.syntheticProfile.findMany({
        where: { isActive: true },
        select: { id: true, userId: true },
      });

      if (profiles.length === 0) return;

      console.log(`[synthetic] Running cycle for ${profiles.length} active profiles`);

      // Process with concurrency limit
      const maxConcurrent = config.synthetic.maxConcurrent || 3;
      const queue = [...profiles];

      const runNext = async () => {
        while (queue.length > 0) {
          const profile = queue.shift();
          if (!profile) break;

          // Add random jitter per agent (0-120s)
          const jitter = randomJitterMs(120);
          await new Promise((r) => setTimeout(r, jitter));

          try {
            await runAgentCycle(profile.id);
          } catch (err) {
            console.error(`[synthetic] Agent cycle failed for ${profile.userId}:`, err.message);
          }
        }
      };

      // Launch concurrent workers
      const workers = [];
      for (let i = 0; i < Math.min(maxConcurrent, queue.length); i++) {
        workers.push(runNext());
      }
      await Promise.all(workers);

      console.log('[synthetic] Cycle complete');
    } catch (err) {
      console.error('[synthetic] Scheduler error:', err.message);
    }
  });
}
