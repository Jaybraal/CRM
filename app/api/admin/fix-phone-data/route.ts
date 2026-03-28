export const dynamic = 'force-dynamic'

import { adminDb } from '@/lib/firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'
import { NextRequest, NextResponse } from 'next/server'

// Limpia campos de teléfono con datos corruptos (texto en lugar de número)
export async function POST(req: NextRequest) {
  try {
    const { orgId } = await req.json()
    if (!orgId) return NextResponse.json({ error: 'orgId requerido' }, { status: 400 })

    const snap = await adminDb
      .collection(`organizations/${orgId}/clients`)
      .get()

    const batch = adminDb.batch()
    let fixed = 0

    const isValidPhone = (p: string) => {
      const digits = p.replace(/[^\d]/g, '')
      return digits.length >= 7 && digits.length <= 15
    }

    for (const doc of snap.docs) {
      const data = doc.data()
      const updates: Record<string, unknown> = {}

      // Fix whatsappPhone
      if (data.whatsappPhone && !isValidPhone(data.whatsappPhone)) {
        updates.whatsappPhone = FieldValue.delete()
      }

      // Fix phone: only clear if it looks like non-numeric text (not a phone number)
      if (data.phone && !isValidPhone(data.phone)) {
        updates.phone = FieldValue.delete()
      }

      if (Object.keys(updates).length > 0) {
        batch.update(doc.ref, updates)
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
