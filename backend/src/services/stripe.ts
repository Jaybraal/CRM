import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

export const StripeService = {
  async createCustomer(email: string, uid: string) {
    const customer = await stripe.customers.create({
      email,
      metadata: {
        firebaseUID: uid,
      },
    });
    return { customerId: customer.id };
  },

  async createCheckoutSession(customerId: string, returnUrl: string) {
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: process.env.STRIPE_PRODUCT_ID || '',
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${returnUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${returnUrl}`,
    });
    return { sessionUrl: session.url };
  },

  async getSubscriptionStatus(customerId: string) {
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      limit: 1,
      status: 'all',
    });

    if (subscriptions.data.length === 0) {
      return { status: 'trialing', trialEndsAt: 0 };
    }

    const sub = subscriptions.data[0];
    return {
      status: sub.status as 'active' | 'trialing' | 'canceled',
      subscriptionId: sub.id,
      periodEnd: (sub as any).current_period_end,
    };
  },

  getWebhookSecret() {
    return process.env.STRIPE_WEBHOOK_SECRET || '';
  },
};
