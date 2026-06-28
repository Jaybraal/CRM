import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'

export async function POST(req: NextRequest) {
  try {
    const { orgId, name, phone, email, summary, stage, appointmentAt } = await req.json()

    if (!orgId || !name || !phone) {
      return NextResponse.json({ error: 'Faltan campos requeridos: orgId, name, phone' }, { status: 400 })
    }

    // 1. Check if client already exists
    const existing = await adminDb
      .collection(`organizations/${orgId}/clients`)
      .where('whatsappPhone', '==', phone)
      .limit(1).get()

    let clientId: string

    if (!existing.empty) {
      clientId = existing.docs[0].id
      await existing.docs[0].ref.update({
        status: 'prospect',
        updatedAt: FieldValue.serverTimestamp(),
      })
    } else {
      // Assign to org owner
      const ownerSnap = await adminDb.collection('users')
        .where('orgId', '==', orgId).where('role', '==', 'owner').limit(1).get()
      const assignedTo = ownerSnap.empty ? '' : ownerSnap.docs[0].id

      const clientRef = await adminDb.collection(`organizations/${orgId}/clients`).add({
        orgId, name, phone, email: email || null,
        whatsappPhone: phone,
        status: 'prospect',
        pipelineStage: stage || 'contacted',
        tags: ['bot'],
        photos: [],
        assignedTo,
        createdBy: 'bot',
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      })
      clientId = clientRef.id
    }

    // 2. Create deal
    const ownerSnap = await adminDb.collection('users')
      .where('orgId', '==', orgId).where('role', '==', 'owner').limit(1).get()
    const assignedTo = ownerSnap.empty ? '' : ownerSnap.docs[0].id

    await adminDb.collection(`organizations/${orgId}/deals`).add({
      orgId, clientId,
      stage: stage || 'contacted',
      assignedTo,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })

    // 3. Save qualification note
    await adminDb.collection(`organizations/${orgId}/clients/${clientId}/messages`).add({
      orgId, clientId,
      type: 'text',
      text: `[Bot N8N] ${summary}`,
      photos: [],
      senderId: 'bot',
      senderName: 'Bot N8N',
      source: 'whatsapp',
      isNote: true,
      createdAt: FieldValue.serverTimestamp(),
    })

    // 4. Schedule appointment if provided
    if (appointmentAt) {
      const apptDate = new Date(appointmentAt)
      if (!isNaN(apptDate.getTime())) {
        await adminDb.collection(`organizations/${orgId}/appointments`).add({
          orgId, clientId, clientName: name,
          title: `Cita con ${name}`,
          assignedTo,
          startDate: apptDate,
          createdAt: FieldValue.serverTimestamp(),
        })
      }
    }

    // 5. Save bot lead record
    await adminDb.collection(`organizations/${orgId}/bot_leads`).add({
      orgId, name, phone, email: email || null, summary,
      stage: stage || 'contacted', clientId,
      source: 'bot',
      channel: 'whatsapp',
      createdAt: FieldValue.serverTimestamp(),
    })

    console.log(`[bot/webhook] Lead creado: ${name} (${phone}) para org ${orgId}`)
    return NextResponse.json({ ok: true, clientId })
  } catch (e) {
    console.error('[bot/webhook]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
