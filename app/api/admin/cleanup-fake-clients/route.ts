export const dynamic = 'force-dynamic'

import { adminDb } from '@/lib/firebase-admin'
import { requireSuperAdminJWT } from '@/lib/admin-auth'
import { NextRequest, NextResponse } from 'next/server'

// Elimina clientes creados por WA con JIDs falsos (newsletter, broadcast, etc.)
export async function POST(req: NextRequest) {
  if (!(await requireSuperAdminJWT(req))) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }
  try {
    const { orgId } = await req.json()
    if (!orgId) return NextResponse.json({ error: 'orgId requerido' }, { status: 400 })

    const snap = await adminDb
      .collection(`organizations/${orgId}/clients`)
      .where('createdBy', '==', 'whatsapp')
      .get()

    const batch = adminDb.batch()
    let count = 0

    for (const doc of snap.docs) {
      const data = doc.data()
      const jid = data.whatsappJid || ''
      const phone = data.whatsappPhone || ''

      const isFake =
        jid.includes('@newsletter') ||
        jid.includes('@broadcast') ||
        phone.includes('@newsletter') ||
        phone.includes('@broadcast') ||
        phone.includes('status') ||
        // Números irrealmente largos (newsletter IDs tienen 18+ dígitos)
        (/^\d+$/.test(phone) && phone.length > 15)

      if (isFake) {
        batch.delete(doc.ref)
        count++
      }
    }

    if (count > 0) await batch.commit()

    return NextResponse.json({ ok: true, deleted: count })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
