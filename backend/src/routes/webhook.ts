import { Router } from 'express';
import * as admin from 'firebase-admin';

const router = Router();

router.post('/whatsapp', async (req, res) => {
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

export default router;
