export const dynamic = 'force-dynamic'

import { adminDb, getAdminStorage, sendFCMToOrg } from '@/lib/firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'
import { NextRequest, NextResponse } from 'next/server'

async function uploadMediaToStorage(orgId: string, clientId: string, base64: string, mimeType: string): Promise<string> {
  const extMap: Record<string, string> = {
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp',
    'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm',
    'audio/ogg': 'ogg', 'audio/opus': 'opus', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a',
    'audio/ogg; codecs=opus': 'ogg',
  }
  const ext = extMap[mimeType] || (mimeType.startsWith('video/') ? 'mp4' : mimeType.startsWith('audio/') ? 'ogg' : 'jpg')
  const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
  const path = `organizations/${orgId}/chat/${clientId}/${fileName}`

  const buffer = Buffer.from(base64, 'base64')
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
      .where('orgId', '==', orgId)
      .where('role', '==', 'owner')
      .limit(1)
      .get()
    return ownerSnap.empty ? '' : ownerSnap.docs[0].id
  }
  const orgRef = adminDb.doc(`organizations/${orgId}`)

  const assignedUid = await adminDb.runTransaction(async (tx) => {
    const orgSnap = await tx.get(orgRef)
    const currentIndex = orgSnap.data()?.settings?.roundRobinIndex ?? 0
    const nextIndex = (currentIndex + 1) % agents.length
    tx.update(orgRef, { 'settings.roundRobinIndex': nextIndex })
    return agents[currentIndex % agents.length]
  })

  return assignedUid
}

async function sendBaileys(baileysUrl: string, to: string, text: string, sessionId: string) {
  return fetch(`${baileysUrl}/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, text, sessionId }),
  })
}

export async function POST(req: NextRequest) {
  try {
    const { orgId, from, fromName, text, type, jid, isLid, location, callDuration, mediaBase64, mediaMime } = await req.json()

    if (!orgId || !from) return NextResponse.json({ ok: true })

    // Find client by phone or jid
    let clientsSnap = await adminDb
      .collection(`organizations/${orgId}/clients`)
      .where('whatsappPhone', '==', from)
      .limit(1)
      .get()

    if (clientsSnap.empty && jid) {
      clientsSnap = await adminDb
        .collection(`organizations/${orgId}/clients`)
        .where('whatsappJid', '==', jid)
        .limit(1)
        .get()
    }

    let clientId: string
    let clientName: string
    let isNew = false

    if (clientsSnap.empty) {
      const assignedTo = await getNextAgentForOrg(orgId)
      clientName = fromName || from
      const newRef = await adminDb.collection(`organizations/${orgId}/clients`).add({
        name: clientName,
        whatsappPhone: from,
        whatsappJid: jid || from,
        ...(isLid ? {} : { phone: from }),
        isLid: !!isLid,
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
      clientId = newRef.id
      isNew = true
    } else {
      const clientDoc = clientsSnap.docs[0]
      clientId = clientDoc.id
      clientName = (clientDoc.data() as { name: string }).name
    }

    // Build message document
    const messageData: Record<string, unknown> = {
      orgId,
      clientId,
      type: type || 'text',
      text: text || '',
      photos: [],
      senderId: from,
      senderName: clientName,
      source: 'whatsapp',
      createdAt: FieldValue.serverTimestamp(),
    }

    if (type === 'location' && location) {
      messageData.location = location
      messageData.text = `📍 Ubicación compartida`
    }

    if (type === 'call') {
      messageData.callDuration = callDuration ?? -1
      messageData.text = callDuration === -1 ? '📞 Llamada perdida' : `📞 Llamada (${callDuration}s)`
    }

    // Upload media if provided
    if (mediaBase64 && mediaMime && (type === 'image' || type === 'video' || type === 'audio' || type === 'document')) {
      try {
        const mediaUrl = await uploadMediaToStorage(orgId, clientId, mediaBase64, mediaMime)
        messageData.photos = [mediaUrl]
        if (type === 'image') messageData.text = text || ''
        if (type === 'video') messageData.text = text || ''
        if (type === 'audio') messageData.text = '🎤 Nota de voz'
        if (type === 'document') messageData.text = text || 'archivo'
      } catch (e) {
        console.error('Error uploading media:', e)
        if (type === 'image') messageData.text = text || '[Imagen - error al cargar]'
        if (type === 'video') messageData.text = text || '[Video - error al cargar]'
        if (type === 'audio') messageData.text = '[Audio - error al cargar]'
        if (type === 'document') messageData.text = `[Documento: ${text || 'archivo'}]`
      }
    } else {
      if (type === 'image') messageData.text = text || '[Imagen]'
      if (type === 'video') messageData.text = text || '[Video]'
      if (type === 'audio') messageData.text = messageData.text || '[Audio]'
      if (type === 'document') messageData.text = `[Documento: ${text || 'archivo'}]`
    }

    await adminDb.collection(`organizations/${orgId}/clients/${clientId}/messages`).add(messageData)

    // Notification
    const notifTitle = isNew ? `Nuevo contacto: ${clientName}` : `Mensaje de ${clientName}`
    const notifBody = type === 'location' ? '📍 Compartió su ubicación' : type === 'call' ? '📞 Llamada perdida' : (text?.substring(0, 100) || '[Multimedia]')

    // Actualizar cliente con lastMessageAt y unreadCount para Inbox y reordenamiento
    await adminDb.doc(`organizations/${orgId}/clients/${clientId}`).update({
      lastMessageAt: FieldValue.serverTimestamp(),
      lastMessage: notifBody,
      unreadCount: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    })
    const notifUrl = `/dashboard/clients/${clientId}`
    await adminDb.collection(`organizations/${orgId}/notifications`).add({
      title: notifTitle,
      body: notifBody,
      clientId,
      url: notifUrl,
      createdAt: FieldValue.serverTimestamp(),
    })
    // FCM push to all org members (works even when browser is closed)
    void sendFCMToOrg(orgId, notifTitle, notifBody, notifUrl)

    // Qualification form + auto-reply
    const baileysUrl = process.env.BAILEYS_URL?.trim()
    if (baileysUrl && type !== 'call') {
      const orgDoc = await adminDb.doc(`organizations/${orgId}`).get()
      const orgData = orgDoc.data()
      const qualForm = orgData?.settings?.qualificationForm
      const autoReply = orgData?.settings?.autoReply

      let qualificationHandled = false

      if (qualForm?.enabled && Array.isArray(qualForm.questions) && qualForm.questions.length > 0) {
        const questions = [...qualForm.questions].sort((a, b) => a.order - b.order)
        const sessionRef = adminDb.doc(`organizations/${orgId}/qualification_sessions/${clientId}`)
        const sessionSnap = await sessionRef.get()

        if (sessionSnap.exists) {
          const session = sessionSnap.data()!
          if (session.state === 'active' && text) {
            const currentQ = questions[session.currentQuestion]
            const answers = { ...(session.answers || {}), [currentQ.id]: text }

            // If phone question, save as real client phone
            if (currentQ.type === 'phone') {
              const digits = text.replace(/\D/g, '')
              if (digits.length >= 7 && digits.length <= 15) {
                await adminDb.doc(`organizations/${orgId}/clients/${clientId}`).update({
                  phone: digits,
                  isLid: false,
                  updatedAt: FieldValue.serverTimestamp(),
                })
              }
            }

            // If autoTag, add answer as client tag
            if (currentQ.autoTag && text.trim()) {
              const tagValue = text.trim().toLowerCase()
              await adminDb.doc(`organizations/${orgId}/clients/${clientId}`).update({
                tags: FieldValue.arrayUnion(tagValue),
                updatedAt: FieldValue.serverTimestamp(),
              })
            }

            const nextIndex = session.currentQuestion + 1
            if (nextIndex >= questions.length) {
              await sessionRef.update({ state: 'completed', answers, completedAt: FieldValue.serverTimestamp() })
              const completionMsg = qualForm.completionMessage || '¡Gracias! Hemos recibido tu información. En breve te atenderemos.'
              void sendBaileys(baileysUrl, jid || from, completionMsg, orgId)
            } else {
              await sessionRef.update({ currentQuestion: nextIndex, answers })
              void sendBaileys(baileysUrl, jid || from, questions[nextIndex].text, orgId)
            }
            qualificationHandled = true
          }
        } else if (isNew) {
          await sessionRef.set({
            clientId,
            state: 'active',
            currentQuestion: 0,
            answers: {},
            startedAt: FieldValue.serverTimestamp(),
          })
          void sendBaileys(baileysUrl, jid || from, questions[0].text, orgId)
          qualificationHandled = true
        }
      }

      // Auto-reply only if not in qualification flow
      if (!qualificationHandled && autoReply?.enabled && autoReply?.message) {
        void sendBaileys(baileysUrl, jid || from, autoReply.message, orgId)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Baileys webhook error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
