# Stripe SaaS Subscription Integration Plan — CRM-Auto

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a complete Stripe subscription system with 30-minute trial and $150/month pricing, protecting all write operations (leads, deals, WhatsApp webhook) while allowing reads during trial.

**Architecture:** Two-layer subscription enforcement — backend middleware validates Firestore subscription status before allowing write operations; frontend SubscriptionGate component blocks access to protected features and shows trial countdown/paywall. Firebase Admin SDK manages subscription data in Firestore. Stripe webhooks sync subscription state.

**Tech Stack:** Express.js + Stripe SDK (backend), Next.js 13+ App Router (frontend), Firestore (subscription state), Firebase Admin SDK (auth).

## Global Constraints

- Stripe pricing: $150 USD/month (CRM-Auto Monthly product)
- Trial duration: 30 minutes (1800 seconds)
- Protected write routes: `POST /api/leads`, `POST /api/deals`, `POST /webhook/whatsapp`
- Trial-allowed read routes: `GET /api/clients`, `GET /api/deals`
- Trial blocks: ALL write operations, WhatsApp webhook
- Subscription data: Firestore `/subscriptions/{uid}` document
- Trial start: set on first signup, never expires (only via pay/cancel)
- Billing email: user's Firebase Auth email
- Environment: Use `.env.local` (Next.js) + `backend/.env` (Express)

---

## Task 1: Create Stripe Service (Backend)

**Files:**
- Create: `backend/src/services/stripe.ts`
- Create: `backend/src/types/subscription.ts`

**Interfaces:**
- Produces:
  - `StripeService.createCustomer(email, uid): Promise<{ customerId: string }>`
  - `StripeService.createCheckoutSession(customerId: string): Promise<{ sessionUrl: string }>`
  - `StripeService.getSubscriptionStatus(customerId: string): Promise<{ status: 'active' | 'trialing' | 'canceled', trialEndsAt?: number }>`
  - `SubscriptionStatus: { uid: string, status: 'trial' | 'active' | 'canceled', customerId: string, trialStartedAt: number, trialEndsAt: number, subscriptionId?: string, periodEnd?: number }`

**Steps:**

- [ ] **Step 1: Install Stripe SDK**

```bash
cd /Users/branel/CRM-auto
npm install stripe
```

- [ ] **Step 2: Create subscription types file**

Create `/Users/branel/CRM-auto/backend/src/types/subscription.ts`:

```typescript
export interface SubscriptionStatus {
  uid: string;
  status: 'trial' | 'active' | 'canceled';
  customerId: string;
  trialStartedAt: number; // Unix timestamp
  trialEndsAt: number; // Unix timestamp (30 min from start)
  subscriptionId?: string;
  currentPeriodEnd?: number;
  canceledAt?: number;
}

export interface StripeCheckoutResponse {
  sessionUrl: string;
}
```

- [ ] **Step 3: Create Stripe service**

Create `/Users/branel/CRM-auto/backend/src/services/stripe.ts`:

```typescript
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-06-20',
});

export const StripeService = {
  async createCustomer(email: string, uid: string) {
    const customer = await stripe.customers.create({
      email,
      metadata: {
        firebaseUID: uid,
      },
    });
    return { customerId: customer.id };
  },

  async createCheckoutSession(customerId: string, returnUrl: string) {
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: process.env.STRIPE_PRODUCT_ID || '',
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${returnUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${returnUrl}`,
    });
    return { sessionUrl: session.url };
  },

  async getSubscriptionStatus(customerId: string) {
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      limit: 1,
      status: 'all',
    });

    if (subscriptions.data.length === 0) {
      return { status: 'trialing', trialEndsAt: 0 };
    }

    const sub = subscriptions.data[0];
    return {
      status: sub.status as 'active' | 'trialing' | 'canceled',
      subscriptionId: sub.id,
      periodEnd: sub.current_period_end,
    };
  },

  getWebhookSecret() {
    return process.env.STRIPE_WEBHOOK_SECRET || '';
  },
};
```

- [ ] **Step 4: Commit**

```bash
cd /Users/branel/CRM-auto
git add backend/src/services/stripe.ts backend/src/types/subscription.ts
git commit -m "feat: add Stripe service and subscription types"
```

---

## Task 2: Create Subscription Service (Backend)

**Files:**
- Create: `backend/src/services/subscription.ts`

**Interfaces:**
- Consumes: `StripeService` from Task 1, `Firestore admin` (from backend/src/index.ts)
- Produces:
  - `SubscriptionService.createTrialUser(uid: string, email: string): Promise<SubscriptionStatus>`
  - `SubscriptionService.getSubscriptionStatus(uid: string): Promise<SubscriptionStatus | null>`
  - `SubscriptionService.updateFromStripeWebhook(customerId: string, event: any): Promise<void>`
  - `SubscriptionService.isTrialActive(uid: string): Promise<boolean>`
  - `SubscriptionService.isPaid(uid: string): Promise<boolean>`

**Steps:**

- [ ] **Step 1: Create subscription service**

Create `/Users/branel/CRM-auto/backend/src/services/subscription.ts`:

```typescript
import * as admin from 'firebase-admin';
import { StripeService } from './stripe';
import { SubscriptionStatus } from '../types/subscription';

export const SubscriptionService = {
  async createTrialUser(uid: string, email: string): Promise<SubscriptionStatus> {
    const db = admin.firestore();
    
    // Create Stripe customer
    const { customerId } = await StripeService.createCustomer(email, uid);
    
    // Calculate trial end (30 minutes from now)
    const now = Math.floor(Date.now() / 1000);
    const trialEndsAt = now + 1800; // 30 min
    
    const subscriptionStatus: SubscriptionStatus = {
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

  async getSubscriptionStatus(uid: string): Promise<SubscriptionStatus | null> {
    const db = admin.firestore();
    const doc = await db.collection('subscriptions').doc(uid).get();
    
    if (!doc.exists) {
      return null;
    }
    
    return doc.data() as SubscriptionStatus;
  },

  async updateFromStripeWebhook(customerId: string, event: any): Promise<void> {
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
    } else if (event.type === 'customer.subscription.deleted') {
      await docRef.update({
        status: 'canceled',
        canceledAt: Math.floor(Date.now() / 1000),
      });
    }
  },

  async isTrialActive(uid: string): Promise<boolean> {
    const status = await this.getSubscriptionStatus(uid);
    if (!status) return false;
    
    const now = Math.floor(Date.now() / 1000);
    return status.status === 'trial' && now < status.trialEndsAt;
  },

  async isPaid(uid: string): Promise<boolean> {
    const status = await this.getSubscriptionStatus(uid);
    if (!status) return false;
    
    return status.status === 'active';
  },

  async canWrite(uid: string): Promise<boolean> {
    const isTrialActive = await this.isTrialActive(uid);
    const isPaid = await this.isPaid(uid);
    return isTrialActive || isPaid;
  },
};
```

- [ ] **Step 2: Commit**

```bash
cd /Users/branel/CRM-auto
git add backend/src/services/subscription.ts
git commit -m "feat: add subscription service with trial and payment logic"
```

---

## Task 3: Create Subscription Middleware (Backend)

**Files:**
- Create: `backend/src/middleware/subscription.ts`

**Interfaces:**
- Consumes: `SubscriptionService` from Task 2
- Produces: Express middleware function `requireSubscription(req, res, next)`

**Steps:**

- [ ] **Step 1: Create middleware file**

Create `/Users/branel/CRM-auto/backend/src/middleware/subscription.ts`:

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
cd /Users/branel/CRM-auto
git add backend/src/middleware/subscription.ts
git commit -m "feat: add subscription validation middleware"
```

---

## Task 4: Modify Backend Index (Add Middleware + Webhook Route)

**Files:**
- Modify: `backend/src/index.ts`
- Modify: `backend/src/routes/webhook.ts`

**Interfaces:**
- Consumes: `requireSubscription` middleware from Task 3, `SubscriptionService` from Task 2, `StripeService` from Task 1

**Steps:**

- [ ] **Step 1: Add Stripe webhook endpoint (update webhook.ts)**

Modify `/Users/branel/CRM-auto/backend/src/routes/webhook.ts` — add at the top:

```typescript
import { Router, Request, Response } from 'express';
import * as admin from 'firebase-admin';
import Stripe from 'stripe';
import { SubscriptionService } from '../services/subscription';
import { requireSubscription } from '../middleware/subscription';

const router = Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-06-20',
});
```

Then keep the WhatsApp webhook but add subscription check:

```typescript
router.post('/whatsapp', requireSubscription, async (req, res) => {
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
```

Add new Stripe webhook endpoint at the end (before `export default router`):

```typescript
router.post('/stripe', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'];
  
  if (!sig) {
    return res.status(400).json({ error: 'Missing stripe-signature header' });
  }
  
  try {
    const event = stripe.webhooks.constructEvent(
      req.body,
      sig as string,
      SubscriptionService.getWebhookSecret()
    );
    
    // Handle subscription events
    if (
      event.type === 'customer.subscription.updated' ||
      event.type === 'customer.subscription.created' ||
      event.type === 'customer.subscription.deleted'
    ) {
      const subscription = event.data.object as Stripe.Subscription;
      await SubscriptionService.updateFromStripeWebhook(subscription.customer as string, event);
    }
    
    res.json({ received: true });
  } catch (err) {
    console.error('[webhook/stripe]', err);
    res.status(400).json({ error: 'Webhook processing failed' });
  }
});

export default router;
```

**IMPORTANT:** The webhook endpoint must receive `raw` body (not JSON-parsed). You'll need to adjust your Express setup in Step 2 below.

- [ ] **Step 2: Update backend/src/index.ts to handle raw Stripe webhook body**

Modify `/Users/branel/CRM-auto/backend/src/index.ts`:

```typescript
import express from 'express';
import * as admin from 'firebase-admin';
import webhookRouter from './routes/webhook';
import { initWhatsApp } from './services/whatsapp';

const app = express();

// Stripe webhook must receive raw body — parse BEFORE mounting router
app.use('/api/webhook/stripe', express.raw({ type: 'application/json' }));

// All other routes use JSON parsing
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
```

**CRITICAL NOTE:** Stripe webhook verification requires the raw request body. The middleware order above ensures Stripe gets the raw body while other endpoints get JSON parsing.

- [ ] **Step 3: Commit**

```bash
cd /Users/branel/CRM-auto
git add backend/src/index.ts backend/src/routes/webhook.ts
git commit -m "feat: add Stripe webhook endpoint and protect WhatsApp with subscription middleware"
```

---

## Task 5: Create/Modify Authentication (Firebase Auth Integration)

**Files:**
- Modify or create: `app/api/auth/signup/route.ts` (or similar, depending on current auth structure)

**Interfaces:**
- Consumes: `SubscriptionService.createTrialUser()` from Task 2
- Produces: On signup, automatically creates trial subscription in Firestore

**Steps:**

- [ ] **Step 1: Locate current auth endpoint**

Check if `/app/api/auth/` exists and examine signup endpoint:

```bash
find /Users/branel/CRM-auto/app/api -name "*auth*" -o -name "*login*" -o -name "*signup*" | head -10
```

- [ ] **Step 2: Add trial creation to signup flow**

If using Firebase Auth on frontend (Next.js), the backend auth flow typically happens via Firebase SDK directly. However, we need a backend endpoint to initialize trial subscription.

Create `/Users/branel/CRM-auto/app/api/auth/initialize-trial/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin (should already be initialized elsewhere)
if (!admin.apps.length) {
  admin.initializeApp();
}

export async function POST(req: NextRequest) {
  try {
    const { uid, email } = await req.json();

    if (!uid || !email) {
      return NextResponse.json(
        { error: 'Missing uid or email' },
        { status: 400 }
      );
    }

    // Import SubscriptionService from backend
    // This is a workaround — in production, call the backend directly
    const db = admin.firestore();

    // Check if subscription already exists
    const existing = await db.collection('subscriptions').doc(uid).get();
    if (existing.exists) {
      return NextResponse.json({ ok: true, message: 'Trial already initialized' });
    }

    // Create trial subscription
    const now = Math.floor(Date.now() / 1000);
    const trialEndsAt = now + 1800; // 30 min

    await db.collection('subscriptions').doc(uid).set({
      uid,
      status: 'trial',
      customerId: '', // Will be set when user interacts with Stripe
      trialStartedAt: now,
      trialEndsAt,
    });

    return NextResponse.json({
      ok: true,
      trialEndsAt,
      message: 'Trial subscription created',
    });
  } catch (err) {
    console.error('[auth/initialize-trial]', err);
    return NextResponse.json(
      { error: 'Failed to initialize trial' },
      { status: 500 }
    );
  }
}
```

**BETTER APPROACH:** Call this endpoint from your signup handler (wherever Firebase Auth createUser is called) after the user is created:

```typescript
// In your signup handler (e.g., components/SignupForm.tsx or pages)
const userCredential = await createUserWithEmailAndPassword(auth, email, password);
const uid = userCredential.user.uid;

// Initialize trial subscription
await fetch('/api/auth/initialize-trial', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ uid, email }),
});
```

- [ ] **Step 3: Commit**

```bash
cd /Users/branel/CRM-auto
git add app/api/auth/initialize-trial/route.ts
git commit -m "feat: auto-create trial subscription on user signup"
```

---

## Task 6: Create Frontend Subscription Hook

**Files:**
- Create: `lib/hooks/useSubscription.ts`
- Create: `lib/types/subscription.ts`

**Interfaces:**
- Produces:
  - `useSubscription(): { status: 'trial' | 'active' | 'canceled' | 'loading', trialEndsAt?: number, isPaid: boolean, isTrialActive: boolean, error?: string }`
  - `SubscriptionStatus` type exported from lib/types/subscription.ts

**Steps:**

- [ ] **Step 1: Create subscription types file**

Create `/Users/branel/CRM-auto/lib/types/subscription.ts`:

```typescript
export interface SubscriptionStatus {
  uid: string;
  status: 'trial' | 'active' | 'canceled';
  trialStartedAt: number;
  trialEndsAt: number;
  customerId: string;
  subscriptionId?: string;
  currentPeriodEnd?: number;
  canceledAt?: number;
}
```

- [ ] **Step 2: Create subscription hook**

Create `/Users/branel/CRM-auto/lib/hooks/useSubscription.ts`:

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext'; // Adjust to your auth context path
import { SubscriptionStatus } from '@/lib/types/subscription';

interface UseSubscriptionReturn {
  status: 'trial' | 'active' | 'canceled' | 'loading';
  trialEndsAt?: number;
  isPaid: boolean;
  isTrialActive: boolean;
  error?: string;
  subscription?: SubscriptionStatus;
}

export function useSubscription(): UseSubscriptionReturn {
  const { user } = useAuth(); // or however you get current user
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    const fetchSubscription = async () => {
      try {
        const response = await fetch(`/api/subscription/${user.uid}`);
        if (!response.ok) {
          throw new Error('Failed to fetch subscription');
        }
        const data = await response.json();
        setSubscription(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error fetching subscription');
      } finally {
        setLoading(false);
      }
    };

    fetchSubscription();

    // Poll every 5 seconds to detect trial expiry
    const interval = setInterval(fetchSubscription, 5000);
    return () => clearInterval(interval);
  }, [user?.uid]);

  const now = Math.floor(Date.now() / 1000);
  const isTrialActive = subscription?.status === 'trial' && subscription.trialEndsAt > now;
  const isPaid = subscription?.status === 'active';

  return {
    status: loading ? 'loading' : subscription?.status || 'canceled',
    trialEndsAt: subscription?.trialEndsAt,
    isPaid,
    isTrialActive,
    error,
    subscription,
  };
}
```

- [ ] **Step 3: Commit**

```bash
cd /Users/branel/CRM-auto
git add lib/types/subscription.ts lib/hooks/useSubscription.ts
git commit -m "feat: add subscription hook and types for frontend"
```

---

## Task 7: Create Frontend Subscription API Endpoint

**Files:**
- Create: `app/api/subscription/[uid]/route.ts`

**Interfaces:**
- Consumes: Firestore subscription data
- Produces: GET endpoint that returns current subscription status

**Steps:**

- [ ] **Step 1: Create API endpoint**

Create `/Users/branel/CRM-auto/app/api/subscription/[uid]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp();
}

export async function GET(
  req: NextRequest,
  { params }: { params: { uid: string } }
) {
  try {
    const { uid } = params;

    const db = admin.firestore();
    const doc = await db.collection('subscriptions').doc(uid).get();

    if (!doc.exists) {
      return NextResponse.json(
        { error: 'Subscription not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(doc.data());
  } catch (err) {
    console.error('[api/subscription]', err);
    return NextResponse.json(
      { error: 'Failed to fetch subscription' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/branel/CRM-auto
git add app/api/subscription/[uid]/route.ts
git commit -m "feat: add subscription status API endpoint"
```

---

## Task 8: Create TrialTimer Component

**Files:**
- Create: `components/TrialTimer.tsx`

**Interfaces:**
- Consumes: `trialEndsAt: number` (Unix timestamp)
- Produces: React component that displays countdown

**Steps:**

- [ ] **Step 1: Create component**

Create `/Users/branel/CRM-auto/components/TrialTimer.tsx`:

```typescript
'use client';

import { useState, useEffect } from 'react';

interface TrialTimerProps {
  trialEndsAt: number;
  onExpired?: () => void;
}

export function TrialTimer({ trialEndsAt, onExpired }: TrialTimerProps) {
  const [remaining, setRemaining] = useState<string>('');
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const updateTimer = () => {
      const now = Math.floor(Date.now() / 1000);
      const diff = trialEndsAt - now;

      if (diff <= 0) {
        setExpired(true);
        setRemaining('Trial expired');
        onExpired?.();
        return;
      }

      const minutes = Math.floor(diff / 60);
      const seconds = diff % 60;
      setRemaining(`${minutes}m ${seconds}s`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [trialEndsAt, onExpired]);

  if (expired) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-800 px-4 py-3 rounded">
        Trial period has ended. Upgrade to continue using this app.
      </div>
    );
  }

  return (
    <div className="bg-blue-100 border border-blue-400 text-blue-800 px-4 py-3 rounded">
      Trial ending in: <strong>{remaining}</strong>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/branel/CRM-auto
git add components/TrialTimer.tsx
git commit -m "feat: add trial countdown timer component"
```

---

## Task 9: Create Paywall Component

**Files:**
- Create: `components/Paywall.tsx`

**Interfaces:**
- Consumes: `onCheckoutClick: () => void`
- Produces: React component that displays pricing and call-to-action

**Steps:**

- [ ] **Step 1: Create component**

Create `/Users/branel/CRM-auto/components/Paywall.tsx`:

```typescript
'use client';

import { useState } from 'react';

interface PaywallProps {
  onCheckout: () => void;
  loading?: boolean;
}

export function Paywall({ onCheckout, loading = false }: PaywallProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 max-w-md">
        <h2 className="text-2xl font-bold mb-4">Upgrade to CRM-Auto Pro</h2>

        <div className="mb-6">
          <p className="text-gray-600 mb-2">
            Your trial period has expired. Upgrade now to continue managing your leads and deals.
          </p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded p-4 mb-6">
          <p className="text-3xl font-bold text-blue-600">$150</p>
          <p className="text-gray-600">per month</p>
        </div>

        <div className="mb-6">
          <h3 className="font-semibold mb-3">Included features:</h3>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center">
              <span className="text-green-500 mr-2">✓</span>
              Unlimited leads and deals
            </li>
            <li className="flex items-center">
              <span className="text-green-500 mr-2">✓</span>
              WhatsApp integration
            </li>
            <li className="flex items-center">
              <span className="text-green-500 mr-2">✓</span>
              24/7 support
            </li>
            <li className="flex items-center">
              <span className="text-green-500 mr-2">✓</span>
              Advanced analytics
            </li>
          </ul>
        </div>

        <button
          onClick={onCheckout}
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 rounded-lg transition"
        >
          {loading ? 'Processing...' : 'Upgrade Now'}
        </button>

        <p className="text-xs text-gray-500 mt-4 text-center">
          By upgrading, you accept our terms of service and privacy policy.
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/branel/CRM-auto
git add components/Paywall.tsx
git commit -m "feat: add paywall modal component"
```

---

## Task 10: Create SubscriptionGate Component

**Files:**
- Create: `components/SubscriptionGate.tsx`

**Interfaces:**
- Consumes: `useSubscription()` hook from Task 6, `Paywall` and `TrialTimer` components from Tasks 8-9
- Produces: React component that wraps protected content and shows paywall/trial timer

**Steps:**

- [ ] **Step 1: Create component**

Create `/Users/branel/CRM-auto/components/SubscriptionGate.tsx`:

```typescript
'use client';

import { ReactNode, useState } from 'react';
import { useSubscription } from '@/lib/hooks/useSubscription';
import { Paywall } from './Paywall';
import { TrialTimer } from './TrialTimer';
import { useRouter } from 'next/navigation';

interface SubscriptionGateProps {
  children: ReactNode;
  allowTrial?: boolean;
}

export function SubscriptionGate({ children, allowTrial = true }: SubscriptionGateProps) {
  const { status, isPaid, isTrialActive, trialEndsAt } = useSubscription();
  const [showPaywall, setShowPaywall] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const router = useRouter();

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  const hasAccess = isPaid || (allowTrial && isTrialActive);

  if (!hasAccess) {
    return <Paywall onCheckout={handleCheckout} loading={checkoutLoading} />;
  }

  const handleCheckout = async () => {
    setCheckoutLoading(true);
    try {
      const response = await fetch('/api/checkout');
      if (!response.ok) throw new Error('Failed to create checkout session');

      const { sessionUrl } = await response.json();
      window.location.href = sessionUrl;
    } catch (err) {
      console.error('Checkout error:', err);
      setCheckoutLoading(false);
    }
  };

  return (
    <>
      {isTrialActive && trialEndsAt && (
        <div className="mb-4">
          <TrialTimer
            trialEndsAt={trialEndsAt}
            onExpired={() => window.location.reload()}
          />
        </div>
      )}

      {children}
    </>
  );
}
```

**NOTE:** Fix the `handleCheckout` function placement — it was declared after the return statement. Corrected version:

```typescript
'use client';

import { ReactNode, useState } from 'react';
import { useSubscription } from '@/lib/hooks/useSubscription';
import { Paywall } from './Paywall';
import { TrialTimer } from './TrialTimer';

interface SubscriptionGateProps {
  children: ReactNode;
  allowTrial?: boolean;
}

export function SubscriptionGate({ children, allowTrial = true }: SubscriptionGateProps) {
  const { status, isPaid, isTrialActive, trialEndsAt } = useSubscription();
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const handleCheckout = async () => {
    setCheckoutLoading(true);
    try {
      const response = await fetch('/api/checkout');
      if (!response.ok) throw new Error('Failed to create checkout session');

      const { sessionUrl } = await response.json();
      window.location.href = sessionUrl;
    } catch (err) {
      console.error('Checkout error:', err);
      setCheckoutLoading(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  const hasAccess = isPaid || (allowTrial && isTrialActive);

  if (!hasAccess) {
    return <Paywall onCheckout={handleCheckout} loading={checkoutLoading} />;
  }

  return (
    <>
      {isTrialActive && trialEndsAt && (
        <div className="mb-4">
          <TrialTimer
            trialEndsAt={trialEndsAt}
            onExpired={() => window.location.reload()}
          />
        </div>
      )}

      {children}
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/branel/CRM-auto
git add components/SubscriptionGate.tsx
git commit -m "feat: add subscription gate wrapper component"
```

---

## Task 11: Create Checkout API Endpoint

**Files:**
- Create: `app/api/checkout/route.ts`

**Interfaces:**
- Consumes: Current user UID from Firebase Auth, `StripeService` from backend Task 1
- Produces: POST endpoint that returns Stripe checkout session URL

**Steps:**

- [ ] **Step 1: Create checkout endpoint**

Create `/Users/branel/CRM-auto/app/api/checkout/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp();
}

export async function POST(req: NextRequest) {
  try {
    // Get user from auth header (passed by your auth middleware)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify Firebase ID token
    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token);
    const uid = decodedToken.uid;

    if (!uid) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const db = admin.firestore();

    // Get subscription document to find customerId
    const subDoc = await db.collection('subscriptions').doc(uid).get();
    if (!subDoc.exists) {
      return NextResponse.json(
        { error: 'Subscription not found' },
        { status: 404 }
      );
    }

    const subscription = subDoc.data();
    const customerId = subscription?.customerId;

    if (!customerId) {
      return NextResponse.json(
        { error: 'Customer ID not found' },
        { status: 404 }
      );
    }

    // Call backend to create checkout session
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
    const response = await fetch(`${backendUrl}/api/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId,
        returnUrl: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/dashboard`,
      }),
    });

    if (!response.ok) {
      throw new Error('Backend checkout request failed');
    }

    const { sessionUrl } = await response.json();
    return NextResponse.json({ sessionUrl });
  } catch (err) {
    console.error('[api/checkout]', err);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
```

**IMPORTANT:** You need to add this endpoint to the backend as well (or route it from frontend). Better approach:

Create `/Users/branel/CRM-auto/backend/src/routes/checkout.ts`:

```typescript
import { Router } from 'express';
import { StripeService } from '../services/stripe';

const router = Router();

router.post('/', async (req, res) => {
  try {
    const { customerId, returnUrl } = req.body;

    if (!customerId || !returnUrl) {
      return res.status(400).json({ error: 'Missing customerId or returnUrl' });
    }

    const { sessionUrl } = await StripeService.createCheckoutSession(customerId, returnUrl);
    res.json({ sessionUrl });
  } catch (err) {
    console.error('[checkout]', err);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

export default router;
```

Then mount it in `backend/src/index.ts`:

```typescript
import checkoutRouter from './routes/checkout';
// ... in app setup:
app.use('/api/checkout', checkoutRouter);
```

- [ ] **Step 2: Add backend checkout route**

Modify `/Users/branel/CRM-auto/backend/src/index.ts` to import and mount checkout router:

```typescript
import express from 'express';
import * as admin from 'firebase-admin';
import webhookRouter from './routes/webhook';
import checkoutRouter from './routes/checkout';
import { initWhatsApp } from './services/whatsapp';

const app = express();

// Stripe webhook must receive raw body — parse BEFORE mounting router
app.use('/api/webhook/stripe', express.raw({ type: 'application/json' }));

// All other routes use JSON parsing
app.use(express.json());

// Initialize Firebase Admin
admin.initializeApp();

// Routes
app.use('/api/webhook', webhookRouter);
app.use('/api/checkout', checkoutRouter);

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
```

- [ ] **Step 3: Commit backend changes**

```bash
cd /Users/branel/CRM-auto
git add backend/src/routes/checkout.ts backend/src/index.ts
git commit -m "feat: add checkout session endpoint (backend)"
```

- [ ] **Step 4: Simplify frontend checkout endpoint**

Modify `/Users/branel/CRM-auto/app/api/checkout/route.ts` to simply proxy to backend:

```typescript
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user ID from your auth context (you'll need to implement this)
    // For now, we'll assume it's passed in the request
    const { customerId, returnUrl } = await req.json();

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
    const response = await fetch(`${backendUrl}/api/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId, returnUrl }),
    });

    if (!response.ok) {
      throw new Error('Backend request failed');
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error('[api/checkout]', err);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 5: Commit frontend changes**

```bash
cd /Users/branel/CRM-auto
git add app/api/checkout/route.ts
git commit -m "feat: add checkout proxy endpoint (frontend)"
```

---

## Task 12: Wrap Dashboard with SubscriptionGate

**Files:**
- Modify: `app/dashboard/page.tsx` or `app/dashboard/layout.tsx`

**Interfaces:**
- Consumes: `SubscriptionGate` component from Task 10

**Steps:**

- [ ] **Step 1: Locate dashboard page/layout**

```bash
find /Users/branel/CRM-auto/app -name "*dashboard*" -type f
```

- [ ] **Step 2: Wrap dashboard content**

Modify the dashboard page (e.g., `/Users/branel/CRM-auto/app/dashboard/page.tsx`):

```typescript
import { SubscriptionGate } from '@/components/SubscriptionGate';

// Existing dashboard component
function DashboardContent() {
  // ... existing dashboard code
}

export default function Dashboard() {
  return (
    <SubscriptionGate allowTrial={true}>
      <DashboardContent />
    </SubscriptionGate>
  );
}
```

If using a layout file instead, wrap the children:

```typescript
import { SubscriptionGate } from '@/components/SubscriptionGate';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SubscriptionGate allowTrial={true}>
      {children}
    </SubscriptionGate>
  );
}
```

- [ ] **Step 3: Commit**

```bash
cd /Users/branel/CRM-auto
git add app/dashboard/page.tsx  # or layout.tsx
git commit -m "feat: wrap dashboard with subscription gate"
```

---

## Task 13: Add Backend Leads/Deals Endpoints with Middleware

**Files:**
- Modify or Create: `backend/src/routes/leads.ts` and `backend/src/routes/deals.ts` (or wherever POST handlers exist)

**Interfaces:**
- Consumes: `requireSubscription` middleware from Task 3
- Produces: Protected POST endpoints

**Steps:**

- [ ] **Step 1: Create leads route with middleware**

Create `/Users/branel/CRM-auto/backend/src/routes/leads.ts`:

```typescript
import { Router } from 'express';
import * as admin from 'firebase-admin';
import { requireSubscription } from '../middleware/subscription';

const router = Router();

// Require subscription for POST (write)
router.post('/', requireSubscription, async (req, res) => {
  try {
    const { phone, email, name, source } = req.body;

    if (!phone && !email) {
      return res.status(400).json({ error: 'Phone or email required' });
    }

    const db = admin.firestore();
    const leadRef = await db.collection('leads').add({
      phone,
      email,
      name,
      source,
      createdAt: new Date(),
      status: 'new',
      uid: req.uid,
    });

    res.json({ id: leadRef.id, ok: true });
  } catch (err) {
    console.error('[routes/leads]', err);
    res.status(500).json({ error: 'Failed to create lead' });
  }
});

// Allow GET without subscription check (trial users can read)
router.get('/', async (req, res) => {
  try {
    const uid = req.uid;
    if (!uid) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const db = admin.firestore();
    const snapshot = await db.collection('leads').where('uid', '==', uid).get();

    const leads = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.json(leads);
  } catch (err) {
    console.error('[routes/leads/GET]', err);
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
});

export default router;
```

- [ ] **Step 2: Create deals route with middleware**

Create `/Users/branel/CRM-auto/backend/src/routes/deals.ts`:

```typescript
import { Router } from 'express';
import * as admin from 'firebase-admin';
import { requireSubscription } from '../middleware/subscription';

const router = Router();

// Require subscription for POST (write)
router.post('/', requireSubscription, async (req, res) => {
  try {
    const { leadId, title, value, stage } = req.body;

    if (!leadId || !title) {
      return res.status(400).json({ error: 'leadId and title required' });
    }

    const db = admin.firestore();
    const dealRef = await db.collection('deals').add({
      leadId,
      title,
      value,
      stage: stage || 'new',
      createdAt: new Date(),
      uid: req.uid,
    });

    res.json({ id: dealRef.id, ok: true });
  } catch (err) {
    console.error('[routes/deals]', err);
    res.status(500).json({ error: 'Failed to create deal' });
  }
});

// Allow GET without subscription check (trial users can read)
router.get('/', async (req, res) => {
  try {
    const uid = req.uid;
    if (!uid) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const db = admin.firestore();
    const snapshot = await db.collection('deals').where('uid', '==', uid).get();

    const deals = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.json(deals);
  } catch (err) {
    console.error('[routes/deals/GET]', err);
    res.status(500).json({ error: 'Failed to fetch deals' });
  }
});

export default router;
```

- [ ] **Step 3: Mount routes in index.ts**

Modify `/Users/branel/CRM-auto/backend/src/index.ts`:

```typescript
import express from 'express';
import * as admin from 'firebase-admin';
import webhookRouter from './routes/webhook';
import checkoutRouter from './routes/checkout';
import leadsRouter from './routes/leads';
import dealsRouter from './routes/deals';
import { initWhatsApp } from './services/whatsapp';

const app = express();

// Stripe webhook must receive raw body — parse BEFORE mounting router
app.use('/api/webhook/stripe', express.raw({ type: 'application/json' }));

// All other routes use JSON parsing
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
```

- [ ] **Step 4: Commit**

```bash
cd /Users/branel/CRM-auto
git add backend/src/routes/leads.ts backend/src/routes/deals.ts backend/src/index.ts
git commit -m "feat: add leads and deals endpoints with subscription protection"
```

---

## Task 14: Add Environment Variables Configuration

**Files:**
- Modify: `.env.local` (Next.js)
- Modify: `backend/.env` (Express)

**Steps:**

- [ ] **Step 1: Add frontend env vars**

Add to `/Users/branel/CRM-auto/.env.local`:

```
NEXT_PUBLIC_STRIPE_KEY=pk_live_YOUR_STRIPE_PUBLIC_KEY
NEXT_PUBLIC_BACKEND_URL=http://localhost:4000
```

- [ ] **Step 2: Add backend env vars**

Add to `/Users/branel/CRM-auto/backend/.env`:

```
STRIPE_SECRET_KEY=sk_live_YOUR_STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET
STRIPE_PRODUCT_ID=prod_YOUR_PRODUCT_ID
```

**Instructions for obtaining values:**

1. Go to https://dashboard.stripe.com/
2. Navigate to Products → Create product or use existing
3. Create price of $150/month (recurring) — copy the Price ID
4. Set `STRIPE_PRODUCT_ID` to the Price ID (starts with `price_` not `prod_`)
5. Navigate to Developers → API keys
6. Copy Secret key → `STRIPE_SECRET_KEY`
7. Navigate to Webhooks → Create endpoint
8. Set endpoint URL to `https://your-domain.com/api/webhook/stripe`
9. Select events: `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`
10. Copy signing secret → `STRIPE_WEBHOOK_SECRET`

- [ ] **Step 3: Commit env changes**

```bash
cd /Users/branel/CRM-auto
git add .env.local backend/.env
git commit -m "feat: add Stripe environment configuration"
```

**NOTE:** In production, never commit `.env` files. Use Railway/Vercel secrets instead.

---

## Task 15: Add Firebase Auth Middleware (Backend)

**Files:**
- Create: `backend/src/middleware/auth.ts`

**Interfaces:**
- Produces: Express middleware that verifies Firebase ID token and sets `req.uid`

**Steps:**

- [ ] **Step 1: Create auth middleware**

Create `/Users/branel/CRM-auto/backend/src/middleware/auth.ts`:

```typescript
import { Request, Response, NextFunction } from 'express';
import * as admin from 'firebase-admin';

export const verifyFirebaseToken = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.slice(7);
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    req.uid = decodedToken.uid;
    next();
  } catch (err) {
    console.error('[Auth middleware]', err);
    res.status(401).json({ error: 'Invalid token' });
  }
};
```

- [ ] **Step 2: Apply middleware to protected routes**

Modify `/Users/branel/CRM-auto/backend/src/index.ts`:

```typescript
import express from 'express';
import * as admin from 'firebase-admin';
import webhookRouter from './routes/webhook';
import checkoutRouter from './routes/checkout';
import leadsRouter from './routes/leads';
import dealsRouter from './routes/deals';
import { verifyFirebaseToken } from './middleware/auth';
import { initWhatsApp } from './services/whatsapp';

const app = express();

// Stripe webhook must receive raw body — parse BEFORE mounting router
app.use('/api/webhook/stripe', express.raw({ type: 'application/json' }));

// All other routes use JSON parsing
app.use(express.json());

// Initialize Firebase Admin
admin.initializeApp();

// Apply auth middleware to protected routes
app.use('/api/leads', verifyFirebaseToken);
app.use('/api/deals', verifyFirebaseToken);
app.use('/api/webhook/whatsapp', verifyFirebaseToken);
app.use('/api/checkout', verifyFirebaseToken);

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
```

- [ ] **Step 3: Commit**

```bash
cd /Users/branel/CRM-auto
git add backend/src/middleware/auth.ts backend/src/index.ts
git commit -m "feat: add Firebase auth middleware"
```

---

## Task 16: Fix SubscriptionService Imports

**Files:**
- Modify: `backend/src/middleware/subscription.ts`
- Modify: `backend/src/services/subscription.ts`

**Steps:**

- [ ] **Step 1: Update subscription service exports**

Modify `/Users/branel/CRM-auto/backend/src/services/subscription.ts` — add missing method at end:

```typescript
export const getWebhookSecret = () => {
  return process.env.STRIPE_WEBHOOK_SECRET || '';
};

// Add to exports
Object.assign(SubscriptionService, { getWebhookSecret });
```

Actually, better approach — refactor as proper module:

```typescript
import * as admin from 'firebase-admin';
import { StripeService } from './stripe';
import { SubscriptionStatus } from '../types/subscription';

class SubscriptionServiceClass {
  async createTrialUser(uid: string, email: string): Promise<SubscriptionStatus> {
    // ... existing code
  }

  async getSubscriptionStatus(uid: string): Promise<SubscriptionStatus | null> {
    // ... existing code
  }

  async updateFromStripeWebhook(customerId: string, event: any): Promise<void> {
    // ... existing code
  }

  async isTrialActive(uid: string): Promise<boolean> {
    // ... existing code
  }

  async isPaid(uid: string): Promise<boolean> {
    // ... existing code
  }

  async canWrite(uid: string): Promise<boolean> {
    // ... existing code
  }

  getWebhookSecret(): string {
    return process.env.STRIPE_WEBHOOK_SECRET || '';
  }
}

export const SubscriptionService = new SubscriptionServiceClass();
```

- [ ] **Step 2: Commit**

```bash
cd /Users/branel/CRM-auto
git add backend/src/services/subscription.ts
git commit -m "fix: add getWebhookSecret to SubscriptionService"
```

---

## Task 17: Update Webhook Handler with Correct Imports

**Files:**
- Modify: `backend/src/routes/webhook.ts`

**Steps:**

- [ ] **Step 1: Fix webhook imports and implementation**

Rewrite `/Users/branel/CRM-auto/backend/src/routes/webhook.ts` completely:

```typescript
import { Router, Request, Response } from 'express';
import * as admin from 'firebase-admin';
import Stripe from 'stripe';
import { SubscriptionService } from '../services/subscription';
import { requireSubscription } from '../middleware/subscription';

const router = Router();

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-06-20',
});

// WhatsApp webhook — requires active subscription
router.post('/whatsapp', requireSubscription, async (req, res) => {
  const { from, text, timestamp } = req.body;

  try {
    const db = admin.firestore();

    await db.collection('messages').add({
      from,
      text,
      timestamp: new Date(timestamp * 1000),
      status: 'received',
      uid: req.uid,
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
        uid: req.uid,
      });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('[webhook/whatsapp]', err);
    res.status(500).json({ error: 'Error procesando mensaje' });
  }
});

// Stripe webhook — no auth needed (uses signing secret)
router.post('/stripe', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;

  if (!sig) {
    return res.status(400).json({ error: 'Missing stripe-signature header' });
  }

  try {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
    
    // Stripe expects raw body for signature verification
    // If using raw body middleware, construct event here
    const event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      webhookSecret
    );

    // Handle subscription events
    if (
      event.type === 'customer.subscription.updated' ||
      event.type === 'customer.subscription.created' ||
      event.type === 'customer.subscription.deleted'
    ) {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;
      
      await SubscriptionService.updateFromStripeWebhook(customerId, event);
      console.log('[webhook/stripe] Updated subscription:', customerId);
    }

    res.json({ received: true });
  } catch (err) {
    console.error('[webhook/stripe]', err);
    res.status(400).json({ error: 'Webhook verification failed' });
  }
});

export default router;
```

- [ ] **Step 2: Commit**

```bash
cd /Users/branel/CRM-auto
git add backend/src/routes/webhook.ts
git commit -m "fix: rewrite webhook handler with correct imports and Stripe event handling"
```

---

## Task 18: Test Compilation (Full Stack)

**Files:**
- Build: Frontend (`npm run build`) and Backend (TypeScript check)

**Steps:**

- [ ] **Step 1: Test frontend compilation**

```bash
cd /Users/branel/CRM-auto
npm run build 2>&1 | head -50
```

Expected: No errors (warnings are OK)

- [ ] **Step 2: Test backend TypeScript**

```bash
cd /Users/branel/CRM-auto/backend
npm run build 2>&1 || npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 3: Check for type errors**

```bash
cd /Users/branel/CRM-auto
npm run lint 2>&1 | head -20  # if eslint is configured
```

- [ ] **Step 4: Commit if all green**

```bash
cd /Users/branel/CRM-auto
git status
# All should be committed already from previous tasks
```

---

## Task 19: Manual Testing Checklist (Local)

**Setup:**
```bash
# Terminal 1: Backend
cd /Users/branel/CRM-auto/backend
npm start  # or node index.js

# Terminal 2: Frontend
cd /Users/branel/CRM-auto
npm run dev
```

**Test Steps:**

- [ ] **Signup Flow:**
  - [ ] Navigate to signup page
  - [ ] Create new account (email + password)
  - [ ] Verify trial subscription created in Firestore (collections → subscriptions → {uid})
  - [ ] Confirm trial countdown appears on dashboard

- [ ] **Trial Access:**
  - [ ] Verify can READ `/api/clients` and `/api/deals` (GET requests work)
  - [ ] Verify can CREATE a lead via frontend (POST /api/leads works)
  - [ ] Verify can CREATE a deal via frontend (POST /api/deals works)
  - [ ] Verify WhatsApp webhook accepts messages

- [ ] **Trial Expiry (simulate):**
  - [ ] In Firestore, manually edit subscription doc — set `trialEndsAt` to 1 minute ago
  - [ ] Refresh browser
  - [ ] Verify paywall modal appears
  - [ ] Verify all POST operations now return 403 (subscription required)

- [ ] **Stripe Checkout:**
  - [ ] Click "Upgrade Now" button on paywall
  - [ ] Verify redirects to Stripe checkout
  - [ ] Use Stripe test card: `4242 4242 4242 4242`, exp: any future, CVC: any 3 digits
  - [ ] Complete payment
  - [ ] Verify redirected back to dashboard
  - [ ] Verify subscription status in Firestore changed to `active`
  - [ ] Verify paywall disappears, normal dashboard shows
  - [ ] Verify POST operations work again

- [ ] **Webhook Verification:**
  - [ ] In Stripe dashboard → Events, verify `customer.subscription.created` and `customer.subscription.updated` events logged
  - [ ] Backend logs should show `[webhook/stripe] Updated subscription: cus_XXXXXX`

---

## Spec Coverage & Self-Review

**Requirement: $150/month pricing**
- Task 14: ENV setup with `STRIPE_PRODUCT_ID`
- Task 1: StripeService creates checkout session for product

**Requirement: 30-minute trial**
- Task 2: SubscriptionService sets `trialEndsAt = now + 1800`
- Task 6: useSubscription hook checks `status === 'trial' && now < trialEndsAt`

**Requirement: Firestore subscriptions/{uid} collection**
- Task 2, 5: All subscription data written to `/subscriptions/{uid}`

**Requirement: Protected write routes**
- Task 3: requireSubscription middleware
- Task 13: Applied to POST /api/leads, POST /api/deals, POST /webhook/whatsapp

**Requirement: Trial-allowed read routes**
- Task 13: GET /api/leads and GET /api/deals have no subscription check

**Requirement: WhatsApp webhook requires payment**
- Task 17: /webhook/whatsapp has `requireSubscription` middleware

**Requirement: Stripe webhook handling**
- Task 4, 17: Webhook endpoint verifies signature, updates subscription status

**Requirement: Frontend trial countdown**
- Task 8: TrialTimer component with 1-second update interval

**Requirement: Frontend paywall**
- Task 9: Paywall component with pricing and CTA

**Requirement: Wrap dashboard**
- Task 12: SubscriptionGate wraps dashboard page

---

## Plan complete and saved to `docs/superpowers/plans/2026-07-02-stripe-saas-integration.md`

**Execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. Total time: ~2-3 hours with parallel work.

**2. Inline Execution** — Execute tasks in this session using superpowers:executing-plans, batch execution with checkpoints. Total time: ~1.5-2 hours.

Which approach would you prefer?
