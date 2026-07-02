import { Router, Request, Response } from 'express';
import * as admin from 'firebase-admin';
import { requireSubscription } from '../middleware/subscription';

const router = Router();
const db = admin.firestore();

// POST / - Create a new lead (requires subscription)
router.post('/', requireSubscription, async (req: Request, res: Response) => {
  const { phone, email, name, source } = req.body;
  const uid = req.uid;

  // Validate required fields
  if (!uid) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  if (!phone && !email) {
    return res.status(400).json({ error: 'phone or email is required' });
  }

  if (!name) {
    return res.status(400).json({ error: 'name is required' });
  }

  try {
    const leadData = {
      phone: phone || null,
      email: email || null,
      name,
      source: source || null,
      uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      status: 'new',
    };

    const docRef = await db.collection('leads').add(leadData);

    res.json({
      id: docRef.id,
      ok: true,
    });
  } catch (err) {
    console.error('[leads POST] Failed to create lead:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Failed to create lead' });
  }
});

// GET / - Retrieve leads for authenticated user (allows trial)
router.get('/', async (req: Request, res: Response) => {
  const uid = req.uid;

  // Validate authentication
  if (!uid) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const snapshot = await db.collection('leads').where('uid', '==', uid).get();

    const leads = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.json(leads);
  } catch (err) {
    console.error('[leads GET] Failed to fetch leads:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
});

export default router;
