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

// Register
router.post('/register', async (req, res) => {
  try {
    const { email, password, role } = req.body;

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

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email, passwordHash, role },
    });

    const tokens = generateTokens(user.id, user.role);
    res.status(201).json({ user: { id: user.id, email: user.email, role: user.role }, ...tokens });
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
        hasProfile: !!user.profile,
      },
      ...tokens,
    });
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
      hasProfile: !!user.profile,
      profile: user.profile,
      notificationsEnabled: user.notificationsEnabled,
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

export default router;
