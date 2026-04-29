import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string; formId: string }> }
) {
  try {
    const { orgId, formId } = await params
    const snap = await adminDb
      .collection('organizations')
      .doc(orgId)
      .collection('forms')
      .doc(formId)
      .get()

    if (!snap.exists) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const form = { id: snap.id, ...snap.data() }
    return NextResponse.json({ form })
  } catch (e) {
    console.error('[forms/GET]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
