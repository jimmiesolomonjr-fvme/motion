import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function requirePremium(req, res, next) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { isPremium: true, role: true, isMuted: true, isAdmin: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.isMuted) {
      return res.status(403).json({ error: 'Your messaging privileges have been suspended' });
    }

    // Admins bypass premium check
    if (user.isAdmin) {
      return next();
    }

    // Baddies message freely
    if (user.role === 'BADDIE') {
      return next();
    }

    // Check if free messaging is enabled
    const freeMessaging = await prisma.appSetting.findUnique({ where: { key: 'freeMessaging' } });
    if (freeMessaging?.value === 'true') {
      return next();
    }

    if (!user.isPremium) {
      return res.status(403).json({ error: 'Premium subscription required for Steppers to send messages' });
    }

    next();
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
}
