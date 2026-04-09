export const dynamic = 'force-dynamic'
import { adminDb } from '@/lib/firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'
import { NextRequest, NextResponse } from 'next/server'

const BAILEYS_URL = (process.env.BAILEYS_URL || 'http://localhost:3001').trim()

// GET /api/debug — info de entorno + estado de sesiones en Baileys
export async function GET() {
  const pk = process.env.FIREBASE_ADMIN_PRIVATE_KEY || ''
  let baileysSessions = null
  try {
    const res = await fetch(`${BAILEYS_URL}/debug`, { signal: AbortSignal.timeout(5000) })
    baileysSessions = await res.json()
  } catch { /* Baileys no disponible */ }

  return NextResponse.json({
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID || 'MISSING',
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL || 'MISSING',
    privateKeyLength: pk.length,
    baileysUrl: process.env.BAILEYS_URL || 'MISSING',
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'MISSING',
    baileysSessions,
  })
}

// POST /api/debug — fijar orgId en Firestore + sesión en vivo
export async function POST(req: NextRequest) {
  try {
    const { sessionId, orgId } = await req.json()
    if (!sessionId || !orgId) return NextResponse.json({ error: 'sessionId y orgId requeridos' }, { status: 400 })

    // 1. Actualizar Firestore
    await adminDb.collection('whatsapp_sessions').doc(sessionId).set(
      { orgId, updatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    )

    // 2. Actualizar sesión en vivo en Baileys
    let baileysResult = null
    try {
      const res = await fetch(`${BAILEYS_URL}/set-org/${sessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId }),
        signal: AbortSignal.timeout(5000),
      })
      baileysResult = await res.json()
    } catch { /* Baileys no disponible */ }

    return NextResponse.json({ ok: true, sessionId, orgId, baileysResult })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
