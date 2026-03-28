export const dynamic = 'force-dynamic'

import { adminDb, getAdminAuth } from '@/lib/firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { email, password, displayName, role, orgId, whatsappPhone } = await req.json()

    if (!email || !password || !displayName || !orgId) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
    }

    const adminAuth = getAdminAuth()

    const userRecord = await adminAuth.createUser({
      email,
      password,
      displayName,
    })

    await adminDb.doc(`users/${userRecord.uid}`).set({
      uid: userRecord.uid,
      email,
      displayName,
      role: role || 'agent',
      orgId,
      whatsappPhone: whatsappPhone || null,
      whatsappSessionId: null,
      createdAt: FieldValue.serverTimestamp(),
    })

    return NextResponse.json({ ok: true, uid: userRecord.uid })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    if (msg.includes('email-already-exists')) {
      return NextResponse.json({ error: 'El email ya está en uso' }, { status: 409 })
    }
    console.error('Error creando usuario:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
