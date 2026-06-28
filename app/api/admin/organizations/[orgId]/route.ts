export const dynamic = 'force-dynamic'

import { adminDb } from '@/lib/firebase-admin'
import { NextRequest, NextResponse } from 'next/server'

const SUPER_ADMIN_UID = process.env.NEXT_PUBLIC_SUPER_ADMIN_UID

async function requireSuperAdmin(req: NextRequest): Promise<boolean> {
  const uid = req.headers.get('x-user-uid')
  if (!uid) return false
  if (uid === SUPER_ADMIN_UID) return true
  const snap = await adminDb.doc(`users/${uid}`).get()
  return snap.data()?.role === 'super_admin'
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  if (!(await requireSuperAdmin(req))) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }
  try {
    const { orgId } = await params
    const data = await req.json()
    // Convert ISO string to Date so Firestore stores it as a Timestamp
    if (data.accessExpiresAt) {
      data.accessExpiresAt = new Date(data.accessExpiresAt)
    } else if (data.accessExpiresAt === null) {
      const { FieldValue } = await import('firebase-admin/firestore')
      data.accessExpiresAt = FieldValue.delete()
    }
    await adminDb.collection('organizations').doc(orgId).update(data)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Error updating org:', err)
    return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  if (!(await requireSuperAdmin(req))) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }
  try {
    const { orgId } = await params
    await adminDb.collection('organizations').doc(orgId).delete()
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Error deleting org:', err)
    return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 })
  }
}
