import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { adminDb } from '@/lib/firebase-admin'

export async function POST(req: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Stripe no configurado' }, { status: 503 })
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  const sig = req.headers.get('stripe-signature')!
  const body = await req.text()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (e) {
    console.error('[billing/webhook] signature invalid', e)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session
      const { orgId, plan } = session.metadata || {}
      if (orgId && plan) {
        await adminDb.collection('organizations').doc(orgId).update({
          plan,
          stripeCustomerId: session.customer,
          stripeSubscriptionId: session.subscription,
          accessExpiresAt: null,
        })
        console.log(`[billing/webhook] org=${orgId} upgraded to ${plan}`)
      }
    }

    if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object as Stripe.Subscription
      const snap = await adminDb.collection('organizations').where('stripeSubscriptionId', '==', sub.id).get()
      if (!snap.empty) {
        await snap.docs[0].ref.update({ plan: 'trial' })
        console.log(`[billing/webhook] subscription cancelled → trial for org ${snap.docs[0].id}`)
      }
    }

    return NextResponse.json({ received: true })
  } catch (e) {
    console.error('[billing/webhook]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
