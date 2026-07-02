import * as admin from 'firebase-admin';
import { StripeService } from './stripe';
import { SubscriptionStatus } from '../types/subscription';

class SubscriptionServiceClass {
  async createTrialUser(uid: string, email: string): Promise<SubscriptionStatus> {
    const db = admin.firestore();

    // Create Stripe customer
    const { customerId } = await StripeService.createCustomer(email, uid);

    // Calculate trial end (30 minutes from now)
    const now = Math.floor(Date.now() / 1000);
    const trialEndsAt = now + 1800; // 30 min

    const subscriptionStatus: SubscriptionStatus = {
      uid,
      status: 'trial',
      customerId,
      trialStartedAt: now,
      trialEndsAt,
    };

    // Write to Firestore
    await db.collection('subscriptions').doc(uid).set(subscriptionStatus);

    return subscriptionStatus;
  }

  async getSubscriptionStatus(uid: string): Promise<SubscriptionStatus | null> {
    const db = admin.firestore();
    const doc = await db.collection('subscriptions').doc(uid).get();

    if (!doc.exists) {
      return null;
    }

    return doc.data() as SubscriptionStatus;
  }

  async updateFromStripeWebhook(customerId: string, event: any): Promise<void> {
    const db = admin.firestore();

    // Find subscription document by customerId
    const snapshot = await db.collection('subscriptions')
      .where('customerId', '==', customerId)
      .limit(1)
      .get();

    if (snapshot.empty) {
      console.warn('[Subscription] Customer not found:', customerId);
      return;
    }

    const docRef = snapshot.docs[0].ref;

    // Update based on event type
    if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.created') {
      const sub = event.data.object;
      await docRef.update({
        status: 'active',
        subscriptionId: sub.id,
        currentPeriodEnd: sub.current_period_end,
      });
    } else if (event.type === 'customer.subscription.deleted') {
      await docRef.update({
        status: 'canceled',
        canceledAt: Math.floor(Date.now() / 1000),
      });
    }
  }

  async isTrialActive(uid: string): Promise<boolean> {
    const status = await this.getSubscriptionStatus(uid);
    if (!status) return false;

    const now = Math.floor(Date.now() / 1000);
    return status.status === 'trial' && now < status.trialEndsAt;
  }

  async isPaid(uid: string): Promise<boolean> {
    const status = await this.getSubscriptionStatus(uid);
    if (!status) return false;

    return status.status === 'active';
  }

  async canWrite(uid: string): Promise<boolean> {
    const isTrialActive = await this.isTrialActive(uid);
    const isPaid = await this.isPaid(uid);
    return isTrialActive || isPaid;
  }

  getWebhookSecret(): string {
    return process.env.STRIPE_WEBHOOK_SECRET || '';
  }
}

// Export singleton instance
export const SubscriptionService = new SubscriptionServiceClass();
