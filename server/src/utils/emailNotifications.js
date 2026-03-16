import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import config from '../config/index.js';
import { sendEmail } from '../services/email.js';

const prisma = new PrismaClient();

// In-memory cooldown: userId -> last email timestamp (for message type only)
const messageCooldowns = new Map();
const COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Generate a deterministic HMAC-based unsubscribe token for a user.
 */
function generateUnsubscribeToken(userId) {
  return crypto.createHmac('sha256', config.jwt.secret).update(userId).digest('hex');
}

/**
 * Build the full unsubscribe URL for a user.
 */
export function generateUnsubscribeUrl(userId) {
  const token = generateUnsubscribeToken(userId);
  const baseUrl = config.clientUrl || 'https://motionapp.up.railway.app';
  // Point at the server API, not the client
  const serverUrl = baseUrl.replace(/:\d+$/, ':' + config.port);
  const prodUrl = config.nodeEnv === 'production' ? baseUrl : serverUrl;
  return `${prodUrl}/api/auth/unsubscribe?uid=${userId}&token=${token}`;
}

/**
 * Verify an unsubscribe token for a given userId.
 */
export function verifyUnsubscribeToken(userId, token) {
  const expected = generateUnsubscribeToken(userId);
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(token));
}

/**
 * Build notification email HTML with trigger user photo, headline, CTA, and unsubscribe.
 */
function notificationEmailHtml(type, triggerName, triggerPhoto, unsubscribeUrl) {
  const headlines = {
    profile_view: `${triggerName} viewed your profile`,
    like: `${triggerName} liked you`,
    message: `${triggerName} sent you a message`,
    smf_pick: `${triggerName} picked you in Smash Marry Friendzone`,
  };
  const headline = headlines[type] || `${triggerName} wants to connect`;

  const ctaTexts = {
    message: 'Read Message',
    smf_pick: 'Open Motion',
  };
  const ctaText = ctaTexts[type] || 'View Profile';
  const appUrl = config.clientUrl || 'https://motionapp.up.railway.app';

  const photoHtml = triggerPhoto
    ? `<div style="text-align:center;margin-bottom:20px;">
        <img src="${triggerPhoto}" alt="${triggerName}" style="width:100px;height:100px;border-radius:50%;object-fit:cover;border:3px solid #D4AF37;" />
      </div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Motion</title>
</head>
<body style="margin:0;padding:0;background-color:#0A0A0A;font-family:Arial,Helvetica,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${headline}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0A0A0A;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#1A1A1A;border-radius:16px;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td align="center" style="padding:32px 24px 16px;">
              <h1 style="margin:0;font-size:28px;font-weight:800;letter-spacing:4px;color:#D4AF37;">MOTION</h1>
            </td>
          </tr>
          <!-- Divider -->
          <tr>
            <td style="padding:0 24px;">
              <div style="height:1px;background:linear-gradient(to right,transparent,#D4AF37,transparent);"></div>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px 24px;text-align:center;">
              ${photoHtml}
              <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#FFFFFF;">${headline}</h2>
              <p style="margin:0 0 28px;font-size:15px;color:#999;">Don't keep them waiting — open Motion to respond.</p>
              <div style="margin-bottom:28px;">
                <a href="${appUrl}" style="display:inline-block;padding:14px 40px;background-color:#D4AF37;color:#0A0A0A;font-weight:bold;text-decoration:none;border-radius:8px;font-size:15px;">${ctaText}</a>
              </div>
            </td>
          </tr>
          <!-- Safety -->
          <tr>
            <td style="padding:0 24px;">
              <div style="height:1px;background:linear-gradient(to right,transparent,#333,transparent);"></div>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px;color:#666;font-size:12px;line-height:1.5;">
              <strong style="color:#999;">Safety tip:</strong> Never share personal information like your address or financial details with someone you haven't met.
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:0 24px;">
              <div style="height:1px;background:linear-gradient(to right,transparent,#333,transparent);"></div>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:20px 24px 28px;color:#666;font-size:12px;">
              &copy; ${new Date().getFullYear()} Motion &mdash; Move Different
              <br>
              <a href="${unsubscribeUrl}" style="color:#666;text-decoration:underline;font-size:11px;">Unsubscribe from email notifications</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Send a notification email to a recipient.
 * Checks: preference, online status (socket), message cooldown.
 * Fire-and-forget — never throws.
 *
 * @param {string} recipientId - User ID of the recipient
 * @param {'profile_view'|'like'|'message'} type - Notification type
 * @param {string} triggerUserId - User ID of the person who triggered it
 */
export async function sendNotificationEmail(recipientId, type, triggerUserId) {
  try {
    // 1. Fetch recipient — check email pref
    const recipient = await prisma.user.findUnique({
      where: { id: recipientId },
      select: { email: true, emailNotificationsEnabled: true },
    });
    if (!recipient || !recipient.emailNotificationsEnabled) return;

    // 2. Check if user is online (has an active socket connection)
    try {
      const { io } = await import('../../server.js');
      const room = io.sockets.adapter.rooms.get(recipientId);
      if (room && room.size > 0) return; // User is online — skip email
    } catch {
      // If io is not available, proceed with sending (safe default)
    }

    // 3. Message cooldown (10 min per recipient)
    if (type === 'message') {
      const lastSent = messageCooldowns.get(recipientId);
      if (lastSent && Date.now() - lastSent < COOLDOWN_MS) return;
    }

    // 4. Fetch trigger user profile
    const triggerProfile = await prisma.profile.findUnique({
      where: { userId: triggerUserId },
      select: { displayName: true, photos: true },
    });
    const triggerName = triggerProfile?.displayName || 'Someone';
    const triggerPhoto = Array.isArray(triggerProfile?.photos) && triggerProfile.photos.length > 0
      ? triggerProfile.photos[0]
      : null;

    // 5. Build and send
    const unsubscribeUrl = generateUnsubscribeUrl(recipientId);
    const html = notificationEmailHtml(type, triggerName, triggerPhoto, unsubscribeUrl);

    const subjects = {
      profile_view: `${triggerName} viewed your profile on Motion`,
      like: `${triggerName} liked you on Motion`,
      message: `${triggerName} sent you a message on Motion`,
      smf_pick: `${triggerName} rated you in SMF on Motion`,
    };

    await sendEmail({
      to: recipient.email,
      subject: subjects[type] || 'New activity on Motion',
      html,
    });

    // Update cooldown for messages
    if (type === 'message') {
      messageCooldowns.set(recipientId, Date.now());
    }
  } catch (err) {
    console.error('Email notification error:', err);
  }
}
