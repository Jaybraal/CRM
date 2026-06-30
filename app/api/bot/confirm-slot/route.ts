export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'

async function sendWhatsApp(baileysUrl: string, to: string, text: string, sessionId: string) {
  await fetch(`${baileysUrl}/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, text, sessionId }),
    signal: AbortSignal.timeout(20000),
  })
}

export async function POST(req: NextRequest) {
  try {
    const { requestId, orgId, action } = await req.json() as {
      requestId: string
      orgId: string
      action: 'confirm' | 'reject'
    }

    if (!requestId || !orgId || !action) {
      return NextResponse.json({ error: 'requestId, orgId y action son requeridos' }, { status: 400 })
    }

    const reqRef = adminDb.doc(`organizations/${orgId}/appointment_requests/${requestId}`)
    const reqSnap = await reqRef.get()
    if (!reqSnap.exists) {
      return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 })
    }

    const request = reqSnap.data()!
    const baileysUrl = (process.env.BAILEYS_URL || 'http://localhost:3002').trim()

    if (action === 'confirm') {
      // Actualizar estado de la solicitud
      await reqRef.update({ status: 'confirmed' })

      // Crear cita oficial en appointments
      const orgSnap = await adminDb.doc(`organizations/${orgId}`).get()
      const orgName = orgSnap.data()?.name || 'el negocio'

      const [h, m] = (request.slotTime as string).split(':').map(Number)
      const now = new Date()
      const daysMap = [0, 1, 2, 3, 4, 5, 6]
      const targetDay = daysMap[request.slotDay as number]
      const today = now.getDay()
      const diff = (targetDay - today + 7) % 7 || 7
      const apptDate = new Date(now)
      apptDate.setDate(now.getDate() + diff)
      apptDate.setHours(h, m, 0, 0)

      await adminDb.collection(`organizations/${orgId}/appointments`).add({
        orgId,
        title: `Cita con ${request.clientName || request.clientPhone}`,
        clientName: request.clientName || '',
        clientPhone: request.clientPhone,
        assignedTo: 'bot',
        startDate: apptDate,
        status: 'confirmed',
        createdAt: new Date(),
      })

      // Notificar al cliente
      await sendWhatsApp(
        baileysUrl,
        request.clientPhone as string,
        `✅ ¡Tu cita ha sido confirmada!\n📅 ${request.slotLabel}\n📍 ${orgName}\n\nTe esperamos. Si necesitas cambiarla, escríbenos.`,
        orgId,
      )
    } else {
      // Rechazar
      await reqRef.update({ status: 'rejected' })
      await sendWhatsApp(
        baileysUrl,
        request.clientPhone as string,
        `Lo sentimos, el horario *${request.slotLabel}* ya no está disponible. ¿Quieres que revisemos otra opción?`,
        orgId,
      )
      // Reactivar bot para que el cliente pueda elegir otro slot
      await adminDb.doc(`organizations/${orgId}/bot_conversations/${request.clientPhone}`).set(
        { status: 'active' },
        { merge: true },
      )
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[bot/confirm-slot]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
