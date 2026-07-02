import { Request, Response, NextFunction } from 'express';
import * as admin from 'firebase-admin';

// Extend Express Request to include uid
declare global {
  namespace Express {
    interface Request {
      uid?: string;
    }
  }
}

export const verifyFirebaseToken = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Extract Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Check for Bearer prefix
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Extract token (remove "Bearer " prefix)
    const token = authHeader.substring(7);

    if (!token) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Verify token with Firebase Admin SDK
    const decodedToken = await admin.auth().verifyIdToken(token);

    // Set uid on request object
    req.uid = decodedToken.uid;

    next();
  } catch (err) {
    console.error('[Auth] Token verification failed:', err instanceof Error ? err.message : err);
    res.status(401).json({ error: 'Invalid token' });
  }
};
