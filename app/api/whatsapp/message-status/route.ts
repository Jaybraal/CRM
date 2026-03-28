export const dynamic = 'force-dynamic'

import { adminDb } from '@/lib/firebase-admin'
import { NextRequest, NextResponse } from 'next/server'

const STATUS_MAP: Record<number, string> = {
  1: 'sending',
  2: 'sent',
  3: 'delivered',
  4: 'read',
  5: 'read',
}

export async function POST(req: NextRequest) {
  try {
    const { orgId, phone, whatsappMsgId, statusCode } = await req.json()
    if (!orgId || !whatsappMsgId || statusCode == null) return NextResponse.json({ ok: true })

    const status = STATUS_MAP[statusCode]
    if (!status) return NextResponse.json({ ok: true })

    // Buscar cliente por teléfono para obtener el clientId
    let clientId: string | null = null
    if (phone) {
      const clientSnap = await adminDb
        .collection(`organizations/${orgId}/clients`)
        .where('whatsappPhone', '==', phone)
        .limit(1)
        .get()
      if (!clientSnap.empty) clientId = clientSnap.docs[0].id
    }
    if (!clientId) return NextResponse.json({ ok: true })

    // Buscar el mensaje por whatsappMsgId
    const msgsSnap = await adminDb
      .collection(`organizations/${orgId}/clients/${clientId}/messages`)
      .where('whatsappMsgId', '==', whatsappMsgId)
      .limit(1)
      .get()

    if (!msgsSnap.empty) {
      await msgsSnap.docs[0].ref.update({ status })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('message-status error:', err)
    return NextResponse.json({ ok: true })
  }
}
