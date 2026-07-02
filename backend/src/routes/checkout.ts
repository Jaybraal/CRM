import { Router, Request, Response } from 'express';
import { StripeService } from '../services/stripe';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  const { customerId, returnUrl } = req.body;

  // Validate required fields
  if (!customerId || !returnUrl) {
    console.warn('[checkout] Missing required fields:', { hasCustomerId: !!customerId, hasReturnUrl: !!returnUrl });
    return res.status(400).json({ error: 'customerId and returnUrl are required' });
  }

  try {
    const result = await StripeService.createCheckoutSession(customerId, returnUrl);
    res.json(result);
  } catch (err) {
    console.error('[checkout] Failed to create checkout session:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

export default router;
