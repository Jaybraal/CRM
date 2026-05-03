export const dynamic = 'force-dynamic'

import { adminDb } from '@/lib/firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/settings?orgId=X&action=get_ig_status
export async function GET(req: NextRequest) {
  try {
    const orgId = req.nextUrl.searchParams.get('orgId')
    const action = req.nextUrl.searchParams.get('action')

    if (!orgId) return NextResponse.json({ error: 'orgId requerido' }, { status: 400 })

    if (action === 'get_ig_status') {
      const snap = await adminDb.doc(`org_tokens/${orgId}`).get()
      const data = snap.exists ? snap.data() : null
      const configured = !!(data?.ig_token && data?.ig_page_id && data.ig_token !== '' && data.ig_page_id !== '')
      return NextResponse.json({ configured })
    }

    return NextResponse.json({ error: 'Acción no reconocida' }, { status: 400 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// POST /api/settings — guardar plantilla o respuesta automática
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { orgId, action } = body

    if (!orgId) return NextResponse.json({ error: 'orgId requerido' }, { status: 400 })

    if (action === 'save_template') {
      const { name, body: text } = body
      if (!name || !text) return NextResponse.json({ error: 'Faltan campos' }, { status: 400 })
      const ref = await adminDb
        .collection(`organizations/${orgId}/whatsapp_templates`)
        .add({ name, body: text, createdAt: FieldValue.serverTimestamp() })
      return NextResponse.json({ ok: true, id: ref.id })
    }

    if (action === 'delete_template') {
      const { templateId } = body
      if (!templateId) return NextResponse.json({ error: 'templateId requerido' }, { status: 400 })
      await adminDb.doc(`organizations/${orgId}/whatsapp_templates/${templateId}`).delete()
      return NextResponse.json({ ok: true })
    }

    if (action === 'save_autoreply') {
      const { enabled, message } = body
      await adminDb.doc(`organizations/${orgId}`).set(
        { settings: { autoReply: { enabled: !!enabled, message: message || '' } } },
        { merge: true }
      )
      return NextResponse.json({ ok: true })
    }

    if (action === 'save_org') {
      const { name, industry, whatsappNumber } = body
      const settings: Record<string, unknown> = { industry }
      if (whatsappNumber !== undefined) settings.whatsappNumber = whatsappNumber
      await adminDb.doc(`organizations/${orgId}`).set(
        { name, settings },
        { merge: true }
      )
      return NextResponse.json({ ok: true })
    }

    if (action === 'save_pipeline_stage') {
      const { stages } = body
      await adminDb.doc(`organizations/${orgId}`).set(
        { settings: { pipelineStages: stages } },
        { merge: true }
      )
      return NextResponse.json({ ok: true })
    }

    if (action === 'save_qualification_form') {
      const { form } = body
      await adminDb.doc(`organizations/${orgId}`).set(
        { settings: { qualificationForm: form } },
        { merge: true }
      )
      return NextResponse.json({ ok: true })
    }

    if (action === 'save_client_statuses') {
      const { statuses } = body
      if (!Array.isArray(statuses)) return NextResponse.json({ error: 'statuses debe ser un array' }, { status: 400 })
      await adminDb.doc(`organizations/${orgId}`).set(
        { settings: { clientStatuses: statuses } },
        { merge: true }
      )
      return NextResponse.json({ ok: true })
    }

    if (action === 'save_window_message') {
      const { enabled, message, delayHours } = body
      await adminDb.doc(`organizations/${orgId}`).set(
        { settings: { windowMessage: { enabled: !!enabled, message: message || '', delayHours: Number(delayHours) || 23 } } },
        { merge: true }
      )
      return NextResponse.json({ ok: true })
    }

    if (action === 'save_ig_tokens') {
      const { ig_token, ig_page_id } = body
      if (!ig_token || !ig_page_id) return NextResponse.json({ error: 'Faltan ig_token o ig_page_id' }, { status: 400 })
      await adminDb.doc(`org_tokens/${orgId}`).set(
        { ig_token: ig_token.trim(), ig_page_id: ig_page_id.trim(), updatedAt: FieldValue.serverTimestamp() },
        { merge: true }
      )
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Acción no reconocida' }, { status: 400 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('settings API error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
