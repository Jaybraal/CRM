import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'

export async function POST(req: NextRequest) {
  try {
    const { orgId, clientPhone, clientName, message, channel } = await req.json()

    if (!orgId || !clientPhone) {
      return NextResponse.json({ error: 'orgId y clientPhone son requeridos' }, { status: 400 })
    }

    const orgSnap = await adminDb.doc(`organizations/${orgId}`).get()
    const settings = orgSnap.data()?.settings || {}

    const webhookUrl = settings.n8nWebhookUrl as string | undefined
    const apiKey = settings.n8nApiKey as string | undefined

    if (!webhookUrl) {
      return NextResponse.json({ error: 'N8N no configurado para esta org' }, { status: 503 })
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (apiKey) headers['x-api-key'] = apiKey

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ orgId, clientPhone, clientName, message, channel }),
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) {
      console.error(`[bot/trigger] N8N respondió ${res.status}`)
      return NextResponse.json({ error: `N8N error ${res.status}` }, { status: 502 })
    }

    console.log(`[bot/trigger] Conversación enviada a N8N: ${clientPhone} org=${orgId}`)
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[bot/trigger]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
