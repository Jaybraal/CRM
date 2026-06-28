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

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ uid: string }> }) {
  if (!(await requireSuperAdmin(req))) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }
  try {
    const { uid } = await params
    const data = await req.json()
    await adminDb.collection('users').doc(uid).update(data)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Error updating user:', err)
    return NextResponse.json({ error: 'Error al actualizar usuario' }, { status: 500 })
  }
}
