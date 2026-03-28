export const dynamic = 'force-dynamic'

import { adminDb } from '@/lib/firebase-admin'
import { NextRequest, NextResponse } from 'next/server'

interface SendBody {
  orgId: string
  to: string
  text?: string
  photoUrls?: string[]
  location?: { lat: number; lng: number; name?: string }
  type?: 'text' | 'image' | 'location' | 'call'
}

export async function POST(req: NextRequest) {
  try {
    const { orgId, to, text, photoUrls = [], location, type }: SendBody = await req.json()

    if (!orgId || !to) {
      return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 })
    }

    const baileysUrl = process.env.BAILEYS_URL?.trim()

    if (baileysUrl) {
      // Send images — return msgId of last image for tick tracking
      let lastImgMsgId: string | null = null
      for (const url of photoUrls) {
        const imgRes = await fetch(`${baileysUrl}/send-image`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to, url, caption: '', sessionId: orgId }),
        })
        if (!imgRes.ok) {
          const err = await imgRes.json().catch(() => ({ error: 'Error desconocido' }))
          return NextResponse.json({ error: err.error || 'Error al enviar imagen' }, { status: imgRes.status })
        }
        const imgData = await imgRes.json().catch(() => ({}))
        if (imgData.msgId) lastImgMsgId = imgData.msgId
      }
      if (lastImgMsgId && photoUrls.length > 0 && !text?.trim()) {
        return NextResponse.json({ ok: true, msgId: lastImgMsgId })
      }

      // Send location
      if (type === 'location' && location) {
        const locRes = await fetch(`${baileysUrl}/send-location`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to, lat: location.lat, lng: location.lng, name: location.name, sessionId: orgId }),
        })
        if (!locRes.ok) {
          const err = await locRes.json().catch(() => ({ error: 'Error desconocido' }))
          return NextResponse.json({ error: err.error || 'Error al enviar ubicación' }, { status: locRes.status })
        }
        return NextResponse.json({ ok: true })
      }

      // Initiate call
      if (type === 'call') {
        const callRes = await fetch(`${baileysUrl}/call`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to }),
        })
        return NextResponse.json(await callRes.json())
      }

      // Send text
      if (text?.trim()) {
        const sendRes = await fetch(`${baileysUrl}/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to, text: text.trim(), sessionId: orgId }),
        })
        if (!sendRes.ok) {
          const err = await sendRes.json().catch(() => ({ error: 'Error desconocido' }))
          console.error('Baileys send error:', err)
          return NextResponse.json({ error: err.error || 'Error al enviar por WhatsApp' }, { status: sendRes.status })
        }
        const sendData = await sendRes.json().catch(() => ({}))
        return NextResponse.json({ ok: true, msgId: sendData.msgId || null })
      }

      return NextResponse.json({ ok: true })
    }

    // Meta Cloud API fallback
    const orgSnap = await adminDb.doc(`organizations/${orgId}`).get()
    if (!orgSnap.exists) return NextResponse.json({ error: 'Org no encontrada' }, { status: 404 })

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
