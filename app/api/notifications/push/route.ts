import { NextRequest, NextResponse } from 'next/server'
import { sendFCMToOrg, adminDb, adminTimestamp } from '@/lib/firebase-admin'

export async function POST(req: NextRequest) {
  try {
    const { orgId, title, body, url } = await req.json() as {
      orgId: string; title: string; body: string; url?: string
    }

    // Save in-app notification to Firestore (works even without FCM)
    await adminDb.collection('organizations').doc(orgId).collection('notifications').add({
      title, body, url: url || '/dashboard/clients',
      read: false, createdAt: adminTimestamp(),
    })

    // Fire FCM push (non-blocking)
    sendFCMToOrg(orgId, title, body, url || '/dashboard/clients').catch(() => {})

    console.log(`[notifications/push] org=${orgId} title=${title}`)
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[notifications/push]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
