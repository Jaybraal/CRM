export const dynamic = 'force-dynamic'

import { adminDb, sendFCMToOrg } from '@/lib/firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'
import { NextRequest, NextResponse } from 'next/server'

const IG_VERIFY_TOKEN = process.env.IG_VERIFY_TOKEN || 'crm_ig_webhook_2024'

// GET — verificación del webhook por Meta
export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get('hub.mode')
  const token = req.nextUrl.searchParams.get('hub.verify_token')
  const challenge = req.nextUrl.searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === IG_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 })
  }
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

async function getNextAgentForOrg(orgId: string): Promise<string> {
  const [agentsSnap, supervisorsSnap] = await Promise.all([
    adminDb.collection('users').where('orgId', '==', orgId).where('role', '==', 'agent').get(),
    adminDb.collection('users').where('orgId', '==', orgId).where('role', '==', 'supervisor').get(),
  ])
  const agents = [...agentsSnap.docs.map(d => d.id), ...supervisorsSnap.docs.map(d => d.id)].sort()
  if (agents.length === 0) {
    const ownerSnap = await adminDb.collection('users').where('orgId', '==', orgId).where('role', '==', 'owner').limit(1).get()
    return ownerSnap.empty ? '' : ownerSnap.docs[0].id
  }
  const orgRef = adminDb.doc(`organizations/${orgId}`)
  return adminDb.runTransaction(async (tx) => {
    const orgSnap = await tx.get(orgRef)
    const settings = orgSnap.data()?.settings || {}
    const currentIndex = settings.igRoundRobinIndex ?? 0
    const nextIndex = (currentIndex + 1) % agents.length
    tx.update(orgRef, { 'settings.igRoundRobinIndex': nextIndex })
    return agents[currentIndex % agents.length]
  })
}

// POST — recibir mensajes de Instagram
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Buscar la org que tiene este page_id configurado
    const pageId = body.entry?.[0]?.id
    if (!pageId) return NextResponse.json({ ok: true })

    // Buscar org por ig_page_id en org_tokens
    const tokenSnap = await adminDb.collection('org_tokens').where('ig_page_id', '==', pageId).limit(1).get()
    if (tokenSnap.empty) {
      console.warn('Instagram webhook: no org found for page_id', pageId)
      return NextResponse.json({ ok: true })
    }
    const orgId = tokenSnap.docs[0].id

    const entries = body.entry || []
    for (const entry of entries) {
      const messaging = entry.messaging || []
      for (const event of messaging) {
        // Solo mensajes entrantes (no echo)
        if (event.message?.is_echo) continue
        if (!event.message && !event.postback) continue

        const senderId: string = event.sender?.id
        if (!senderId || senderId === pageId) continue

        const msgId: string = event.message?.mid || ''
        const text: string = event.message?.text || event.postback?.payload || ''
        const attachments: { type: string; payload: { url?: string } }[] = event.message?.attachments || []

        // Buscar o crear cliente
        let clientsSnap = await adminDb
          .collection(`organizations/${orgId}/clients`)
          .where('instagramId', '==', senderId)
          .limit(1)
          .get()

        let clientId: string
        let clientName: string
        let isNew = false

        if (clientsSnap.empty) {
          // Intentar obtener nombre del perfil via Graph API
          const tokenData = tokenSnap.docs[0].data()
          const accessToken = tokenData?.ig_token || ''
          let name = senderId
          if (accessToken) {
            try {
              const profileRes = await fetch(
                `https://graph.facebook.com/v19.0/${senderId}?fields=name&access_token=${accessToken}`
              )
              const profile = await profileRes.json()
              if (profile.name) name = profile.name
            } catch { /* sin nombre */ }
          }

          const assignedTo = await getNextAgentForOrg(orgId)
          clientName = name
          const newRef = await adminDb.collection(`organizations/${orgId}/clients`).add({
            name: clientName,
            instagramId: senderId,
            orgId,
            status: 'lead',
            tags: [],
            photos: [],
            pipelineStage: 'new',
            assignedTo,
            createdBy: 'instagram',
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          })
          clientId = newRef.id
          isNew = true
        } else {
          const clientDoc = clientsSnap.docs[0]
          clientId = clientDoc.id
          clientName = (clientDoc.data() as { name?: string }).name || clientDoc.id
        }

        // Determinar tipo y contenido
        let msgType: string = 'text'
        let msgText = text
        const photos: string[] = []

        if (attachments.length > 0) {
          const att = attachments[0]
          if (att.type === 'image') { msgType = 'image'; if (att.payload?.url) photos.push(att.payload.url) }
          else if (att.type === 'video') { msgType = 'video'; if (att.payload?.url) photos.push(att.payload.url) }
          else if (att.type === 'audio') { msgType = 'audio'; msgText = '🎤 Nota de voz' }
          else msgText = `[${att.type}]`
        }

        await adminDb.collection(`organizations/${orgId}/clients/${clientId}/messages`).add({
          orgId,
          clientId,
          type: msgType,
          text: msgText,
          photos,
          senderId,
          senderName: clientName,
          source: 'instagram',
          instagramMsgId: msgId,
          createdAt: FieldValue.serverTimestamp(),
        })

        const notifTitle = isNew ? `Nuevo contacto IG: ${clientName}` : `Mensaje IG de ${clientName}`
        const notifBody = msgText?.substring(0, 100) || '[Multimedia]'

        await adminDb.doc(`organizations/${orgId}/clients/${clientId}`).update({
          lastMessageAt: FieldValue.serverTimestamp(),
          lastMessage: notifBody,
          unreadCount: FieldValue.increment(1),
          updatedAt: FieldValue.serverTimestamp(),
        })

        await adminDb.collection(`organizations/${orgId}/notifications`).add({
          title: notifTitle,
          body: notifBody,
          clientId,
          url: `/dashboard/instagram`,
          createdAt: FieldValue.serverTimestamp(),
        })

        void sendFCMToOrg(orgId, notifTitle, notifBody, `/dashboard/instagram`)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Instagram webhook error:', err)
    return NextResponse.json({ ok: true })
  }
}
