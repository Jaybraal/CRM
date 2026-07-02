import { Router, Request, Response } from 'express';
import * as admin from 'firebase-admin';
import { requireSubscription } from '../middleware/subscription';

const router = Router();
const db = admin.firestore();

// POST / - Create a new deal (requires subscription)
router.post('/', requireSubscription, async (req: Request, res: Response) => {
  const { leadId, title, value, stage } = req.body;
  const uid = req.uid;

  // Validate required fields
  if (!uid) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  if (!leadId) {
    return res.status(400).json({ error: 'leadId is required' });
  }

  if (!title) {
    return res.status(400).json({ error: 'title is required' });
  }

  try {
    const dealData = {
      leadId,
      title,
      value: value || null,
      stage: stage || null,
      uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      status: 'open',
    };

    const docRef = await db.collection('deals').add(dealData);

    res.json({
      id: docRef.id,
      ok: true,
    });
  } catch (err) {
    console.error('[deals POST] Failed to create deal:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Failed to create deal' });
  }
});

// GET / - Retrieve deals for authenticated user (allows trial)
router.get('/', async (req: Request, res: Response) => {
  const uid = req.uid;

  // Validate authentication
  if (!uid) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const snapshot = await db.collection('deals').where('uid', '==', uid).get();

    const deals = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.json(deals);
  } catch (err) {
    console.error('[deals GET] Failed to fetch deals:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Failed to fetch deals' });
  }
});

export default router;
