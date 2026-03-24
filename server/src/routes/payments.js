import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import Stripe from 'stripe';
import { authenticate } from '../middleware/auth.js';
import config from '../config/index.js';

const router = Router();
const prisma = new PrismaClient();
const stripe = new Stripe(config.stripe.secretKey);

// Create checkout session
router.post('/checkout', authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      include: { subscription: true },
    });

    if (!user) return res.status(404).json({ error: 'User not found' });

    let customerId = user.subscription?.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({ email: user.email, metadata: { userId: user.id } });
      customerId = customer.id;

      await prisma.subscription.upsert({
        where: { userId: user.id },
        update: { stripeCustomerId: customerId },
        create: { userId: user.id, stripeCustomerId: customerId },
      });
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: config.stripe.priceId, quantity: 1 }],
      success_url: `${config.clientUrl}/premium?success=true`,
      cancel_url: `${config.clientUrl}/premium?canceled=true`,
      metadata: { userId: user.id },
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('Checkout error:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// Get subscription status
router.get('/status', authenticate, async (req, res) => {
  try {
    const [user, freeMessaging] = await Promise.all([
      prisma.user.findUnique({
        where: { id: req.userId },
        include: { subscription: true },
      }),
      prisma.appSetting.findUnique({ where: { key: 'freeMessaging' } }),
    ]);

    res.json({
      isPremium: user?.isPremium || false,
      freeMessaging: freeMessaging?.value === 'true',
      subscription: user?.subscription
        ? {
            status: user.subscription.status,
            currentPeriodEnd: user.subscription.currentPeriodEnd,
          }
        : null,
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Temporary free upgrade (for testing)
router.post('/free-upgrade', authenticate, async (req, res) => {
  try {
    await prisma.user.update({
      where: { id: req.userId },
      data: { isPremium: true },
    });
    res.json({ success: true, isPremium: true });
  } catch (error) {
    console.error('Free upgrade error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- Stripe Connect: Onboard creator ---
router.post('/connect/onboard', authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    let accountId = user.stripeConnectAccountId;

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        email: user.email,
        metadata: { userId: user.id },
      });
      accountId = account.id;
      await prisma.user.update({
        where: { id: user.id },
        data: { stripeConnectAccountId: accountId },
      });
    }

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${config.clientUrl}/settings?connect=refresh`,
      return_url: `${config.clientUrl}/settings?connect=success`,
      type: 'account_onboarding',
    });

    res.json({ url: accountLink.url });
  } catch (error) {
    console.error('Connect onboard error:', error);
    res.status(500).json({ error: 'Failed to create onboarding link' });
  }
});

// --- Stripe Connect: Check status ---
router.get('/connect/status', authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user?.stripeConnectAccountId) {
      return res.json({ connected: false, chargesEnabled: false });
    }

    const account = await stripe.accounts.retrieve(user.stripeConnectAccountId);
    res.json({ connected: true, chargesEnabled: account.charges_enabled });
  } catch (error) {
    console.error('Connect status error:', error);
    res.status(500).json({ error: 'Failed to check connect status' });
  }
});

// --- Stripe Connect: Dashboard link ---
router.get('/connect/dashboard', authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user?.stripeConnectAccountId) {
      return res.status(400).json({ error: 'No Connect account found' });
    }

    const loginLink = await stripe.accounts.createLoginLink(user.stripeConnectAccountId);
    res.json({ url: loginLink.url });
  } catch (error) {
    console.error('Connect dashboard error:', error);
    res.status(500).json({ error: 'Failed to create dashboard link' });
  }
});

// --- Story Tips ---
const VALID_TIP_AMOUNTS = [100, 300, 500, 1000]; // cents

router.post('/tip', authenticate, async (req, res) => {
  try {
    const { storyId, amount } = req.body;

    if (!storyId || !VALID_TIP_AMOUNTS.includes(amount)) {
      return res.status(400).json({ error: 'Invalid story or tip amount' });
    }

    const story = await prisma.story.findUnique({
      where: { id: storyId },
      include: { user: true },
    });

    if (!story) return res.status(404).json({ error: 'Story not found' });
    if (story.userId === req.userId) return res.status(400).json({ error: 'Cannot tip your own story' });

    const creator = story.user;
    if (!creator.stripeConnectAccountId) {
      return res.status(400).json({ error: 'This user hasn\'t set up tips yet' });
    }

    // Verify creator's account can accept charges
    const account = await stripe.accounts.retrieve(creator.stripeConnectAccountId);
    if (!account.charges_enabled) {
      return res.status(400).json({ error: 'This user hasn\'t finished setting up tips' });
    }

    const platformFee = Math.round(amount * config.stripe.platformFeePercent);

    const tip = await prisma.tip.create({
      data: {
        storyId,
        tipperId: req.userId,
        creatorId: creator.id,
        amount,
        platformFee,
      },
    });

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: `Tip for story` },
          unit_amount: amount,
        },
        quantity: 1,
      }],
      payment_intent_data: {
        application_fee_amount: platformFee,
        transfer_data: { destination: creator.stripeConnectAccountId },
      },
      success_url: `${config.clientUrl}/stories?tip=success`,
      cancel_url: `${config.clientUrl}/stories?tip=canceled`,
      metadata: { tipId: tip.id, tipperId: req.userId, creatorId: creator.id },
    });

    await prisma.tip.update({
      where: { id: tip.id },
      data: { stripeSessionId: session.id },
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('Tip error:', error);
    res.status(500).json({ error: 'Failed to create tip session' });
  }
});

// Stripe webhook
router.post('/webhook', async (req, res) => {
  let event;

  try {
    const sig = req.headers['stripe-signature'];
    event = stripe.webhooks.constructEvent(req.body, sig, config.stripe.webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;

        // Handle tip completion
        if (session.metadata?.tipId) {
          const tipId = session.metadata.tipId;
          await prisma.tip.update({
            where: { id: tipId },
            data: {
              status: 'completed',
              stripePaymentIntentId: session.payment_intent,
            },
          });

          // Create notification for creator
          const tip = await prisma.tip.findUnique({
            where: { id: tipId },
            include: { tipper: { include: { profile: true } } },
          });
          if (tip) {
            const tipperName = tip.tipper.profile?.displayName || 'Someone';
            const amountStr = `$${(tip.amount / 100).toFixed(0)}`;
            await prisma.notification.create({
              data: {
                userId: tip.creatorId,
                type: 'tip_received',
                title: 'Tip Received!',
                body: `${tipperName} tipped ${amountStr} on your story`,
                data: { tipId: tip.id, storyId: tip.storyId, tipperId: tip.tipperId },
              },
            });

            // Emit socket event
            try {
              const { io } = await import('../server.js');
              if (io) {
                io.to(`user:${tip.creatorId}`).emit('notification', {
                  type: 'tip_received',
                  title: 'Tip Received!',
                  body: `${tipperName} tipped ${amountStr} on your story`,
                });
              }
            } catch {}
          }
          break;
        }

        // Handle subscription completion
        const userId = session.metadata.userId;
        if (userId && session.subscription) {
          await prisma.subscription.update({
            where: { userId },
            data: {
              stripeSubscriptionId: session.subscription,
              status: 'active',
            },
          });
          await prisma.user.update({
            where: { id: userId },
            data: { isPremium: true },
          });
        }
        break;
      }
      case 'checkout.session.expired': {
        const session = event.data.object;
        if (session.metadata?.tipId) {
          await prisma.tip.update({
            where: { id: session.metadata.tipId },
            data: { status: 'failed' },
          });
        }
        break;
      }
      case 'invoice.paid': {
        const invoice = event.data.object;
        if (invoice.subscription) {
          const sub = await prisma.subscription.findFirst({
            where: { stripeSubscriptionId: invoice.subscription },
          });
          if (sub) {
            await prisma.subscription.update({
              where: { id: sub.id },
              data: {
                status: 'active',
                currentPeriodEnd: new Date(invoice.lines.data[0]?.period?.end * 1000),
              },
            });
            await prisma.user.update({
              where: { id: sub.userId },
              data: { isPremium: true },
            });
          }
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const sub = await prisma.subscription.findFirst({
          where: { stripeSubscriptionId: subscription.id },
        });
        if (sub) {
          await prisma.subscription.update({
            where: { id: sub.id },
            data: { status: 'canceled' },
          });
          await prisma.user.update({
            where: { id: sub.userId },
            data: { isPremium: false },
          });
        }
        break;
      }
    }
  } catch (error) {
    console.error('Webhook handler error:', error);
  }

  res.json({ received: true });
});

export default router;
