import { Router } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import config from '../config/index.js';
import { validateEmail, validatePassword, validateRole } from '../utils/validators.js';
import { authenticate } from '../middleware/auth.js';
import { sendEmail, brandedTemplate } from '../services/email.js';
import { verifyUnsubscribeToken } from '../utils/emailNotifications.js';

const router = Router();
const prisma = new PrismaClient();

function generateTokens(userId, role) {
  const accessToken = jwt.sign({ userId, role }, config.jwt.secret, {
    expiresIn: config.jwt.accessExpiry,
  });
  const refreshToken = jwt.sign({ userId, role }, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiry,
  });
  return { accessToken, refreshToken };
}

function generateReferralCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'MOTION-';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// Register
router.post('/register', async (req, res) => {
  try {
    const { email, password, role, referralCode } = req.body;

    if (!validateEmail(email)) {
      return res.status(400).json({ error: 'Invalid email' });
    }
    if (!validatePassword(password)) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    if (!validateRole(role)) {
      return res.status(400).json({ error: 'Role must be STEPPER or BADDIE' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Validate referral code if provided
    let referredBy = null;
    if (referralCode) {
      const referrer = await prisma.user.findUnique({ where: { referralCode } });
      if (referrer) referredBy = referrer.id;
    }

    // Generate unique referral code for new user
    let newReferralCode;
    for (let attempt = 0; attempt < 10; attempt++) {
      const candidate = generateReferralCode();
      const exists = await prisma.user.findUnique({ where: { referralCode: candidate } });
      if (!exists) { newReferralCode = candidate; break; }
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email, passwordHash, role, referralCode: newReferralCode, referredBy },
    });

    const tokens = generateTokens(user.id, user.role);
    res.status(201).json({ user: { id: user.id, email: user.email, role: user.role }, ...tokens });

    // Fire-and-forget: send welcome message from admin
    sendWelcomeMessage(user.id, user.role).catch(() => {});
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
      include: { profile: true },
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.isBanned) {
      return res.status(403).json({ error: 'Account has been suspended' });
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastOnline: new Date() },
    });

    const tokens = generateTokens(user.id, user.role);
    res.json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        isPremium: user.isPremium,
        isVerified: user.isVerified,
        isAdmin: user.isAdmin,
        hasProfile: !!user.profile && user.profile?.photos?.length > 0,
      },
      ...tokens,
    });

    // Fire-and-forget: generate login notifications
    generateLoginNotifications(user.id, !!user.profile && user.profile?.photos?.length > 0).catch(() => {});
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Refresh token
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required' });
    }

    const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret);
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });

    if (!user || user.isBanned) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const tokens = generateTokens(user.id, user.role);
    res.json(tokens);
  } catch {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// Get current user
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      include: { profile: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: user.id,
      email: user.email,
      role: user.role,
      isPremium: user.isPremium,
      isVerified: user.isVerified,
      isAdmin: user.isAdmin,
      hasProfile: !!user.profile && user.profile?.photos?.length > 0,
      profile: user.profile,
      notificationsEnabled: user.notificationsEnabled,
      referralCode: user.referralCode,
    });
  } catch (error) {
    console.error('Me error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Change password
router.put('/change-password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!validatePassword(newPassword)) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: req.userId }, data: { passwordHash } });

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Forgot password — request reset email
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    // Always return same message to prevent email enumeration
    const successMsg = 'If an account with that email exists, a reset link has been sent.';

    if (!email || !validateEmail(email)) {
      return res.json({ message: successMsg });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.json({ message: successMsg });
    }

    // Generate token — store SHA-256 hash, send raw token in email
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken: hashedToken,
        resetTokenExpiry: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      },
    });

    const clientUrl = config.clientUrl || 'https://yourmotion.app';
    const resetLink = `${clientUrl}/reset-password?token=${rawToken}`;

    const bodyHtml = `
      <h2 style="color:#D4AF37;margin:0 0 16px;">Reset Your Password</h2>
      <p>We received a request to reset your password. Click the button below to set a new one:</p>
      <div style="text-align:center;margin:24px 0;">
        <a href="${resetLink}" style="display:inline-block;padding:14px 32px;background-color:#D4AF37;color:#0A0A0A;font-weight:bold;text-decoration:none;border-radius:8px;font-size:15px;">Reset Password</a>
      </div>
      <p style="color:#999;font-size:13px;">This link expires in 1 hour. If you didn't request this, just ignore this email.</p>
    `;

    await sendEmail({
      to: email,
      subject: 'Reset Your Motion Password',
      html: brandedTemplate(bodyHtml, 'Reset your Motion password'),
    });

    res.json({ message: successMsg });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.json({ message: 'If an account with that email exists, a reset link has been sent.' });
  }
});

// Reset password — set new password using token
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }

    if (!validatePassword(newPassword)) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await prisma.user.findFirst({
      where: {
        resetToken: hashedToken,
        resetTokenExpiry: { gt: new Date() },
      },
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired reset link' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Public: get maintenance/status banner (no auth required)
router.get('/status-banner', async (req, res) => {
  try {
    const setting = await prisma.appSetting.findUnique({ where: { key: 'maintenanceBanner' } });
    res.json({ message: setting?.value || null });
  } catch {
    res.json({ message: null });
  }
});

// Unsubscribe from email notifications (no login required)
router.get('/unsubscribe', async (req, res) => {
  try {
    const { uid, token } = req.query;
    if (!uid || !token) {
      return res.status(400).send(unsubscribePage('Invalid Link', 'The unsubscribe link is missing required parameters.', false));
    }

    if (!verifyUnsubscribeToken(uid, token)) {
      return res.status(400).send(unsubscribePage('Invalid Link', 'This unsubscribe link is invalid or has been tampered with.', false));
    }

    await prisma.user.update({
      where: { id: uid },
      data: { emailNotificationsEnabled: false },
    });

    res.send(unsubscribePage('Unsubscribed', "You've been unsubscribed from email notifications. You can re-enable them anytime in Settings.", true));
  } catch (error) {
    console.error('Unsubscribe error:', error);
    res.status(500).send(unsubscribePage('Error', 'Something went wrong. Please try again later.', false));
  }
});

function unsubscribePage(title, message, success) {
  const icon = success ? '&#10003;' : '&#10007;';
  const iconColor = success ? '#4ade80' : '#f87171';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - Motion</title>
</head>
<body style="margin:0;padding:0;background-color:#0A0A0A;font-family:Arial,Helvetica,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0A0A0A;min-height:100vh;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="max-width:440px;width:100%;background-color:#1A1A1A;border-radius:16px;overflow:hidden;">
          <tr>
            <td align="center" style="padding:40px 32px 20px;">
              <h1 style="margin:0 0 24px;font-size:28px;font-weight:800;letter-spacing:4px;color:#D4AF37;">MOTION</h1>
              <div style="width:64px;height:64px;border-radius:50%;background-color:${iconColor}20;display:inline-flex;align-items:center;justify-content:center;margin-bottom:20px;">
                <span style="font-size:32px;color:${iconColor};line-height:64px;">${icon}</span>
              </div>
              <h2 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#FFFFFF;">${title}</h2>
              <p style="margin:0;font-size:15px;color:#999;line-height:1.6;">${message}</p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:0 32px 32px;">
              <p style="margin:0;font-size:12px;color:#666;">&copy; ${new Date().getFullYear()} Motion &mdash; Move Different</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function sendWelcomeMessage(userId, role) {
  const admin = await prisma.user.findUnique({ where: { email: 'admin@motion.app' } });
  if (!admin) return;

  // Ensure a consistent participant order for the unique constraint
  const [user1Id, user2Id] = [admin.id, userId].sort();

  const conversation = await prisma.conversation.upsert({
    where: { user1Id_user2Id: { user1Id, user2Id } },
    create: { user1Id, user2Id },
    update: {},
  });

  const defaultStepper = `Welcome to Motion, King! 👑\n\nYou're officially a Stepper. Here's how to get started:\n\n• Browse Baddies in the Feed and send a Like\n• Post a Move to invite Baddies to link up\n• Complete your profile to stand out\n\nLet's get it! 🚀`;
  const defaultBaddie = `Welcome to Motion, Queen! ✨\n\nYou're officially a Baddie. Here's how to get started:\n\n• Browse the Feed and Like a Stepper you're feeling\n• Check out Moves to see what Steppers are planning\n• Complete your profile so they notice you\n\nTime to shine! 💅`;

  const settingKey = role === 'STEPPER' ? 'welcomeMessageStepper' : 'welcomeMessageBaddie';
  const setting = await prisma.appSetting.findUnique({ where: { key: settingKey } });
  const content = setting?.value?.trim() || (role === 'STEPPER' ? defaultStepper : defaultBaddie);

  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      senderId: admin.id,
      content,
      contentType: 'TEXT',
    },
  });

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { lastMessageAt: new Date() },
  });
}

async function generateLoginNotifications(userId, hasProfile) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true, profilePrompts: true },
  });

  // --- Profile completion notifications ---
  if (user?.profile) {
    const items = [];
    if ((user.profile.photos || []).length < 2) {
      items.push({
        action: 'add_photo',
        title: 'Add a Second Photo',
        body: 'Profiles with 2+ photos get more attention',
      });
    }
    if (!user.profilePrompts || user.profilePrompts.length === 0) {
      items.push({
        action: 'add_prompts',
        title: 'Answer Profile Prompts',
        body: 'Show your personality — pick and answer prompts',
      });
    }
    if (!user.profile.height || !user.profile.weight) {
      items.push({
        action: 'add_height_weight',
        title: 'Add Height & Weight',
        body: 'Help others get the full picture — add your height and weight',
      });
    }
    if (!user.profile.occupation) {
      items.push({
        action: 'add_occupation',
        title: 'Add Your Occupation',
        body: 'Let people know what you do — add your occupation',
      });
    }

    for (const item of items) {
      const existing = await prisma.notification.findFirst({
        where: {
          userId,
          type: 'profile_incomplete',
          readAt: null,
          data: { path: ['action'], equals: item.action },
        },
      });
      if (!existing) {
        await prisma.notification.create({
          data: {
            userId,
            type: 'profile_incomplete',
            title: item.title,
            body: item.body,
            data: { action: item.action },
          },
        });
      }
    }
  }

  // --- Vibe available notification ---
  try {
    const windowStart = new Date(Date.now() - 12 * 60 * 60 * 1000);
    const answeredInWindow = await prisma.vibeAnswer.count({
      where: { userId, answeredAt: { gte: windowStart } },
    });

    if (answeredInWindow < 25) {
      const answeredIds = (
        await prisma.vibeAnswer.findMany({
          where: { userId },
          select: { questionId: true },
        })
      ).map((a) => a.questionId);

      const unansweredCount = await prisma.vibeQuestion.count({
        where: {
          isActive: true,
          ...(answeredIds.length > 0 && { id: { notIn: answeredIds } }),
        },
      });

      if (unansweredCount > 0) {
        const existingVibe = await prisma.notification.findFirst({
          where: {
            userId,
            type: 'vibe_available',
            readAt: null,
          },
        });
        if (!existingVibe) {
          await prisma.notification.create({
            data: {
              userId,
              type: 'vibe_available',
              title: 'Vibe Questions Available',
              body: 'Answer new questions to boost your vibe scores',
              data: { action: 'vibe_available' },
            },
          });
        }
      }
    }
  } catch (err) {
    console.error('Vibe notification error:', err);
  }

  // --- Install app notification (once ever) ---
  if (hasProfile) {
    try {
      const existingInstall = await prisma.notification.findFirst({
        where: {
          userId,
          type: 'install_app',
        },
      });
      if (!existingInstall) {
        await prisma.notification.create({
          data: {
            userId,
            type: 'install_app',
            title: 'Install Motion',
            body: 'Add Motion to your home screen for the best experience',
            data: { action: 'install_app' },
          },
        });
      }
    } catch (err) {
      console.error('Install notification error:', err);
    }
  }

  // --- New version notification ---
  try {
    const appVersion = config.appVersion;
    if (appVersion && appVersion !== '0.0.0') {
      const existingVersion = await prisma.notification.findFirst({
        where: {
          userId,
          type: 'new_version',
          data: { path: ['version'], equals: appVersion },
        },
      });
      if (!existingVersion) {
        await prisma.notification.create({
          data: {
            userId,
            type: 'new_version',
            title: "What's New in Motion",
            body: 'Check out the latest features and improvements',
            data: { action: 'new_version', version: appVersion },
          },
        });
      }
    }
  } catch (err) {
    console.error('Version notification error:', err);
  }
}

export default router;
