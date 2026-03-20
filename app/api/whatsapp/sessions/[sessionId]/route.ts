export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'

const BAILEYS_URL = process.env.BAILEYS_URL || 'http://localhost:3001'

// GET /api/whatsapp/sessions/[sessionId] - get status + QR
export async function GET(req: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params
  try {
    // Initiate connection if not started
    await fetch(`${BAILEYS_URL}/connect/${sessionId}`, { method: 'POST' })
    // Get QR
    const qrRes = await fetch(`${BAILEYS_URL}/qr/${sessionId}`)
    const data = await qrRes.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ status: 'disconnected', qr: null })
  }
}

// DELETE /api/whatsapp/sessions/[sessionId] - disconnect session
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params
  try {
    const res = await fetch(`${BAILEYS_URL}/session/${sessionId}`, { method: 'DELETE' })
    const data = await res.json()
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: 'Error al desconectar' }, { status: 500 })
  }
}
