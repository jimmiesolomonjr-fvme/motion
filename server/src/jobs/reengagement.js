import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { sendEmail, brandedTemplate } from '../services/email.js';

const prisma = new PrismaClient();

function day3Email(name) {
  return brandedTemplate(`
    <h2 style="color:#D4AF37;margin:0 0 16px;">You have new activity on Motion</h2>
    <p>Hey ${name || 'there'},</p>
    <p>People have been active on Motion while you were away. Come back and see who's been checking you out.</p>
    <p style="text-align:center;margin:24px 0;">
      <a href="${process.env.CLIENT_URL || 'https://motion-app.up.railway.app'}" style="display:inline-block;background:#D4AF37;color:#0A0A0A;padding:12px 32px;border-radius:12px;text-decoration:none;font-weight:700;">Open Motion</a>
    </p>
  `, 'You have new activity on Motion');
}

function day7Email(name) {
  return brandedTemplate(`
    <h2 style="color:#D4AF37;margin:0 0 16px;">We miss you on Motion</h2>
    <p>Hey ${name || 'there'},</p>
    <p>It's been a minute since you've been on Motion. New profiles, new moves, and new connections are waiting for you.</p>
    <p>Don't let someone special slip away.</p>
    <p style="text-align:center;margin:24px 0;">
      <a href="${process.env.CLIENT_URL || 'https://motion-app.up.railway.app'}" style="display:inline-block;background:#D4AF37;color:#0A0A0A;padding:12px 32px;border-radius:12px;text-decoration:none;font-weight:700;">Come Back</a>
    </p>
  `, 'We miss you on Motion');
}

async function runReengagement() {
  const now = new Date();
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const emailCooldown = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  try {
    const users = await prisma.user.findMany({
      where: {
        lastOnline: { lt: threeDaysAgo },
        isBanned: false,
        OR: [
          { lastReengagementEmail: null },
          { lastReengagementEmail: { lt: emailCooldown } },
        ],
      },
      include: { profile: { select: { displayName: true } } },
      take: 100,
    });

    let sent = 0;
    for (const user of users) {
      const name = user.profile?.displayName;
      const isDay7 = user.lastOnline < sevenDaysAgo;

      const html = isDay7 ? day7Email(name) : day3Email(name);
      const subject = isDay7 ? 'We miss you on Motion' : 'You have new activity on Motion';

      const result = await sendEmail({ to: user.email, subject, html });
      if (result.success) sent++;

      await prisma.user.update({
        where: { id: user.id },
        data: { lastReengagementEmail: now },
      });
    }

    if (sent > 0) {
      console.log(`[reengagement] Sent ${sent} re-engagement emails`);
    }
  } catch (err) {
    console.error('[reengagement] Error:', err);
  }
}

export function startReengagementJob() {
  // Run daily at 8pm UTC
  cron.schedule('0 20 * * *', () => {
    runReengagement();
  });
  console.log('[reengagement] Scheduled daily at 8pm UTC');
}
