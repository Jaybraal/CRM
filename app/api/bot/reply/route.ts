export const dynamic = 'force-dynamic'

import { adminDb } from '@/lib/firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'
import { NextRequest, NextResponse } from 'next/server'

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
    const { orgId, clientPhone, message, channel } = await req.json() as {
      orgId: string
      clientPhone: string
      message: string
      channel: 'whatsapp' | 'instagram'
    }

    if (!orgId || !clientPhone || !message) {
      return NextResponse.json({ error: 'orgId, clientPhone y message son requeridos' }, { status: 400 })
    }

    // Guardar respuesta del bot en historial
    const botMsg = { role: 'bot', content: message, ts: new Date() }
    await adminDb.doc(`organizations/${orgId}/bot_conversations/${clientPhone}`).set({
      updatedAt: new Date(),
      messages: FieldValue.arrayUnion(botMsg),
    }, { merge: true })

    // Enviar mensaje vía Baileys (WhatsApp)
    if (channel === 'whatsapp') {
      const baileysUrl = process.env.BAILEYS_URL || 'http://localhost:3002'
      const res = await fetch(`${baileysUrl}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: clientPhone, text: message }),
        signal: AbortSignal.timeout(8000),
      })

      if (!res.ok) {
        const err = await res.text()
        console.error(`[bot/reply] Baileys error ${res.status}: ${err}`)
        return NextResponse.json({ error: `Baileys error ${res.status}` }, { status: 502 })
      }

      console.log(`[bot/reply] Mensaje enviado a ${clientPhone} via WhatsApp`)
    }

    // TODO: canal Instagram — llamar a Meta Graph API /messages

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[bot/reply]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
