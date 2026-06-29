export const dynamic = 'force-dynamic'

import { adminDb } from '@/lib/firebase-admin'
import { requireSuperAdminJWT } from '@/lib/admin-auth'
import { NextRequest, NextResponse } from 'next/server'

async function requireSuperAdmin(req: NextRequest): Promise<boolean> {
  return requireSuperAdminJWT(req)
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
