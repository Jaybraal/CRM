"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StripeService = void 0;
const stripe_1 = __importDefault(require("stripe"));
const stripe = new stripe_1.default(process.env.STRIPE_SECRET_KEY || '');
exports.StripeService = {
    async createCustomer(email, uid) {
        const customer = await stripe.customers.create({
            email,
            metadata: {
                firebaseUID: uid,
            },
        });
        return { customerId: customer.id };
    },
    async createCheckoutSession(customerId, returnUrl) {
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
    async getSubscriptionStatus(customerId) {
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
            status: sub.status,
            subscriptionId: sub.id,
            periodEnd: sub.current_period_end,
        };
    },
    getWebhookSecret() {
        return process.env.STRIPE_WEBHOOK_SECRET || '';
    },
};
//# sourceMappingURL=stripe.js.map