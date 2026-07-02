"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireSubscription = void 0;
const subscription_1 = require("../services/subscription");
const requireSubscription = async (req, res, next) => {
    try {
        // Extract uid from Firebase ID token (set by your auth middleware)
        const uid = req.uid;
        if (!uid) {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        // Check subscription status
        const canWrite = await subscription_1.SubscriptionService.canWrite(uid);
        if (!canWrite) {
            return res.status(403).json({
                error: 'Trial expired or subscription required',
                code: 'SUBSCRIPTION_REQUIRED',
            });
        }
        next();
    }
    catch (err) {
        console.error('[Middleware] Subscription check failed:', err);
        res.status(500).json({ error: 'Subscription check failed' });
    }
};
exports.requireSubscription = requireSubscription;
//# sourceMappingURL=subscription.js.map