export const dynamic = 'force-dynamic'

import { adminDb } from '@/lib/firebase-admin'
import { NextRequest, NextResponse } from 'next/server'

// Endpoint público — devuelve solo el nombre de la organización para el catálogo público
export async function GET(_req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params
  if (!orgId) return NextResponse.json({ name: null }, { status: 400 })

  try {
    const snap = await adminDb.doc(`organizations/${orgId}`).get()
    if (!snap.exists) return NextResponse.json({ name: null }, { status: 404 })
    const name = snap.data()?.name || null
    return NextResponse.json({ name })
  } catch {
    return NextResponse.json({ name: null }, { status: 500 })
  }
}
