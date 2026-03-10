export const dynamic = 'force-dynamic'

import { adminDb } from '@/lib/firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'
import { NextRequest, NextResponse } from 'next/server'

const VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'crm_webhook_2024'

// GET — Meta verifica el webhook
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 })
  }
  return new Response('Forbidden', { status: 403 })
}

// POST — Meta envía mensajes entrantes
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const entry = body?.entry?.[0]
    const change = entry?.changes?.[0]
    const value = change?.value

    if (!value?.messages?.length) {
      return NextResponse.json({ ok: true })
    }

    const phoneNumberId: string = value.metadata?.phone_number_id
    const message = value.messages[0]
    const fromPhone: string = message.from
    const msgType: string = message.type

    // Buscar config de la org por phoneNumberId
    const configSnap = await adminDb.doc(`whatsapp_configs/${phoneNumberId}`).get()
    if (!configSnap.exists) {
      return NextResponse.json({ ok: true })
    }
    const { orgId } = configSnap.data() as { orgId: string; token: string }

    // Buscar cliente por whatsappPhone
    const clientsSnap = await adminDb
      .collection(`organizations/${orgId}/clients`)
      .where('whatsappPhone', '==', fromPhone)
      .limit(1)
      .get()

    let clientId: string
    let clientName: string

    if (clientsSnap.empty) {
      // Crear cliente automático si no existe
      const contact = value.contacts?.[0]
      clientName = contact?.profile?.name || fromPhone
      const newClientRef = await adminDb.collection(`organizations/${orgId}/clients`).add({
        name: clientName,
        whatsappPhone: fromPhone,
        phone: fromPhone,
        orgId,
        status: 'lead',
        tags: [],
        photos: [],
        pipelineStage: 'new',
        assignedTo: '',
        createdBy: 'whatsapp',
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      })
      clientId = newClientRef.id
    } else {
      const clientDoc = clientsSnap.docs[0]
      clientId = clientDoc.id
      clientName = (clientDoc.data() as { name: string }).name
    }

    // Extraer contenido del mensaje
    let text: string | undefined
    const photos: string[] = []

    if (msgType === 'text') {
      text = message.text?.body
    } else if (msgType === 'image') {
      // La URL pública de la imagen viene en message.image.url o hay que descargarla
      // Meta provee la media_id, se necesita llamar a la API para obtener la URL
      const mediaId = message.image?.id
      if (mediaId) {
        photos.push(`https://graph.facebook.com/v19.0/${mediaId}`) // placeholder - se resuelve con el token
      }
      text = message.image?.caption
    } else if (msgType === 'document') {
      text = `[Documento: ${message.document?.filename || 'archivo'}]`
    } else if (msgType === 'audio' || msgType === 'voice') {
      text = '[Mensaje de voz]'
    } else if (msgType === 'video') {
      text = '[Video]'
    } else if (msgType === 'location') {
      const loc = message.location
      text = `[Ubicación: ${loc?.latitude}, ${loc?.longitude}]`
    }

    // Guardar mensaje en Firestore
    await adminDb.collection(`organizations/${orgId}/clients/${clientId}/messages`).add({
      orgId,
      clientId,
      text,
      photos,
      senderId: fromPhone,
      senderName: clientName,
      source: 'whatsapp',
      createdAt: FieldValue.serverTimestamp(),
    })

    // Escribir notificación para push en el dashboard
    await adminDb.collection(`organizations/${orgId}/notifications`).add({
      title: `Nuevo mensaje de ${clientName}`,
      body: text ? text.substring(0, 100) : 'Mensaje multimedia',
      clientId,
      url: `/dashboard/clients/${clientId}`,
      createdAt: FieldValue.serverTimestamp(),
    })

    // Auto-reply bot
    const orgDoc = await adminDb.doc(`organizations/${orgId}`).get()
    const orgData = orgDoc.data()
    const autoReply = orgData?.settings?.autoReply
    if (autoReply?.enabled && autoReply?.message) {
      const { orgId: _o, token: orgToken } = configSnap.data() as { orgId: string; token: string }
      void fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${orgToken}`,
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: fromPhone,
          type: 'text',
          text: { body: autoReply.message },
        }),
      })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Webhook error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
