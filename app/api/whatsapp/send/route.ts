export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'

interface SendBody {
  orgId: string
  to: string
  text?: string
  photoUrls?: string[]
  videoUrl?: string
  audioUrl?: string
  location?: { lat: number; lng: number; name?: string }
  type?: 'text' | 'image' | 'video' | 'audio' | 'location' | 'call'
}

export async function POST(req: NextRequest) {
  try {
    const { orgId, to, text, photoUrls = [], videoUrl, audioUrl, location, type }: SendBody = await req.json()

    if (!orgId || !to) {
      return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 })
    }

    // ── Baileys (único proveedor) ──────────────────────────────────────────
    const baileysUrl = process.env.BAILEYS_URL?.trim()
    if (!baileysUrl) {
      return NextResponse.json({ error: 'BAILEYS_URL no configurado' }, { status: 400 })
    }

    // Send images via Baileys — el texto va como caption en la primera imagen
    let lastImgMsgId: string | null = null
    for (let i = 0; i < photoUrls.length; i++) {
      const url = photoUrls[i]
      const caption = i === 0 ? (text?.trim() || '') : ''
      const imgRes = await fetch(`${baileysUrl}/send-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, url, caption, sessionId: orgId }),
      })
      if (!imgRes.ok) {
        const err = await imgRes.json().catch(() => ({ error: 'Error desconocido' }))
        return NextResponse.json({ error: err.error || 'Error al enviar imagen' }, { status: imgRes.status })
      }
      const imgData = await imgRes.json().catch(() => ({}))
      if (imgData.msgId) lastImgMsgId = imgData.msgId
    }
    // Si ya enviamos imágenes con caption, no enviar texto duplicado
    if (lastImgMsgId && photoUrls.length > 0 && !videoUrl && !audioUrl) {
      return NextResponse.json({ ok: true, msgId: lastImgMsgId })
    }

    if (type === 'video' && videoUrl) {
      const vidRes = await fetch(`${baileysUrl}/send-video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, url: videoUrl, caption: text?.trim() || '', sessionId: orgId }),
      })
      if (!vidRes.ok) {
        const err = await vidRes.json().catch(() => ({ error: 'Error desconocido' }))
        return NextResponse.json({ error: err.error || 'Error al enviar video' }, { status: vidRes.status })
      }
      const vidData = await vidRes.json().catch(() => ({}))
      return NextResponse.json({ ok: true, msgId: vidData.msgId || null })
    }

    if (type === 'audio' && audioUrl) {
      const audioRes = await fetch(`${baileysUrl}/send-audio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, url: audioUrl, ptt: true, sessionId: orgId }),
      })
      if (!audioRes.ok) {
        const err = await audioRes.json().catch(() => ({ error: 'Error desconocido' }))
        return NextResponse.json({ error: err.error || 'Error al enviar audio' }, { status: audioRes.status })
      }
      const audioData = await audioRes.json().catch(() => ({}))
      return NextResponse.json({ ok: true, msgId: audioData.msgId || null })
    }

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

    if (type === 'call') {
      const callRes = await fetch(`${baileysUrl}/call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to }),
      })
      return NextResponse.json(await callRes.json())
    }

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
  } catch (err) {
    console.error('WhatsApp send error:', err)
    return NextResponse.json({ error: 'Error al enviar' }, { status: 500 })
  }
}
