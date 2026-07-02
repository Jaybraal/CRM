import { Request, Response, NextFunction } from 'express';
import { SubscriptionService } from '../services/subscription';

// Extend Express Request to include uid
declare global {
  namespace Express {
    interface Request {
      uid?: string;
    }
  }
}

export const requireSubscription = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Extract uid from Firebase ID token (set by your auth middleware)
    const uid = req.uid;

    if (!uid) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Check subscription status
    const canWrite = await SubscriptionService.canWrite(uid);

    if (!canWrite) {
      return res.status(403).json({
        error: 'Trial expired or subscription required',
        code: 'SUBSCRIPTION_REQUIRED',
      });
    }

    next();
  } catch (err) {
    console.error('[Middleware] Subscription check failed:', err);
    res.status(500).json({ error: 'Subscription check failed' });
  }
};
