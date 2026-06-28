import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import type { Webhook, WebhookEvent } from '@/types'

export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }
  }
  try {
    const { orgId, event, data } = await req.json() as { orgId: string; event: WebhookEvent; data: Record<string, unknown> }

    const snap = await adminDb
      .collection('organizations').doc(orgId)
      .collection('webhooks')
      .where('active', '==', true)
      .get()

    const hooks = snap.docs
      .map(d => ({ id: d.id, ...d.data() }) as Webhook)
      .filter(wh => wh.events.includes(event))

    const results = await Promise.allSettled(
      hooks.map(wh =>
        fetch(wh.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-CRM-Event': event },
          body: JSON.stringify({ event, orgId, data, timestamp: new Date().toISOString() }),
          signal: AbortSignal.timeout(8000),
        })
      )
    )

    const ok = results.filter(r => r.status === 'fulfilled').length
    console.log(`[webhooks/trigger] event=${event} fired=${hooks.length} ok=${ok}`)
    return NextResponse.json({ fired: hooks.length, ok })
  } catch (e) {
    console.error('[webhooks/trigger]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
