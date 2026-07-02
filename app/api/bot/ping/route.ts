import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'

export async function POST(req: NextRequest) {
  try {
    const { orgId } = await req.json()
    if (!orgId) return NextResponse.json({ error: 'orgId requerido' }, { status: 400 })

    const orgSnap = await adminDb.doc(`organizations/${orgId}`).get()
    const settings = orgSnap.data()?.settings || {}
    const webhookUrl = settings.n8nWebhookUrl as string | undefined
    const apiKey = settings.n8nApiKey as string | undefined

    if (!webhookUrl) {
      return NextResponse.json({ error: 'N8N no configurado' }, { status: 503 })
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (apiKey) headers['x-api-key'] = apiKey

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ping: true, orgId, source: 'crm-test' }),
      signal: AbortSignal.timeout(8000),
    })

    if (!res.ok) {
      return NextResponse.json({ error: `N8N respondió ${res.status}` }, { status: 502 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
