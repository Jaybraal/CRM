export const dynamic = 'force-dynamic'

import { adminDb } from '@/lib/firebase-admin'
import { NextRequest, NextResponse } from 'next/server'

function corsHeaders(allowedOrigin: string) {
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  }
}

async function getAllowedOrigin(orgId: string, reqOrigin: string | null): Promise<string> {
  try {
    const snap = await adminDb.doc(`organizations/${orgId}`).get()
    const websiteUrl: string = snap.data()?.settings?.websiteUrl || ''
    if (!websiteUrl) return reqOrigin || '*'
    // Normalize: strip trailing slash
    const registered = websiteUrl.replace(/\/$/, '')
    const incoming = (reqOrigin || '').replace(/\/$/, '')
    return incoming === registered ? registered : registered
  } catch {
    return reqOrigin || '*'
  }
}

export async function OPTIONS(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params
  const origin = await getAllowedOrigin(orgId, req.headers.get('origin'))
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) })
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params
  const reqOrigin = req.headers.get('origin')
  const date = req.nextUrl.searchParams.get('date') // "YYYY-MM-DD"

  if (!date) {
    return NextResponse.json({ slots: [] }, { headers: corsHeaders(reqOrigin || '*') })
  }

  try {
    const orgSnap = await adminDb.doc(`organizations/${orgId}`).get()
    if (!orgSnap.exists) {
      return NextResponse.json({ slots: [] }, { headers: corsHeaders(reqOrigin || '*') })
    }

    const settings = orgSnap.data()?.settings || {}
    const websiteUrl: string = (settings.websiteUrl || '').replace(/\/$/, '')
    const cors = corsHeaders(websiteUrl || reqOrigin || '*')

    const bh = settings.businessHours
    if (!bh) {
      return NextResponse.json({ slots: [] }, { headers: cors })
    }

    // Check day of week (noon to avoid timezone issues)
    const dateObj = new Date(`${date}T12:00:00`)
    const dayOfWeek = dateObj.getDay()
    if (!bh.days.includes(dayOfWeek)) {
      return NextResponse.json({ slots: [] }, { headers: cors })
    }

    // Generate all slots
    const [openH, openM] = (bh.openTime as string).split(':').map(Number)
    const [closeH, closeM] = (bh.closeTime as string).split(':').map(Number)
    const slotMin: number = bh.slotMinutes || 60
    const closeTotal = closeH * 60 + closeM

    const allSlots: string[] = []
    let cur = openH * 60 + openM
    while (cur + slotMin <= closeTotal) {
      allSlots.push(
        `${String(Math.floor(cur / 60)).padStart(2, '0')}:${String(cur % 60).padStart(2, '0')}`
      )
      cur += slotMin
    }

    // Get booked slots for that date
    const startOfDay = new Date(`${date}T00:00:00`)
    const endOfDay = new Date(`${date}T23:59:59`)

    const apptSnap = await adminDb
      .collection(`organizations/${orgId}/appointments`)
      .where('startDate', '>=', startOfDay)
      .where('startDate', '<=', endOfDay)
      .get()

    const booked = new Set(
      apptSnap.docs.map(d => {
        const raw = d.data().startDate
        const dt: Date = raw?.toDate ? raw.toDate() : new Date(raw)
        return `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`
      })
    )

    const available = allSlots.filter(s => !booked.has(s))
    return NextResponse.json({ slots: available }, { headers: cors })
  } catch (e) {
    console.error('[slots]', e)
    return NextResponse.json({ slots: [] }, { headers: corsHeaders(reqOrigin || '*') })
  }
}
