export const dynamic = 'force-dynamic'
import { adminDb } from '@/lib/firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const pk = process.env.FIREBASE_ADMIN_PRIVATE_KEY || ''
  return NextResponse.json({
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID || 'MISSING',
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL || 'MISSING',
    privateKeyLength: pk.length,
    privateKeyStart: pk.slice(0, 30),
    privateKeyEnd: pk.slice(-20),
    baileysUrl: process.env.BAILEYS_URL || 'MISSING',
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'MISSING',
  })
}

// POST /api/debug — fijar orgId en sesión de Firestore (recuperación)
export async function POST(req: NextRequest) {
  try {
    const { sessionId, orgId } = await req.json()
    if (!sessionId || !orgId) return NextResponse.json({ error: 'sessionId y orgId requeridos' }, { status: 400 })
    await adminDb.collection('whatsapp_sessions').doc(sessionId).set(
      { orgId, status: 'connected', updatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    )
    return NextResponse.json({ ok: true, sessionId, orgId })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
