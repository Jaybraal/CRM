export const dynamic = 'force-dynamic'

import { adminDb } from '@/lib/firebase-admin'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { NextRequest, NextResponse } from 'next/server'

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params

  try {
    const body = await req.json() as {
      name: string
      email?: string
      phone?: string
      whatsappPhone?: string
      vehicle?: string
      service?: string
      notes?: string
      date: string   // "YYYY-MM-DD"
      time: string   // "HH:MM"
    }

    const { name, email, phone, whatsappPhone, vehicle, service, notes, date, time } = body

    if (!name?.trim() || !date || !time) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400, headers: corsHeaders() })
    }

    const orgSnap = await adminDb.doc(`organizations/${orgId}`).get()
    if (!orgSnap.exists) {
      return NextResponse.json({ error: 'Organización no encontrada' }, { status: 404, headers: corsHeaders() })
    }

    // Build notes combining vehicle and free notes
    const noteParts: string[] = []
    if (vehicle?.trim()) noteParts.push(`Vehículo: ${vehicle.trim()}`)
    if (notes?.trim()) noteParts.push(notes.trim())
    const fullNotes = noteParts.join('\n')

    // Create client contact
    const clientRef = await adminDb.collection(`organizations/${orgId}/clients`).add({
      orgId,
      name: name.trim(),
      email: email?.trim() || '',
      phone: phone?.trim() || '',
      whatsappPhone: whatsappPhone?.trim() || phone?.trim() || '',
      notes: fullNotes,
      status: 'lead',
      tags: [],
      photos: [],
      source: 'web_form',
      assignedTo: '',
      createdBy: 'web_form',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })

    // Build appointment dates
    const [h, m] = time.split(':').map(Number)
    const startDate = new Date(`${date}T${time}:00`)
    const endDate = new Date(startDate.getTime() + (orgSnap.data()?.settings?.businessHours?.slotMinutes || 60) * 60 * 1000)

    const apptTitle = service?.trim() || 'Cita desde web'

    await adminDb.collection(`organizations/${orgId}/appointments`).add({
      orgId,
      title: apptTitle,
      description: fullNotes,
      clientId: clientRef.id,
      clientName: name.trim(),
      assignedTo: '',
      startDate: Timestamp.fromDate(startDate),
      endDate: Timestamp.fromDate(endDate),
      createdAt: FieldValue.serverTimestamp(),
    })

    // Fire new_client webhook (non-critical)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
    if (appUrl) {
      fetch(`${appUrl}/api/webhooks/trigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId, event: 'new_client', data: { name: name.trim(), source: 'web_form' } }),
      }).catch(() => {})
    }

    return NextResponse.json({ ok: true, clientId: clientRef.id }, { headers: corsHeaders() })
  } catch (e) {
    console.error('[book]', e)
    return NextResponse.json({ error: String(e) }, { status: 500, headers: corsHeaders() })
  }
}
