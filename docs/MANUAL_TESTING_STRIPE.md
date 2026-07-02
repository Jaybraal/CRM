# Task 19: Manual Testing Documentation — Stripe SaaS Integration

**Date:** 2026-07-02  
**Project:** CRM-Auto  
**Component:** Stripe Subscription Billing + Trial System  
**Status:** Ready for Manual Testing  

---

## 1. Setup Instructions

### Backend Setup

```bash
# Terminal 1: Backend (Node.js/Express)
cd /Users/branel/CRM-auto/backend
npm install  # If dependencies not installed
npm start    # Starts on port 4000
```

**Expected Output:**
```
Server running on port 4000
Firebase initialized
Stripe connected (test mode)
Webhook listener on /stripe/webhook
```

### Frontend Setup

```bash
# Terminal 2: Frontend (Next.js/Vite)
cd /Users/branel/CRM-auto
npm install  # If dependencies not installed
npm run dev  # Starts on port 3000
```

**Expected Output:**
```
VITE v5.x.x  ready in XXX ms

➜  Local:   http://localhost:3000/
```

### Access Points

| Component | URL | Port |
|-----------|-----|------|
| Frontend | http://localhost:3000 | 3000 |
| Backend | http://localhost:4000 | 4000 |
| Firebase Emulator (if running) | http://localhost:4001 | 4001 |

---

## 2. Pre-Testing Checklist

### Environment Variables

**File: `/Users/branel/CRM-auto/.env.local`**

- [ ] `NEXT_PUBLIC_FIREBASE_API_KEY` — Firebase API key
- [ ] `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` — Firebase auth domain
- [ ] `NEXT_PUBLIC_FIREBASE_PROJECT_ID` — Firebase project ID
- [ ] `NEXT_PUBLIC_STRIPE_PUBLIC_KEY` — Stripe publishable key (test mode)
- [ ] `NEXT_PUBLIC_GROQ_API_KEY` — Groq API key (if IA chat enabled)
- [ ] `NEXT_PUBLIC_BACKEND_URL` — Should be `http://localhost:4000` (development)

**File: `/Users/branel/CRM-auto/backend/.env`**

- [ ] `STRIPE_SECRET_KEY` — Stripe secret key (test mode)
- [ ] `STRIPE_WEBHOOK_SECRET` — Webhook endpoint secret from Stripe Dashboard
- [ ] `FIREBASE_ADMIN_SDK_KEY` — Firebase Admin SDK JSON key (base64 encoded or path)
- [ ] `GROQ_API_KEY` — Groq API key (if webhook processing uses AI)
- [ ] `PORT` — Should be `4000`
- [ ] `NODE_ENV` — Should be `development`

### Stripe Configuration

- [ ] Stripe Account created (https://dashboard.stripe.com)
- [ ] Test API Keys obtained (found in Dashboard → Developers → API Keys)
- [ ] Webhook endpoint created in Stripe Dashboard:
  - URL: `http://localhost:4000/stripe/webhook` (for local testing)
  - Events subscribed: `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`
  - Webhook signing secret copied to `STRIPE_WEBHOOK_SECRET`

### Firebase Configuration

- [ ] Firebase project created (https://console.firebase.google.com)
- [ ] Firestore database initialized (Database → Create Database → Test Mode)
- [ ] Collection `subscriptions` created with sample docs (optional, auto-created by app)
- [ ] Collection `customers` created (optional, auto-created)
- [ ] Firebase Authentication enabled (Email/Password)
- [ ] Firestore Security Rules applied (see `firestore.rules`)

### Test Stripe Cards

For payment testing, use Stripe's test card numbers:

| Card Number | Expiry | CVC | Result |
|-------------|--------|-----|--------|
| 4242 4242 4242 4242 | Any future date (e.g., 12/26) | Any 3 digits (e.g., 123) | Success |
| 4000 0000 0000 9995 | Any future date | Any 3 digits | Card Declined |
| 4000 0000 0000 0002 | Any future date | Any 3 digits | Fraud Declines |

---

## 3. Test Cases

### Test Case 1: Signup Flow (Trial Activation)

**Objective:** Verify that new users receive a 14-day trial period immediately upon signup.

**Prerequisites:**
- Frontend and backend running
- Firebase Authentication enabled
- Firestore `subscriptions` collection accessible

**Steps:**

1. Navigate to http://localhost:3000
2. Click "Sign Up" button
3. Enter email: `test.user.trial@example.com`
4. Enter password: `TestPassword123!`
5. Confirm password: `TestPassword123!`
6. Click "Create Account"
7. Verify email (if prompt appears)
8. Login with the same credentials

**Expected Behavior:**
- Account created successfully
- Redirected to dashboard
- "Trial Active" badge visible (if displayed on UI)
- Countdown showing ~14 days remaining (or exact date of expiry)
- User can access trial features without payment

**Data Verification in Firestore:**
1. Open Firebase Console → Firestore
2. Navigate to collection `subscriptions`
3. Locate document with `uid` matching logged-in user
4. Verify fields:
   - `status: "trialing"` (or similar)
   - `trial_start` — timestamp of today
   - `trial_end` — timestamp approximately 14 days from now
   - `current_period_end` — same as `trial_end`

**Pass Criteria:**
- [ ] Account created
- [ ] Trial status appears in UI
- [ ] Firestore shows correct trial dates
- [ ] No errors in browser console

**Notes:**
```
_________________________________________________________________
```

---

### Test Case 2: Trial Feature Access (GET/POST)

**Objective:** Verify that trial users can read and write data during trial period.

**Prerequisites:**
- User created and logged in from Test Case 1
- Trial is active (not expired)

**Steps:**

1. On dashboard, verify you can:
   - View customers list (GET /api/customers)
   - Create a new contact (POST /api/customers)
   - Add a note to a customer
   - Send a WhatsApp message via chatbot (if applicable)

2. Perform a GET request (via dashboard UI or browser console):
   ```javascript
   fetch('http://localhost:4000/api/customers', {
     headers: { 'Authorization': `Bearer ${authToken}` }
   })
   .then(r => r.json())
   .then(console.log)
   ```

3. Perform a POST request to create a customer:
   ```javascript
   fetch('http://localhost:4000/api/customers', {
     method: 'POST',
     headers: { 
       'Authorization': `Bearer ${authToken}`,
       'Content-Type': 'application/json'
     },
     body: JSON.stringify({
       name: 'Test Customer',
       email: 'customer@example.com'
     })
   })
   .then(r => r.json())
   .then(console.log)
   ```

**Expected Behavior:**
- GET returns 200 and customer data
- POST returns 201 and created customer object
- No "subscription expired" errors
- WhatsApp sending works (if N8N webhook connected)

**Pass Criteria:**
- [ ] GET /api/customers returns 200
- [ ] POST /api/customers returns 201
- [ ] No 402 (payment required) errors
- [ ] Data persists in Firestore

**Notes:**
```
_________________________________________________________________
```

---

### Test Case 3: Trial Expiry & Paywall

**Objective:** Verify that expired trial users are blocked from API calls and shown paywall.

**Prerequisites:**
- User with trial that has expired (or simulate expiry)
- Firestore modification access

**Steps (Manual Expiry Simulation):**

1. In Firebase Console:
   - Firestore → subscriptions → locate test user's doc
   - Edit `trial_end` to a past date (e.g., yesterday)
   - Edit `current_period_end` to past date
   - Save changes

2. Refresh frontend (http://localhost:3000)
3. Verify UI shows:
   - "Trial Expired" message or badge
   - "Upgrade to Pro" button
   - Countdown timer shows "0 days" or "Expired"

4. Attempt to create a customer via API:
   ```javascript
   fetch('http://localhost:4000/api/customers', {
     method: 'POST',
     headers: { 
       'Authorization': `Bearer ${authToken}`,
       'Content-Type': 'application/json'
     },
     body: JSON.stringify({ name: 'Should Fail' })
   })
   .then(r => {
     console.log('Status:', r.status);
     return r.json();
   })
   .then(console.log)
   ```

5. Attempt to send WhatsApp message (if applicable):
   - Message box should be disabled or show "Upgrade to Pro" prompt

**Expected Behavior:**
- Paywall UI appears
- GET requests still return 200 (read-only allowed, if configured)
- POST requests return 402 (Payment Required)
- Response body includes message: `"Payment required. Please upgrade your subscription."`
- WhatsApp sending returns error: `"Subscription required"`

**Backend Console Check:**
- Terminal running backend should show:
  ```
  [402] POST /api/customers - Trial expired for user {uid}
  ```

**Pass Criteria:**
- [ ] Paywall message displayed
- [ ] POST returns 402
- [ ] GET still works (if applicable) or returns 402
- [ ] WhatsApp blocked or returns error
- [ ] No uncaught exceptions in logs

**Notes:**
```
_________________________________________________________________
```

---

### Test Case 4: Stripe Checkout & Payment

**Objective:** Verify complete checkout flow and subscription activation.

**Prerequisites:**
- Trial-expired user from Test Case 3
- Paywall visible on frontend
- Stripe test mode active

**Steps:**

1. Click "Upgrade to Pro" button on paywall
2. Verify Stripe Checkout appears (hosted or embedded)
3. Select a pricing plan (if multiple options available):
   - Expected: Pro ($9.99/month or equivalent)
4. Enter test card information:
   - Card: `4242 4242 4242 4242`
   - Expiry: `12/26`
   - CVC: `123`
   - Name: `Test User`
   - Email: Should pre-fill
5. Click "Subscribe" or "Pay Now"

**Expected Behavior:**
- Payment succeeds (mock)
- Redirected to success page or dashboard
- "Subscription Active" badge appears
- Countdown shows renewal date (e.g., "30 days until renewal")
- User regains access to POST endpoints

**Data Verification in Firestore:**
1. Open Firebase Console → Firestore
2. Navigate to collection `subscriptions` → user's document
3. Verify fields updated:
   - `status: "active"` (or "paid")
   - `stripe_customer_id` — populated (e.g., `cus_ABC123...`)
   - `stripe_subscription_id` — populated (e.g., `sub_XYZ789...`)
   - `current_period_end` — ~30 days from now
   - `plan_id` — shows which plan selected (if applicable)

**Verify in Stripe Dashboard:**
1. Navigate to https://dashboard.stripe.com (test mode)
2. Go to Customers → locate customer by email
3. Verify:
   - Subscription listed
   - Status: "Active"
   - Amount: correct for selected plan
   - Next billing date: ~30 days from now

**Pass Criteria:**
- [ ] Checkout loads successfully
- [ ] Payment processes (4242 test card)
- [ ] Redirected to success
- [ ] Firestore shows active subscription
- [ ] Stripe Dashboard shows active subscription
- [ ] User can POST again to API

**Notes:**
```
_________________________________________________________________
```

---

### Test Case 5: Payment Failure Handling

**Objective:** Verify correct behavior when payment fails.

**Prerequisites:**
- Trial-expired user
- Paywall visible

**Steps:**

1. Click "Upgrade to Pro"
2. Enter declined test card:
   - Card: `4000 0000 0000 9995`
   - Expiry: `12/26`
   - CVC: `123`
3. Click "Subscribe"

**Expected Behavior:**
- Payment fails
- Error message displayed: `"Your card was declined."`
- User remains on checkout form (not redirected)
- Firestore subscription remains `"trialing"` or unchanged
- User still blocked from API (402 error)

**Backend Console Check:**
```
[402] Stripe payment_intent.payment_failed event received
Payment failed for customer cus_ABC123
```

**Pass Criteria:**
- [ ] Decline error displayed to user
- [ ] Subscription not activated
- [ ] User still blocked from POST
- [ ] No duplicate charge attempts

**Notes:**
```
_________________________________________________________________
```

---

### Test Case 6: Webhook Verification (Stripe Events)

**Objective:** Verify Stripe webhooks are received and processed by backend.

**Prerequisites:**
- Backend running
- Webhook endpoint configured in Stripe
- Webhook signing secret in backend `.env`

**Steps:**

1. Make a test payment (from Test Case 4)
2. Open backend Terminal and watch logs
3. Check for webhook events:
   - Watch for: `[WEBHOOK] Received event: customer.subscription.created`
   - Watch for: `[WEBHOOK] Received event: invoice.payment_succeeded`
4. Verify Stripe Dashboard:
   - Go to Developers → Webhooks
   - Click on your endpoint
   - Scroll to "Events" section
   - Verify recent events show:
     - `customer.subscription.created` — Status: `delivered` (green checkmark)
     - `invoice.payment_succeeded` — Status: `delivered`

5. Test webhook signature validation:
   - Backend should **reject** webhooks with invalid signatures
   - Try to manually POST to webhook with wrong secret:
     ```bash
     curl -X POST http://localhost:4000/stripe/webhook \
       -H "Stripe-Signature: invalid_signature" \
       -H "Content-Type: application/json" \
       -d '{"type":"payment_intent.succeeded"}'
     ```
   - Expected: `401 Unauthorized` or `400 Bad Request`

**Backend Logs to Verify:**
```
[WEBHOOK] Received event: customer.subscription.created
[WEBHOOK] Processing subscription creation for cus_ABC123
[WEBHOOK] Subscription saved to Firestore
```

**Pass Criteria:**
- [ ] Webhooks received and logged
- [ ] Events show "delivered" in Stripe Dashboard
- [ ] Invalid signatures rejected
- [ ] Firestore updated by webhook
- [ ] No errors in backend logs

**Notes:**
```
_________________________________________________________________
```

---

### Test Case 7: WhatsApp Webhook & Payment Gate

**Objective:** Verify WhatsApp messaging requires active subscription.

**Prerequisites:**
- Baileys server running (if using WhatsApp integration)
- N8N workflow connected to backend
- Two test users: one with active subscription, one with expired trial

**Steps (Trial-Expired User):**

1. As trial-expired user, try to send WhatsApp message via chatbot
2. Expected result: Button disabled or error message
   - Error: `"Subscription required to send messages"`
3. Check backend logs for 402 error

**Steps (Paid Subscriber):**

1. As active subscriber, try to send WhatsApp message
2. Expected result: Message sends successfully
3. Verify in N8N:
   - Go to http://localhost:5678 (or N8N server)
   - Navigate to Workflows → Chat Webhook
   - Check "Executions" tab
   - Verify webhook execution succeeded

4. Verify message delivery (if connected to real WhatsApp):
   - Message appears in WhatsApp conversation

**Pass Criteria:**
- [ ] Trial-expired user blocked (402 error)
- [ ] Paid subscriber can send
- [ ] N8N workflow executes
- [ ] Backend logs show subscription check

**Notes:**
```
_________________________________________________________________
```

---

### Test Case 8: Subscription Cancellation

**Objective:** Verify cancellation flow and access revocation.

**Prerequisites:**
- User with active paid subscription (from Test Case 4)
- Settings/Account page accessible

**Steps:**

1. Navigate to Settings → Billing or Account
2. Click "Manage Subscription" or "Cancel Subscription"
3. Confirm cancellation (usually requires additional confirmation)

**Expected Behavior:**
- Cancellation request sent to Stripe
- Firestore updates:
  - `status: "canceled"` or `"canceling"`
  - `canceled_at`: timestamp of cancellation
  - Access continues until current period end (if prorated)
4. User can still access features until `current_period_end` date
5. After `current_period_end`, user sees paywall again

**Verify in Stripe Dashboard:**
- Subscription status changes to "Canceled"

**Pass Criteria:**
- [ ] Cancellation processed
- [ ] Firestore updated
- [ ] Stripe shows canceled subscription
- [ ] Access persists until period end
- [ ] Paywall reappears after period end

**Notes:**
```
_________________________________________________________________
```

---

### Test Case 9: Subscription Renewal

**Objective:** Verify automatic renewal on billing date.

**Prerequisite:**
- This is an **automatic** test (no manual action required)
- Created a 7-day test subscription (using Stripe test mode)

**Steps (Simulated):**

1. Create a subscription with 7-day trial
2. Wait until 1 day before renewal
3. Check Firestore:
   - `current_period_end` should be tomorrow
4. On renewal day:
   - Stripe automatically charges customer
   - Webhook `invoice.payment_succeeded` fires
   - Backend updates Firestore:
     - `current_period_end` advances by 30 days
     - `status: "active"` (if not already)

**Verify:**
- Stripe Dashboard shows new invoice created
- Firestore shows updated `current_period_end`

**Pass Criteria:**
- [ ] Invoice created on renewal date
- [ ] Firestore updated with new period end
- [ ] User sees updated renewal date in UI

**Notes:**
```
_________________________________________________________________
```

---

## 4. Test Results Template

Use this template for each test case. Record results after running each test.

### Template

```markdown
### Test Case [#]: [Name]

**Status:** [ ] PASS | [ ] FAIL | [ ] BLOCKED

**Date Executed:** ___________  
**Tester Name:** ___________  
**Environment:** Development / Staging / Production

#### Expected vs Actual

| Aspect | Expected | Actual | Match? |
|--------|----------|--------|--------|
| Outcome | [expected] | [observed] | [ ] Yes / [ ] No |
| UI Feedback | [expected message] | [actual message] | [ ] Yes / [ ] No |
| API Response | Status: [###] | Status: [###] | [ ] Yes / [ ] No |
| Database | [expected state] | [actual state] | [ ] Yes / [ ] No |

#### Issues Found

**Severity:** Critical / High / Medium / Low

**Description:**
[Describe what went wrong]

**Steps to Reproduce:**
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Logs/Screenshots:**
[Paste relevant logs or describe screenshot]

#### Blockers

- [ ] None
- [ ] Frontend issue (describe):
- [ ] Backend issue (describe):
- [ ] Stripe integration issue (describe):
- [ ] Firebase/Database issue (describe):
- [ ] Environment config issue (describe):

#### Notes

[Any additional observations]
```

---

## 5. Troubleshooting Guide

### Issue: "Stripe keys not configured"

**Symptoms:**
- Checkout button doesn't appear
- Console error: `Stripe is not defined`
- Checkout redirects with error

**Resolution:**
1. Verify `.env.local` has `NEXT_PUBLIC_STRIPE_PUBLIC_KEY`
2. Verify backend `.env` has `STRIPE_SECRET_KEY`
3. Restart both frontend and backend
4. Check Stripe Dashboard that keys are valid (not revoked)
5. Ensure keys are for **test mode**, not production

---

### Issue: "Cannot verify webhook signature"

**Symptoms:**
- Webhooks received but marked as failed in Stripe Dashboard
- Backend logs: `[WEBHOOK] Invalid signature`
- Subscription not created after payment

**Resolution:**
1. Copy webhook signing secret **again** from Stripe → Developers → Webhooks
2. Paste exact value into `backend/.env` as `STRIPE_WEBHOOK_SECRET`
3. Restart backend: `npm start`
4. Re-trigger webhook from Stripe Dashboard:
   - Developers → Webhooks → click endpoint → "Send test event"
   - Select event type (e.g., `customer.subscription.created`)

---

### Issue: "Firebase collection not created"

**Symptoms:**
- Firestore shows no `subscriptions` collection
- App crashes when trying to read subscription
- Backend error: `Collection not found`

**Resolution:**
1. Manually create collection in Firebase Console:
   - Firestore → Create Collection
   - Name: `subscriptions`
   - Add sample document (or leave empty—auto-created on first signup)
2. Ensure Firebase Admin SDK is initialized in backend
3. Check backend logs for Firebase connection errors

---

### Issue: "403 Forbidden on Firestore reads"

**Symptoms:**
- Frontend/backend cannot read Firestore data
- Error: `Missing or insufficient permissions`
- Database operations fail silently

**Resolution:**
1. Check `firestore.rules`:
   ```javascript
   match /subscriptions/{document=**} {
     allow read, write: if request.auth.uid != null;
   }
   ```
2. Deploy rules:
   ```bash
   firebase deploy --only firestore:rules
   ```
3. Verify rules are active in Firebase Console

---

### Issue: "404 /api/customers endpoint not found"

**Symptoms:**
- API calls return 404 Not Found
- Route doesn't exist
- Backend not serving API routes

**Resolution:**
1. Verify backend is running: `npm start` in `/backend` directory
2. Check `backend/src/routes/` exists with API route files
3. Check `backend/src/index.js` imports routes correctly:
   ```javascript
   app.use('/api', apiRoutes);
   ```
4. Verify CORS configured:
   ```javascript
   app.use(cors({ origin: 'http://localhost:3000' }));
   ```
5. Restart backend after any route changes

---

### Issue: "Payment succeeds but subscription not created"

**Symptoms:**
- Stripe shows successful payment
- Firestore subscription status still `"trialing"`
- User remains blocked (402 errors)

**Resolution:**
1. Check webhook delivery in Stripe Dashboard:
   - Developers → Webhooks → click endpoint
   - Look for `customer.subscription.created` event
   - If status is "failed", click event and check error
2. Check backend logs for webhook processing errors
3. Verify webhook is subscribed to correct events:
   - Must include: `customer.subscription.created`, `invoice.payment_succeeded`
4. Manually trigger webhook retry from Stripe Dashboard:
   - Click failed event → "Retry webhook"

---

### Issue: "CORS error when calling backend from frontend"

**Symptoms:**
- Browser console: `Access to XMLHttpRequest blocked by CORS policy`
- Network tab shows failed preflight (OPTIONS request)

**Resolution:**
1. Backend must allow frontend origin in CORS:
   ```javascript
   const cors = require('cors');
   app.use(cors({
     origin: 'http://localhost:3000',
     credentials: true
   }));
   ```
2. Restart backend: `npm start`
3. In frontend, verify API calls include credentials:
   ```javascript
   fetch(url, {
     credentials: 'include',  // Add this
     headers: { 'Authorization': `Bearer ${token}` }
   })
   ```

---

### Issue: "authToken undefined in fetch calls"

**Symptoms:**
- Fetch calls fail with 401 Unauthorized
- Console shows: `authToken is undefined`

**Resolution:**
1. Get token from Firebase:
   ```javascript
   import { getAuth } from 'firebase/auth';
   
   const auth = getAuth();
   const user = auth.currentUser;
   const token = await user.getIdToken();
   ```
2. Add token to request:
   ```javascript
   const token = await auth.currentUser.getIdToken();
   fetch('http://localhost:4000/api/customers', {
     headers: { 'Authorization': `Bearer ${token}` }
   })
   ```

---

### Issue: "Trial countdown shows negative or 0 days"

**Symptoms:**
- Countdown says "-5 days" or "0 days" even though trial should be active
- Trial appears expired

**Resolution:**
1. Check Firestore:
   - Verify `trial_end` is in future (not past)
   - Verify `trial_start` is before `trial_end`
2. Frontend calculation bug?
   - Check if date math is correct:
   ```javascript
   const daysLeft = Math.ceil((trialEnd - new Date()) / (1000 * 60 * 60 * 24));
   ```
3. Check system clock is correct (not skewed)

---

### Issue: "Webhook events in Stripe Dashboard show 'failed'"

**Symptoms:**
- Stripe Dashboard → Developers → Webhooks shows delivery failures
- Endpoint marked with red X

**Resolution:**
1. Click on failed event to see error details
2. Common errors:
   - **Timeout (504):** Backend slow or crashed
     - Restart backend: `npm start`
   - **Connection refused (ECONNREFUSED):** Backend not running
     - Verify backend running on port 4000: `lsof -i :4000`
   - **400 Bad Request:** Malformed webhook handler
     - Check backend logs for parsing errors
3. Retry webhook from Dashboard after fixing
4. For testing: use Stripe CLI for reliable local webhooks:
   ```bash
   stripe listen --forward-to localhost:4000/stripe/webhook
   ```

---

## 6. Success Criteria

### MVP Success (All Must Pass)

- [ ] **Test Case 1:** New user signup creates trial automatically
- [ ] **Test Case 2:** Trial user can read/write API calls (200/201 responses)
- [ ] **Test Case 3:** Expired trial user blocked with 402 error
- [ ] **Test Case 4:** Stripe payment processes and activates subscription
- [ ] **Test Case 5:** Payment failure displays error and prevents activation
- [ ] **Test Case 6:** Webhooks received and database updated
- [ ] **Test Case 7:** WhatsApp blocked for non-paid users

### Additional Success Indicators

- [ ] No unhandled console errors
- [ ] No backend crashes during tests
- [ ] Firestore data consistent with UI state
- [ ] Stripe Dashboard reflects all transactions
- [ ] All error messages user-friendly and actionable
- [ ] Response times < 2 seconds for API calls

---

## 7. Performance & Load Benchmarks

### Expected Performance Targets

| Operation | Target | Acceptable Range |
|-----------|--------|------------------|
| Signup (with trial creation) | < 3s | 1-5s |
| API GET (customers list) | < 1s | 0.5-2s |
| API POST (create customer) | < 2s | 1-3s |
| Stripe Checkout load | < 2s | 1-4s |
| Webhook processing | < 1s | 0.5-2s |
| Trial countdown update | < 500ms | 100-1000ms |

### Load Test (Optional)

**If testing with multiple users:**

```bash
# Create 5 test accounts in parallel
for i in {1..5}; do
  curl -X POST http://localhost:4000/auth/signup \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"user$i@test.com\",\"password\":\"Test123!\"}" &
done
wait
```

**Expected:** All accounts created successfully without 500 errors

---

## 8. Regression Testing Checklist

Before declaring integration complete, re-verify:

- [ ] Existing customer list displays (no data loss)
- [ ] WhatsApp integration still works for paid users
- [ ] N8N workflows still execute
- [ ] Admin dashboard still functional
- [ ] No changes to authentication flow
- [ ] Existing reports/analytics unaffected

---

## 9. Sign-Off

**Testing Completed By:** ___________  
**Date:** ___________  
**Overall Status:** [ ] PASS | [ ] FAIL | [ ] PARTIAL  

**Summary of Issues Found:**
```
[List any critical issues blocking production]
```

**Recommendation:**
- [ ] Ready for Production
- [ ] Ready with Minor Fixes
- [ ] Needs Major Fixes
- [ ] Blocked (Critical Issues)

**Sign-Off:**
```
Tester: ___________  Signature: ___________  Date: ___________
QA Lead: ___________  Signature: ___________  Date: ___________
```

---

## Appendix A: Quick Commands Reference

### Start Development Environment
```bash
# Terminal 1 - Backend
cd /Users/branel/CRM-auto/backend
npm start

# Terminal 2 - Frontend
cd /Users/branel/CRM-auto
npm run dev

# Terminal 3 - Stripe CLI (optional, for webhooks)
stripe listen --forward-to localhost:4000/stripe/webhook
```

### Useful Debug Commands

**Check if ports are in use:**
```bash
lsof -i :3000    # Frontend
lsof -i :4000    # Backend
lsof -i :5678    # N8N
```

**View backend logs in real-time:**
```bash
# Terminal already running backend shows logs
# Or tail if using nohup:
tail -f nohup.out
```

**Test Firestore connection:**
```bash
curl http://localhost:4000/health  # If health endpoint exists
```

**Clear browser cache (if issues persist):**
```bash
# Open DevTools → Application → Clear Storage → Clear Site Data
# Or: Cmd+Shift+Delete in Chrome
```

---

## Appendix B: Stripe Test Mode Reference

**Important:** Always test in Stripe Test Mode, never test in Production.

### Test Mode Indicators
- Stripe Dashboard shows "Test Mode" toggle in top-right
- Test API keys start with `pk_test_` (public) or `sk_test_` (secret)
- Charges do not process real payments
- Data is separate from production

### Webhook Testing via Stripe Dashboard

1. Go to Stripe Dashboard → Developers → Webhooks
2. Click your endpoint
3. Scroll to "Events"
4. Click "Send a test event"
5. Select event type (e.g., `customer.subscription.created`)
6. View response and backend logs

### Test Card Numbers (Stripe Provided)

| Outcome | Card Number | Expiry | CVC |
|---------|-------------|--------|-----|
| Success | 4242 4242 4242 4242 | Any future | Any 3 digits |
| Decline | 4000 0000 0000 9995 | Any future | Any 3 digits |
| Fraud | 4000 0000 0000 0002 | Any future | Any 3 digits |
| 3D Secure Required | 4000 0025 0000 3155 | Any future | Any 3 digits |

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-07-02 | Claude Code | Initial comprehensive testing documentation |

---

**End of Document**
