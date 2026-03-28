export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'

export async function GET() {
  const pk = process.env.FIREBASE_ADMIN_PRIVATE_KEY || ''
  return NextResponse.json({
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID || 'MISSING',
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL || 'MISSING',
    privateKeyLength: pk.length,
    privateKeyStart: pk.slice(0, 30),
    privateKeyEnd: pk.slice(-20),
    baileysUrl: process.env.BAILEYS_URL || 'MISSING',
  })
}
