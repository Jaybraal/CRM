import express from 'express';
import * as admin from 'firebase-admin';
import webhookRouter from './routes/webhook';
import { initWhatsApp } from './services/whatsapp';

const app = express();
app.use(express.json());

// Initialize Firebase Admin
admin.initializeApp();

// Routes
app.use('/api/webhook', webhookRouter);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`[CRM] Server corriendo en puerto ${PORT}`);
});

// Initialize WhatsApp on startup
(async () => {
  try {
    await initWhatsApp();
    console.log('[CRM] WhatsApp inicializado');
  } catch (err) {
    console.warn('[CRM] WhatsApp: ', err instanceof Error ? err.message : err);
  }
})();
