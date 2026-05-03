import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const PRICE_IDS: Record<string, string> = {
  basic: process.env.STRIPE_PRICE_BASIC || '',
  pro: process.env.STRIPE_PRICE_PRO || '',
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: 'Stripe no configurado. Añade STRIPE_SECRET_KEY al .env.local' }, { status: 503 })
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
    const { orgId, plan } = await req.json() as { orgId: string; plan: 'basic' | 'pro' }

    const priceId = PRICE_IDS[plan]
    if (!priceId) return NextResponse.json({ error: `Añade STRIPE_PRICE_${plan.toUpperCase()} al .env.local` }, { status: 400 })

    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/dashboard/settings?billing=success`,
      cancel_url: `${origin}/dashboard/settings?billing=cancel`,
      metadata: { orgId, plan },
      allow_promotion_codes: true,
    })

    console.log(`[billing/checkout] org=${orgId} plan=${plan} session=${session.id}`)
    return NextResponse.json({ url: session.url })
  } catch (e) {
    console.error('[billing/checkout]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
