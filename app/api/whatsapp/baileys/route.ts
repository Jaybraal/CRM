export const dynamic = 'force-dynamic'

import { adminDb } from '@/lib/firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'
import { NextRequest, NextResponse } from 'next/server'

async function getNextAgentForOrg(orgId: string): Promise<string> {
  // Incluir agents y supervisors en el round-robin
  const [agentsSnap, supervisorsSnap] = await Promise.all([
    adminDb.collection('users').where('orgId', '==', orgId).where('role', '==', 'agent').get(),
    adminDb.collection('users').where('orgId', '==', orgId).where('role', '==', 'supervisor').get(),
  ])

  const agents = [
    ...agentsSnap.docs.map(d => d.id),
    ...supervisorsSnap.docs.map(d => d.id),
  ].sort()

  // Si no hay agentes ni supervisors, asignar al owner
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

export async function POST(req: NextRequest) {
  try {
    const { orgId, from, fromName, text, type, jid, location, callDuration } = await req.json()

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
      // Auto-assign round-robin to next agent
      const assignedTo = await getNextAgentForOrg(orgId)

      clientName = fromName || from
      const newRef = await adminDb.collection(`organizations/${orgId}/clients`).add({
        name: clientName,
        whatsappPhone: from,
        whatsappJid: jid || from,
        phone: from,
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

    if (type === 'image') {
      messageData.text = text || '[Imagen recibida]'
    }

    await adminDb.collection(`organizations/${orgId}/clients/${clientId}/messages`).add(messageData)

    // Notification
    const notifTitle = isNew
      ? `Nuevo contacto: ${clientName}`
      : `Mensaje de ${clientName}`

    await adminDb.collection(`organizations/${orgId}/notifications`).add({
      title: notifTitle,
      body: type === 'location' ? '📍 Compartió su ubicación' : type === 'call' ? '📞 Llamada perdida' : (text?.substring(0, 100) || '[Multimedia]'),
      clientId,
      url: `/dashboard/clients/${clientId}`,
      createdAt: FieldValue.serverTimestamp(),
    })

    // Auto-reply
    const baileysUrl = process.env.BAILEYS_URL?.trim()
    if (baileysUrl) {
      const orgDoc = await adminDb.doc(`organizations/${orgId}`).get()
      const autoReply = orgDoc.data()?.settings?.autoReply
      if (autoReply?.enabled && autoReply?.message) {
        void fetch(`${baileysUrl}/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to: jid || from, text: autoReply.message }),
        })
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Baileys webhook error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
