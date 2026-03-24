import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import Stripe from 'stripe';
import { authenticate } from '../middleware/auth.js';
import config from '../config/index.js';
import { sendEmail, brandedTemplate } from '../services/email.js';

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
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      include: { profile: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });

    let accountId = user.stripeConnectAccountId;

    if (!accountId) {
      // Pre-fill name from profile to reduce onboarding screens
      const nameParts = (user.profile?.displayName || '').trim().split(/\s+/);
      const firstName = nameParts[0] || undefined;
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : undefined;

      const account = await stripe.accounts.create({
        type: 'express',
        country: 'US',
        business_type: 'individual',
        individual: {
          email: user.email,
          ...(firstName && { first_name: firstName }),
          ...(lastName && { last_name: lastName }),
        },
        capabilities: {
          transfers: { requested: true },
        },
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
      collection_options: {
        fields: 'currently_due',
        future_requirements: 'omit',
      },
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
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      include: { profile: true },
    });
    if (!user?.stripeConnectAccountId) {
      return res.json({ connected: false, chargesEnabled: false });
    }

    const account = await stripe.accounts.retrieve(user.stripeConnectAccountId);
    const chargesEnabled = account.charges_enabled;

    // When creator just finished onboarding, notify tippers with held tips
    if (chargesEnabled) {
      const heldTips = await prisma.tip.findMany({
        where: {
          creatorId: req.userId,
          status: 'held',
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
        include: { tipper: true },
      });

      const creatorName = user.profile?.displayName || 'A creator';

      for (const tip of heldTips) {
        const tipAmountStr = `$${(tip.amount / 100).toFixed(0)}`;

        // In-app notification
        await prisma.notification.create({
          data: {
            userId: tip.tipperId,
            type: 'tip_ready',
            title: `${creatorName} set up tips!`,
            body: `Complete your ${tipAmountStr} tip now.`,
            data: { tipId: tip.id, storyId: tip.storyId, creatorId: req.userId },
          },
        });

        // Socket notification
        try {
          const { io } = await import('../server.js');
          if (io) {
            io.to(`user:${tip.tipperId}`).emit('notification', {
              type: 'tip_ready',
              title: `${creatorName} set up tips!`,
              body: `Complete your ${tipAmountStr} tip now.`,
            });
          }
        } catch {}

        // Email tipper
        sendEmail({
          to: tip.tipper.email,
          subject: `${creatorName} set up tips — complete your ${tipAmountStr} tip!`,
          html: brandedTemplate(`
            <h2 style="color:#D4AF37;margin:0 0 16px;">${creatorName} is ready for tips!</h2>
            <p>Your ${tipAmountStr} tip is waiting to be completed. Tap below to finish sending it.</p>
            <div style="text-align:center;margin:24px 0;">
              <a href="${config.clientUrl}/stories?completeTip=${tip.id}" style="display:inline-block;padding:12px 32px;background:#22C55E;color:#fff;text-decoration:none;border-radius:12px;font-weight:bold;">Complete Tip</a>
            </div>
            <p style="color:#888;font-size:13px;">No money has been charged yet. You can also cancel this tip anytime.</p>
          `, `${creatorName} set up tips on Motion`),
        }).catch(() => {});
      }
    }

    res.json({ connected: true, chargesEnabled });
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
    const tipper = await prisma.user.findUnique({
      where: { id: req.userId },
      include: { profile: true },
    });
    const tipperName = tipper?.profile?.displayName || 'Someone';
    const amountStr = `$${(amount / 100).toFixed(0)}`;

    // Check if creator is onboarded
    let creatorOnboarded = false;
    if (creator.stripeConnectAccountId) {
      const account = await stripe.accounts.retrieve(creator.stripeConnectAccountId);
      creatorOnboarded = account.charges_enabled;
    }

    const platformFee = Math.round(amount * config.stripe.platformFeePercent);

    // --- Creator NOT onboarded: hold the tip ---
    if (!creatorOnboarded) {
      const tip = await prisma.tip.create({
        data: {
          storyId,
          tipperId: req.userId,
          creatorId: creator.id,
          amount,
          platformFee,
          status: 'held',
        },
      });

      // Notify creator in-app
      const creatorProfile = await prisma.profile.findUnique({ where: { userId: creator.id } });
      const creatorDisplayName = creatorProfile?.displayName || 'there';

      await prisma.notification.create({
        data: {
          userId: creator.id,
          type: 'tip_held',
          title: 'Someone wants to tip you!',
          body: `${tipperName} sent you a ${amountStr} tip! Set up tips to claim it.`,
          data: { tipId: tip.id, storyId, tipperId: req.userId },
        },
      });

      // Socket notification to creator
      try {
        const { io } = await import('../server.js');
        if (io) {
          io.to(`user:${creator.id}`).emit('notification', {
            type: 'tip_held',
            title: 'Someone wants to tip you!',
            body: `${tipperName} sent you a ${amountStr} tip! Set up tips to claim it.`,
          });
        }
      } catch {}

      // Email creator
      sendEmail({
        to: creator.email,
        subject: `${tipperName} sent you a ${amountStr} tip!`,
        html: brandedTemplate(`
          <h2 style="color:#D4AF37;margin:0 0 16px;">${tipperName} wants to tip you ${amountStr}!</h2>
          <p>Set up tips on Motion to claim this tip and any future tips you receive.</p>
          <div style="text-align:center;margin:24px 0;">
            <a href="${config.clientUrl}/settings" style="display:inline-block;padding:12px 32px;background:#D4AF37;color:#0A0A0A;text-decoration:none;border-radius:12px;font-weight:bold;">Set Up Tips</a>
          </div>
          <p style="color:#888;font-size:13px;">The tip will be held for 7 days. No money has been charged yet.</p>
        `, `${tipperName} sent you a ${amountStr} tip on Motion`),
      }).catch(() => {});

      return res.json({ held: true, tipId: tip.id });
    }

    // --- Creator IS onboarded: normal Stripe Checkout flow ---
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

// --- Get pending (held) tips for the current tipper ---
const HELD_TIP_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

router.get('/tips/pending', authenticate, async (req, res) => {
  try {
    const where = {
      tipperId: req.userId,
      status: 'held',
      createdAt: { gte: new Date(Date.now() - HELD_TIP_EXPIRY_MS) },
    };
    if (req.query.creatorId) {
      where.creatorId = req.query.creatorId;
    }

    const tips = await prisma.tip.findMany({
      where,
      include: {
        creator: { include: { profile: true } },
        story: { select: { id: true, photo: true, caption: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Auto-expire old held tips (clean up any that slipped past the filter)
    const expiredIds = [];
    const validTips = tips.filter((t) => {
      if (Date.now() - new Date(t.createdAt).getTime() > HELD_TIP_EXPIRY_MS) {
        expiredIds.push(t.id);
        return false;
      }
      return true;
    });

    if (expiredIds.length > 0) {
      prisma.tip.updateMany({
        where: { id: { in: expiredIds } },
        data: { status: 'expired' },
      }).catch(() => {});
    }

    // Check if creator is now onboarded
    const enriched = await Promise.all(
      validTips.map(async (tip) => {
        let creatorOnboarded = false;
        if (tip.creator.stripeConnectAccountId) {
          try {
            const acct = await stripe.accounts.retrieve(tip.creator.stripeConnectAccountId);
            creatorOnboarded = acct.charges_enabled;
          } catch {}
        }
        return {
          id: tip.id,
          amount: tip.amount,
          createdAt: tip.createdAt,
          creatorId: tip.creatorId,
          creatorName: tip.creator.profile?.displayName || 'Unknown',
          storyId: tip.storyId,
          storyPhoto: tip.story?.photo,
          creatorOnboarded,
        };
      })
    );

    res.json(enriched);
  } catch (error) {
    console.error('Pending tips error:', error);
    res.status(500).json({ error: 'Failed to fetch pending tips' });
  }
});

// --- Complete a held tip ---
router.post('/tip/:id/complete', authenticate, async (req, res) => {
  try {
    const tip = await prisma.tip.findUnique({
      where: { id: req.params.id },
      include: { creator: true },
    });

    if (!tip) return res.status(404).json({ error: 'Tip not found' });
    if (tip.tipperId !== req.userId) return res.status(403).json({ error: 'Not your tip' });
    if (tip.status !== 'held') return res.status(400).json({ error: 'Tip is not held' });

    // Verify creator is now onboarded
    if (!tip.creator.stripeConnectAccountId) {
      return res.status(400).json({ error: 'Creator hasn\'t set up tips yet' });
    }
    const account = await stripe.accounts.retrieve(tip.creator.stripeConnectAccountId);
    if (!account.charges_enabled) {
      return res.status(400).json({ error: 'Creator hasn\'t finished setting up tips' });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: 'Tip for story' },
          unit_amount: tip.amount,
        },
        quantity: 1,
      }],
      payment_intent_data: {
        application_fee_amount: tip.platformFee,
        transfer_data: { destination: tip.creator.stripeConnectAccountId },
      },
      success_url: `${config.clientUrl}/stories?tip=success`,
      cancel_url: `${config.clientUrl}/stories?tip=canceled`,
      metadata: { tipId: tip.id, tipperId: req.userId, creatorId: tip.creatorId },
    });

    await prisma.tip.update({
      where: { id: tip.id },
      data: { status: 'pending', stripeSessionId: session.id },
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('Complete tip error:', error);
    res.status(500).json({ error: 'Failed to complete tip' });
  }
});

// --- Cancel a held tip ---
router.delete('/tip/:id', authenticate, async (req, res) => {
  try {
    const tip = await prisma.tip.findUnique({ where: { id: req.params.id } });

    if (!tip) return res.status(404).json({ error: 'Tip not found' });
    if (tip.tipperId !== req.userId) return res.status(403).json({ error: 'Not your tip' });
    if (tip.status !== 'held') return res.status(400).json({ error: 'Tip is not held' });

    await prisma.tip.update({
      where: { id: tip.id },
      data: { status: 'canceled' },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Cancel tip error:', error);
    res.status(500).json({ error: 'Failed to cancel tip' });
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
