export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'

const BAILEYS_URL = (process.env.BAILEYS_URL || 'http://localhost:3002').trim()

// GET /api/whatsapp/sessions - list all sessions
export async function GET() {
  try {
    const res = await fetch(`${BAILEYS_URL}/sessions`)
    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json([])
  }
}
