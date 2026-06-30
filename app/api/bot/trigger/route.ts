import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'

function verifyBotSecret(req: NextRequest): boolean {
  const secret = process.env.BOT_INTERNAL_SECRET
  if (!secret) return false
  return req.headers.get('x-bot-secret') === secret
}

export async function POST(req: NextRequest) {
  if (!verifyBotSecret(req)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }
  try {
    const { orgId, clientPhone, clientName, message, channel } = await req.json()

    if (!orgId || !clientPhone) {
      return NextResponse.json({ error: 'orgId y clientPhone son requeridos' }, { status: 400 })
    }

    // Cargar org + catálogo + historial en paralelo
    const [orgSnap, catalogSnap, convSnap] = await Promise.all([
      adminDb.doc(`organizations/${orgId}`).get(),
      adminDb.collection(`organizations/${orgId}/catalog`).where('available', '==', true).limit(20).get(),
      adminDb.doc(`organizations/${orgId}/bot_conversations/${clientPhone}`).get(),
    ])

    const settings = orgSnap.data()?.settings || {}
    const webhookUrl = settings.n8nWebhookUrl as string | undefined
    const apiKey = settings.n8nApiKey as string | undefined

    if (!webhookUrl) {
      return NextResponse.json({ error: 'N8N no configurado para esta org' }, { status: 503 })
    }

    // Historial bot
    const rawHistory: Array<{ role: string; content: string }> = convSnap.data()?.messages || []
    const history = rawHistory.slice(-20).map(m => ({ role: m.role, content: m.content }))

    // Catálogo (top 20 disponibles)
    const catalog = catalogSnap.docs.map(d => {
      const data = d.data()
      return {
        id: d.id,
        title: data.title as string,
        price: data.price as number | undefined,
        description: (data.description as string | undefined)?.slice(0, 100),
        photo: (data.photos as string[])?.[0] || null,
      }
    })

    // Contexto del negocio
    const context = {
      botPersonality: settings.botPersonality || null,
      faq: settings.faq || [],
      businessLocation: settings.businessLocation || null,
      appointmentSlots: settings.appointmentSlots || [],
      catalog,
      orgName: orgSnap.data()?.name || '',
      publicCatalogUrl: `${process.env.NEXT_PUBLIC_APP_URL}/c/${orgId}`,
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (apiKey) headers['x-api-key'] = apiKey

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ orgId, clientPhone, clientName, message, channel, history, context }),
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) {
      console.error(`[bot/trigger] N8N respondió ${res.status}`)
      return NextResponse.json({ error: `N8N error ${res.status}` }, { status: 502 })
    }

    console.log(`[bot/trigger] Conversación enviada a N8N: ${clientPhone} org=${orgId} history=${history.length} msgs catalog=${catalog.length} items`)
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[bot/trigger]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
