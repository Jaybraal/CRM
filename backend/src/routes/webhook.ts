import { Router, Request, Response } from 'express';
import * as admin from 'firebase-admin';
import Stripe from 'stripe';
import { SubscriptionService } from '../services/subscription';
import { requireSubscription } from '../middleware/subscription';

const router = Router();

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

// WhatsApp webhook — requires active subscription
router.post('/whatsapp', requireSubscription, async (req, res) => {
  const { from, text, timestamp } = req.body;

  try {
    const db = admin.firestore();

    await db.collection('messages').add({
      from,
      text,
      timestamp: new Date(timestamp * 1000),
      status: 'received',
      uid: req.uid,
    });

    const clientsSnap = await db.collection('clients')
      .where('phone', '==', from)
      .limit(1)
      .get();

    if (clientsSnap.empty) {
      await db.collection('leads').add({
        phone: from,
        firstMessage: text,
        timestamp: new Date(),
        status: 'new',
        uid: req.uid,
      });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('[webhook/whatsapp]', err);
    res.status(500).json({ error: 'Error procesando mensaje' });
  }
});

// Stripe webhook — no auth needed (uses signing secret)
router.post('/stripe', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;

  if (!sig) {
    return res.status(400).json({ error: 'Missing stripe-signature header' });
  }

  try {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

    // Stripe expects raw body for signature verification
    // If using raw body middleware, construct event here
    const event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      webhookSecret
    );

    // Handle subscription events
    if (
      event.type === 'customer.subscription.updated' ||
      event.type === 'customer.subscription.created' ||
      event.type === 'customer.subscription.deleted'
    ) {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;

      await SubscriptionService.updateFromStripeWebhook(customerId, event);
      console.log('[webhook/stripe] Updated subscription:', customerId);
    }

    res.json({ received: true });
  } catch (err) {
    console.error('[webhook/stripe]', err);
    res.status(400).json({ error: 'Webhook verification failed' });
  }
});

export default router;
