export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'

const BAILEYS_URL = (process.env.BAILEYS_URL || 'http://localhost:3001').trim()

// GET /api/whatsapp/sessions/[sessionId]?orgId=xxx - get status + QR
export async function GET(req: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params
  const orgId = req.nextUrl.searchParams.get('orgId') || ''
  try {
    // Leer estado actual sin reconectar
    const qrRes = await fetch(`${BAILEYS_URL}/qr/${sessionId}`)
    const data = await qrRes.json()

    // Solo iniciar sesión si está desconectada o no existe
    if (data.status === 'disconnected' || data.status === 'not_found') {
      await fetch(`${BAILEYS_URL}/connect/${sessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId }),
      })
    }

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
