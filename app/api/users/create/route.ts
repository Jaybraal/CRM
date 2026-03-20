export const dynamic = 'force-dynamic'

import { adminDb } from '@/lib/firebase-admin'
import { getAuth } from 'firebase-admin/auth'
import { getApps, initializeApp, cert } from 'firebase-admin/app'
import { FieldValue } from 'firebase-admin/firestore'
import { NextRequest, NextResponse } from 'next/server'

function getAdminAuth() {
  // Reuse the already-initialized admin app
  const apps = getApps()
  if (!apps.length) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID!,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL!,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    })
  }
  return getAuth()
}

export async function POST(req: NextRequest) {
  try {
    const { email, password, displayName, role, orgId, whatsappPhone } = await req.json()

    if (!email || !password || !displayName || !orgId) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
    }

    const adminAuth = getAdminAuth()

    // Create auth user via Admin (does NOT affect current session)
    const userRecord = await adminAuth.createUser({
      email,
      password,
      displayName,
    })

    // Save profile to Firestore
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
