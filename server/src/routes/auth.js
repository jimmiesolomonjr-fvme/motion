import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import config from '../config/index.js';
import { validateEmail, validatePassword, validateRole } from '../utils/validators.js';
import { authenticate } from '../middleware/auth.js';

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
      if (referrer) referredBy = referralCode;
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

    // Fire-and-forget: generate profile completion notifications
    generateCompletionNotifications(user.id).catch(() => {});
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

async function generateCompletionNotifications(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true, profilePrompts: true },
  });
  if (!user?.profile) return;

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

export default router;
