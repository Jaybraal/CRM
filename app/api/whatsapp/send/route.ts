export const dynamic = 'force-dynamic'

import { adminDb } from '@/lib/firebase-admin'
import { safeDecrypt } from '@/lib/encrypt'
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

    // ── Detectar proveedor configurado para esta org ───────────────────────
    const tokenSnap = await adminDb.doc(`org_tokens/${orgId}`).get()
    const tokenData = tokenSnap.exists ? tokenSnap.data()! : null
    const metaPhoneNumberId = tokenData ? safeDecrypt(tokenData.wa_phone_number_id_enc as string) : ''
    const metaToken = tokenData ? safeDecrypt(tokenData.wa_token_enc as string) : ''
    const hasMetaConfig = !!(metaPhoneNumberId && metaToken)

    const baileysUrl = process.env.BAILEYS_URL?.trim()

    // ── Meta Cloud API (si tiene tokens configurados) ──────────────────────
    if (hasMetaConfig) {
      const apiUrl = `https://graph.facebook.com/v19.0/${metaPhoneNumberId}/messages`
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${metaToken}`,
      }

      for (const url of photoUrls) {
        await fetch(apiUrl, {
          method: 'POST', headers,
          body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'image', image: { link: url, caption: '' } }),
        })
      }

      if (type === 'video' && videoUrl) {
        await fetch(apiUrl, {
          method: 'POST', headers,
          body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'video', video: { link: videoUrl, caption: text?.trim() || '' } }),
        })
        return NextResponse.json({ ok: true })
      }

      if (type === 'audio' && audioUrl) {
        await fetch(apiUrl, {
          method: 'POST', headers,
          body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'audio', audio: { link: audioUrl } }),
        })
        return NextResponse.json({ ok: true })
      }

      if (type === 'location' && location) {
        await fetch(apiUrl, {
          method: 'POST', headers,
          body: JSON.stringify({
            messaging_product: 'whatsapp', to, type: 'location',
            location: { latitude: location.lat, longitude: location.lng, name: location.name || '' },
          }),
        })
        return NextResponse.json({ ok: true })
      }

      if (text?.trim() && !videoUrl) {
        const metaRes = await fetch(apiUrl, {
          method: 'POST', headers,
          body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: text.trim(), preview_url: false } }),
        })
        if (!metaRes.ok) {
          const err = await metaRes.json().catch(() => ({}))
          console.error('Meta send error:', err)
          return NextResponse.json({ error: err?.error?.message || 'Error al enviar por WhatsApp' }, { status: metaRes.status })
        }
        const metaData = await metaRes.json().catch(() => ({}))
        return NextResponse.json({ ok: true, msgId: metaData?.messages?.[0]?.id || null })
      }

      return NextResponse.json({ ok: true })
    }

    // ── Baileys (fallback si no hay Meta configurado) ──────────────────────
    if (!baileysUrl) {
      return NextResponse.json({ error: 'WhatsApp no configurado' }, { status: 400 })
    }

    // Send images via Baileys
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
    if (lastImgMsgId && photoUrls.length > 0 && !text?.trim() && !videoUrl && !audioUrl) {
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
