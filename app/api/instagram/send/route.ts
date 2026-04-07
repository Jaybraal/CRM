export const dynamic = 'force-dynamic'

import { adminDb } from '@/lib/firebase-admin'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { orgId, recipientId, text, imageUrl } = await req.json()

    if (!orgId || !recipientId) {
      return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 })
    }

    // Obtener token de Instagram de la org
    const tokenSnap = await adminDb.doc(`org_tokens/${orgId}`).get()
    const tokenData = tokenSnap.exists ? tokenSnap.data()! : null
    const accessToken = tokenData?.ig_token as string | undefined
    const pageId = tokenData?.ig_page_id as string | undefined

    if (!accessToken || !pageId) {
      return NextResponse.json({ error: 'Instagram no configurado para esta organización' }, { status: 400 })
    }

    const apiUrl = `https://graph.facebook.com/v19.0/${pageId}/messages`
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    }

    // Enviar imagen si se proporciona
    if (imageUrl) {
      const imgRes = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          recipient: { id: recipientId },
          message: { attachment: { type: 'image', payload: { url: imageUrl, is_reusable: true } } },
          messaging_type: 'RESPONSE',
        }),
      })
      if (!imgRes.ok) {
        const err = await imgRes.json().catch(() => ({}))
        console.error('Instagram send image error:', err)
        return NextResponse.json({ error: err?.error?.message || 'Error al enviar imagen' }, { status: imgRes.status })
      }
    }

    // Enviar texto
    if (text?.trim()) {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          recipient: { id: recipientId },
          message: { text: text.trim() },
          messaging_type: 'RESPONSE',
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        console.error('Instagram send error:', err)
        return NextResponse.json({ error: err?.error?.message || 'Error al enviar mensaje' }, { status: res.status })
      }
      const data = await res.json().catch(() => ({}))
      return NextResponse.json({ ok: true, msgId: data?.message_id || null })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Instagram send error:', err)
    return NextResponse.json({ error: 'Error al enviar' }, { status: 500 })
  }
}
