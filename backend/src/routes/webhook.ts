import { Router, Request, Response } from 'express';
import * as admin from 'firebase-admin';
import Stripe from 'stripe';
import { SubscriptionService } from '../services/subscription';
import { requireSubscription } from '../middleware/subscription';

const router = Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

router.post('/whatsapp', requireSubscription, async (req, res) => {
  const { from, text, timestamp } = req.body;

  try {
    const db = admin.firestore();

    await db.collection('messages').add({
      from,
      text,
      timestamp: new Date(timestamp * 1000),
      status: 'received',
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
      });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('[webhook/whatsapp]', err);
    res.status(500).json({ error: 'Error procesando mensaje' });
  }
});

// Stripe webhook endpoint
router.post('/stripe', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;

  try {
    if (!sig) {
      console.error('[webhook/stripe] Missing stripe-signature header');
      return res.status(400).json({ error: 'Missing signature header' });
    }

    // Construct event from raw body
    const webhookSecret = SubscriptionService.getWebhookSecret();
    if (!webhookSecret) {
      console.error('[webhook/stripe] STRIPE_WEBHOOK_SECRET not configured');
      return res.status(500).json({ error: 'Webhook secret not configured' });
    }

    const event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      webhookSecret
    );

    // Handle subscription events
    if (event.type.startsWith('customer.subscription.')) {
      const customerId = (event.data.object as any).customer;

      try {
        await SubscriptionService.updateFromStripeWebhook(customerId, event);
        console.log('[webhook/stripe] Updated subscription from Stripe:', {
          type: event.type,
          customerId,
        });
      } catch (err) {
        console.error('[webhook/stripe] Failed to update subscription:', err);
        return res.status(500).json({ error: 'Failed to update subscription' });
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error('[webhook/stripe] Invalid signature or parsing error:', err instanceof Error ? err.message : err);
    res.status(400).json({ error: 'Invalid signature' });
  }
});

export default router;
