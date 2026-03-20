export const dynamic = 'force-dynamic'

import { adminDb } from '@/lib/firebase-admin'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(req: NextRequest, { params }: { params: { orgId: string } }) {
  try {
    const { orgId } = params
    const data = await req.json()
    await adminDb.collection('organizations').doc(orgId).update(data)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Error updating org:', err)
    return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { orgId: string } }) {
  try {
    const { orgId } = params
    await adminDb.collection('organizations').doc(orgId).delete()
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Error deleting org:', err)
    return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 })
  }
}
