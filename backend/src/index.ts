import express from 'express';
import * as admin from 'firebase-admin';
import webhookRouter from './routes/webhook';
import checkoutRouter from './routes/checkout';
import leadsRouter from './routes/leads';
import dealsRouter from './routes/deals';
import { initWhatsApp } from './services/whatsapp';

const app = express();

// CRITICAL: Stripe raw body middleware BEFORE JSON parsing
app.use('/api/webhook/stripe', express.raw({ type: 'application/json' }));

// JSON parsing for all other routes
app.use(express.json());

// Initialize Firebase Admin
admin.initializeApp();

// Routes
app.use('/api/webhook', webhookRouter);
app.use('/api/checkout', checkoutRouter);
app.use('/api/leads', leadsRouter);
app.use('/api/deals', dealsRouter);

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
