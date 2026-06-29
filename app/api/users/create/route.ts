export const dynamic = 'force-dynamic'

import { adminDb, getAdminAuth } from '@/lib/firebase-admin'
import { verifyFirebaseToken } from '@/lib/admin-auth'
import { FieldValue } from 'firebase-admin/firestore'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    // Solo super_admin, owner o manager pueden crear usuarios
    const callerUid = await verifyFirebaseToken(req)
    if (!callerUid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const callerSnap = await adminDb.doc(`users/${callerUid}`).get()
    const callerRole = callerSnap.data()?.role
    const isSuperAdmin = callerUid === process.env.SUPER_ADMIN_UID
    if (!isSuperAdmin && callerRole !== 'super_admin' && callerRole !== 'owner' && callerRole !== 'manager') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { email, password, displayName, role, orgId, whatsappPhone } = await req.json()

    if (!email || !password || !displayName || !orgId) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
    }

    // Managers solo pueden crear agentes, no owners ni admins
    if (callerRole === 'manager' && (role === 'owner' || role === 'super_admin' || role === 'manager')) {
      return NextResponse.json({ error: 'No puedes crear usuarios con ese rol' }, { status: 403 })
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
