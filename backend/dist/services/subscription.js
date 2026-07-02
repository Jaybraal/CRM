"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionService = void 0;
const admin = __importStar(require("firebase-admin"));
const stripe_1 = require("./stripe");
exports.SubscriptionService = {
    async createTrialUser(uid, email) {
        const db = admin.firestore();
        // Create Stripe customer
        const { customerId } = await stripe_1.StripeService.createCustomer(email, uid);
        // Calculate trial end (30 minutes from now)
        const now = Math.floor(Date.now() / 1000);
        const trialEndsAt = now + 1800; // 30 min
        const subscriptionStatus = {
            uid,
            status: 'trial',
            customerId,
            trialStartedAt: now,
            trialEndsAt,
        };
        // Write to Firestore
        await db.collection('subscriptions').doc(uid).set(subscriptionStatus);
        return subscriptionStatus;
    },
    async getSubscriptionStatus(uid) {
        const db = admin.firestore();
        const doc = await db.collection('subscriptions').doc(uid).get();
        if (!doc.exists) {
            return null;
        }
        return doc.data();
    },
    async updateFromStripeWebhook(customerId, event) {
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
        }
        else if (event.type === 'customer.subscription.deleted') {
            await docRef.update({
                status: 'canceled',
                canceledAt: Math.floor(Date.now() / 1000),
            });
        }
    },
    async isTrialActive(uid) {
        const status = await this.getSubscriptionStatus(uid);
        if (!status)
            return false;
        const now = Math.floor(Date.now() / 1000);
        return status.status === 'trial' && now < status.trialEndsAt;
    },
    async isPaid(uid) {
        const status = await this.getSubscriptionStatus(uid);
        if (!status)
            return false;
        return status.status === 'active';
    },
    async canWrite(uid) {
        const isTrialActive = await this.isTrialActive(uid);
        const isPaid = await this.isPaid(uid);
        return isTrialActive || isPaid;
    },
    getWebhookSecret() {
        return process.env.STRIPE_WEBHOOK_SECRET || '';
    },
};
//# sourceMappingURL=subscription.js.map