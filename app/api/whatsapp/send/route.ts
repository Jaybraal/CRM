export const dynamic = 'force-dynamic'

import { adminDb } from '@/lib/firebase-admin'
import { NextRequest, NextResponse } from 'next/server'

interface SendBody {
  orgId: string
  to: string
  text?: string
  photoUrls?: string[]
}

export async function POST(req: NextRequest) {
  try {
    const { orgId, to, text, photoUrls = [] }: SendBody = await req.json()

    if (!orgId || !to) {
      return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 })
    }

    // Obtener config de WhatsApp de la org
    const orgSnap = await adminDb.doc(`organizations/${orgId}`).get()
    if (!orgSnap.exists) {
      return NextResponse.json({ error: 'Org no encontrada' }, { status: 404 })
    }

    const orgData = orgSnap.data() as { settings: { whatsapp?: { phoneNumberId: string; token: string } } }
    const waConfig = orgData.settings?.whatsapp

    if (!waConfig?.phoneNumberId || !waConfig?.token) {
      return NextResponse.json({ error: 'WhatsApp no configurado' }, { status: 400 })
    }

    const { phoneNumberId, token } = waConfig
    const apiUrl = `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    }

    // Enviar fotos primero
    for (const url of photoUrls) {
      await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'image',
          image: { link: url, caption: '' },
        }),
      })
    }

    // Enviar texto
    if (text?.trim()) {
      await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body: text.trim(), preview_url: false },
        }),
      })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('WhatsApp send error:', err)
    return NextResponse.json({ error: 'Error al enviar' }, { status: 500 })
  }
}
