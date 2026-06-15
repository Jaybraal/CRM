export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'

const BAILEYS_URL = (process.env.BAILEYS_URL || 'http://localhost:3002').trim()

// GET /api/whatsapp/status?sessionId=xxx - check session status without triggering connect
export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('sessionId') || 'default'
  try {
    const res = await fetch(`${BAILEYS_URL}/status/${sessionId}`)
    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ status: 'disconnected', connected: false })
  }
}
