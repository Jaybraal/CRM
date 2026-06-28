export const dynamic = 'force-dynamic'

import { adminDb, getAdminStorage, sendFCMToOrg } from '@/lib/firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'
import { NextRequest, NextResponse } from 'next/server'

async function downloadMetaMedia(mediaId: string, token: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
  try {
    // Step 1: Get the media URL
    const metaRes = await fetch(`https://graph.facebook.com/v19.0/${mediaId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!metaRes.ok) return null
    const { url, mime_type } = await metaRes.json()

    // Step 2: Download the actual file
    const fileRes = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!fileRes.ok) return null
    const buffer = Buffer.from(await fileRes.arrayBuffer())
    return { buffer, mimeType: mime_type || 'application/octet-stream' }
  } catch (e) {
    console.error('Error downloading Meta media:', e)
    return null
  }
}

async function uploadToStorage(orgId: string, clientId: string, buffer: Buffer, mimeType: string): Promise<string> {
  const extMap: Record<string, string> = {
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp',
    'video/mp4': 'mp4', 'video/3gpp': '3gp',
    'audio/ogg': 'ogg', 'audio/ogg; codecs=opus': 'ogg', 'audio/mpeg': 'mp3', 'audio/aac': 'aac',
  }
  const ext = extMap[mimeType] || (mimeType.startsWith('video/') ? 'mp4' : mimeType.startsWith('audio/') ? 'ogg' : 'jpg')
  const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
  const path = `organizations/${orgId}/chat/${clientId}/${fileName}`

  const downloadToken = crypto.randomUUID()
  const bucket = getAdminStorage()

  await bucket.file(path).save(buffer, {
    metadata: {
      contentType: mimeType,
      metadata: { firebaseStorageDownloadTokens: downloadToken },
    },
  })

  return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(path)}?alt=media&token=${downloadToken}`
}

const VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'crm_webhook_2024'

function isInsideBusinessHours(businessHours: { days: number[]; openTime: string; closeTime: string } | undefined): boolean {
  if (!businessHours) return true // no config = always "in hours"
  const now = new Date()
  const day = now.getDay() // 0=Sun, 1=Mon...
  if (!businessHours.days.includes(day)) return false
  const [oh, om] = businessHours.openTime.split(':').map(Number)
  const [ch, cm] = businessHours.closeTime.split(':').map(Number)
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const openMin = oh * 60 + om
  const closeMin = ch * 60 + cm
  return nowMin >= openMin && nowMin < closeMin
}

async function getNextAgentForOrg(orgId: string): Promise<string> {
  const [agentsSnap, supervisorsSnap] = await Promise.all([
    adminDb.collection('users').where('orgId', '==', orgId).where('role', '==', 'agent').get(),
    adminDb.collection('users').where('orgId', '==', orgId).where('role', '==', 'supervisor').get(),
  ])
  const agents = [
    ...agentsSnap.docs.map(d => d.id),
    ...supervisorsSnap.docs.map(d => d.id),
  ].sort()
  if (agents.length === 0) {
    const ownerSnap = await adminDb.collection('users')
      .where('orgId', '==', orgId).where('role', '==', 'owner').limit(1).get()
    return ownerSnap.empty ? '' : ownerSnap.docs[0].id
  }
  const orgRef = adminDb.doc(`organizations/${orgId}`)
  return adminDb.runTransaction(async (tx) => {
    const orgSnap = await tx.get(orgRef)
    const settings = orgSnap.data()?.settings || {}
    const currentIndex = settings.roundRobinIndex ?? 0
    const nextIndex = (currentIndex + 1) % agents.length
    tx.update(orgRef, { 'settings.roundRobinIndex': nextIndex })
    return agents[currentIndex % agents.length]
  })
}

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
    const fromPhone: string = message.from // Meta envía sin "+", ej: "18295080887"
    const fromPhoneWithPlus = `+${fromPhone}`
    const msgType: string = message.type

    // Buscar config de la org por phoneNumberId
    const configSnap = await adminDb.doc(`whatsapp_configs/${phoneNumberId}`).get()
    if (!configSnap.exists) {
      return NextResponse.json({ ok: true })
    }
    const { orgId } = configSnap.data() as { orgId: string }

    // Leer token desde org_tokens (seguro - solo Admin SDK)
    const tokenSnap = await adminDb.doc(`org_tokens/${orgId}`).get()
    const tokenData = tokenSnap.data() || {}
    const waToken = (tokenData.wa_token as string) || ''

    // Buscar cliente por whatsappPhone — soporta con y sin "+"
    const [snapNoPlus, snapWithPlus] = await Promise.all([
      adminDb.collection(`organizations/${orgId}/clients`).where('whatsappPhone', '==', fromPhone).limit(1).get(),
      adminDb.collection(`organizations/${orgId}/clients`).where('whatsappPhone', '==', fromPhoneWithPlus).limit(1).get(),
    ])
    const clientsSnap = !snapNoPlus.empty ? snapNoPlus : snapWithPlus

    let clientId: string
    let clientName: string

    const isNewClient = clientsSnap.empty

    if (isNewClient) {
      // Crear cliente automático si no existe
      const contact = value.contacts?.[0]
      clientName = contact?.profile?.name || fromPhone
      const assignedTo = await getNextAgentForOrg(orgId)
      const newClientRef = await adminDb.collection(`organizations/${orgId}/clients`).add({
        name: clientName,
        whatsappPhone: fromPhone, // sin "+" para consistencia con Meta
        phone: fromPhone,
        orgId,
        status: 'lead',
        tags: [],
        photos: [],
        pipelineStage: 'new',
        assignedTo,
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
    let detectedType: string = msgType

    if (msgType === 'text') {
      text = message.text?.body
    } else if (msgType === 'image') {
      detectedType = 'image'
      text = message.image?.caption || ''
      const mediaId = message.image?.id
      if (mediaId && waToken) {
        const media = await downloadMetaMedia(mediaId, waToken)
        if (media) {
          const url = await uploadToStorage(orgId, clientId, media.buffer, media.mimeType)
          photos.push(url)
        }
      }
    } else if (msgType === 'video') {
      detectedType = 'video'
      text = message.video?.caption || ''
      const mediaId = message.video?.id
      if (mediaId && waToken) {
        const media = await downloadMetaMedia(mediaId, waToken)
        if (media) {
          const url = await uploadToStorage(orgId, clientId, media.buffer, media.mimeType)
          photos.push(url)
        }
      }
    } else if (msgType === 'audio' || msgType === 'voice') {
      detectedType = 'audio'
      text = '🎤 Nota de voz'
      const mediaId = (message.audio || message.voice)?.id
      if (mediaId && waToken) {
        const media = await downloadMetaMedia(mediaId, waToken)
        if (media) {
          const url = await uploadToStorage(orgId, clientId, media.buffer, media.mimeType)
          photos.push(url)
        }
      }
    } else if (msgType === 'document') {
      text = `[Documento: ${message.document?.filename || 'archivo'}]`
    } else if (msgType === 'location') {
      const loc = message.location
      text = `[Ubicación: ${loc?.latitude}, ${loc?.longitude}]`
    }

    // Guardar mensaje en Firestore
    await adminDb.collection(`organizations/${orgId}/clients/${clientId}/messages`).add({
      orgId,
      clientId,
      type: detectedType,
      text: text || '',
      photos,
      senderId: fromPhone,
      senderName: clientName || fromPhone,
      source: 'whatsapp',
      createdAt: FieldValue.serverTimestamp(),
    })

    // Incrementar contador de no leídos y actualizar timestamp
    const lastMessagePreview = text ? text.substring(0, 100) : '[Multimedia]'
    await adminDb.doc(`organizations/${orgId}/clients/${clientId}`).update({
      unreadCount: FieldValue.increment(1),
      lastMessageAt: FieldValue.serverTimestamp(),
      lastMessage: lastMessagePreview,
      updatedAt: FieldValue.serverTimestamp(),
    }).catch(() => {})

    // Escribir notificación para push en el dashboard
    const notifTitle = `Nuevo mensaje de ${clientName}`
    const notifBody = text ? text.substring(0, 100) : 'Mensaje multimedia'
    const notifUrl = `/dashboard/clients/${clientId}`
    await adminDb.collection(`organizations/${orgId}/notifications`).add({
      title: notifTitle,
      body: notifBody,
      clientId,
      url: notifUrl,
      createdAt: FieldValue.serverTimestamp(),
    })
    void sendFCMToOrg(orgId, notifTitle, notifBody, notifUrl)

    // Bot N8N trigger
    const orgDoc = await adminDb.doc(`organizations/${orgId}`).get()
    const orgData = orgDoc.data()

    const n8nMode = orgData?.settings?.n8nMode as string | undefined
    const n8nWebhookUrl = orgData?.settings?.n8nWebhookUrl as string | undefined
    if (n8nMode && n8nMode !== 'off' && n8nWebhookUrl) {
      const bh = orgData?.settings?.businessHours as { days: number[]; openTime: string; closeTime: string } | undefined
      const shouldTrigger = n8nMode === 'always' || (n8nMode === 'outside_hours' && !isInsideBusinessHours(bh))
      if (shouldTrigger) {
        // Guardar mensaje del usuario en historial de conversación del bot
        const convRef = adminDb.doc(`organizations/${orgId}/bot_conversations/${fromPhone}`)
        const userMsg = { role: 'user', content: text || '[Multimedia]', ts: new Date() }
        await convRef.set({
          phone: fromPhone,
          name: clientName,
          channel: 'whatsapp',
          status: 'active',
          updatedAt: new Date(),
          messages: FieldValue.arrayUnion(userMsg),
        }, { merge: true })

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        void fetch(`${appUrl}/api/bot/trigger`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orgId,
            clientPhone: fromPhone,
            clientName,
            message: text || '[Multimedia]',
            channel: 'whatsapp',
          }),
        })
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Webhook error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
