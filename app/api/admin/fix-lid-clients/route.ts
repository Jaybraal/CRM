export const dynamic = 'force-dynamic'

import { adminDb } from '@/lib/firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'
import { NextRequest, NextResponse } from 'next/server'

// Limpia clientes LID: elimina el campo phone y marca isLid: true
export async function POST(req: NextRequest) {
  try {
    const { orgId } = await req.json()
    if (!orgId) return NextResponse.json({ error: 'orgId requerido' }, { status: 400 })

    const snap = await adminDb
      .collection(`organizations/${orgId}/clients`)
      .get()

    const batch = adminDb.batch()
    let fixed = 0

    const isLidPhone = (p: unknown): boolean => {
      if (typeof p !== 'string' && typeof p !== 'number') return false
      const digits = String(p).replace(/[^\d]/g, '')
      return digits.length > 13
    }

    for (const doc of snap.docs) {
      const data = doc.data()

      const hasLidFlag = data.isLid === true
      const hasLidPhone = isLidPhone(data.phone)

      if (hasLidFlag || hasLidPhone) {
        batch.update(doc.ref, {
          phone: FieldValue.delete(),
          isLid: true,
        })
        fixed++
      }
    }

    if (fixed > 0) await batch.commit()

    return NextResponse.json({ ok: true, fixed })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
