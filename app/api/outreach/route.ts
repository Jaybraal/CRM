export const dynamic = 'force-dynamic'

import { adminDb, adminTimestamp } from '@/lib/firebase-admin'
import { requireSuperAdminJWT } from '@/lib/admin-auth'
import { Timestamp, FieldValue } from 'firebase-admin/firestore'
import { NextRequest, NextResponse } from 'next/server'
import { renderTemplate } from '@/lib/outreach/templates'
import { personalizeObservation } from '@/lib/outreach/personalize'
import { getCampaign } from '@/lib/outreach/campaigns'
import type { OutreachLanguage, LeadSignals } from '@/types'

const DAY_MS = 24 * 60 * 60 * 1000

interface ClientLite {
  name: string
  language: OutreachLanguage
  website?: string
  signals?: LeadSignals
  product?: string
  specialty?: string
}

async function loadClient(orgId: string, clientId: string): Promise<ClientLite | null> {
  const snap = await adminDb.doc(`organizations/${orgId}/clients/${clientId}`).get()
  if (!snap.exists) return null
  const d = snap.data() || {}
  return {
    name: (d.name as string) || 'el negocio',
    language: ((d.language as OutreachLanguage) || 'es'),
    website: d.website as string | undefined,
    signals: d.signals as LeadSignals | undefined,
    product: d.product as string | undefined,
    specialty: d.specialty as string | undefined,
  }
}

async function renderSequence(client: ClientLite) {
  const campaign = getCampaign(client.product)
  const observation = await personalizeObservation({
    clinicName: client.name,
    language: client.language,
    website: client.website,
    signals: client.signals,
    industryLabel: client.specialty || campaign.industryLabel,
  })
  return campaign.steps.map(step => {
    const { subject, body } = renderTemplate(campaign.templates, client.language, step, {
      clinicName: client.name,
      observation,
    })
    return { step, subject, body, language: client.language }
  })
}

// POST /api/outreach  body: { action, orgId, clientId }
export async function POST(req: NextRequest) {
  if (!(await requireSuperAdminJWT(req))) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }
  try {
    const { action, orgId, clientId } = (await req.json()) as {
      action: string; orgId: string; clientId: string
    }
    if (!orgId || !clientId) {
      return NextResponse.json({ error: 'orgId y clientId requeridos' }, { status: 400 })
    }

    // Previsualiza la secuencia (sin efectos). El usuario revisa antes de activar.
    if (action === 'preview') {
      const client = await loadClient(orgId, clientId)
      if (!client) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
      const emails = await renderSequence(client)
      return NextResponse.json({ ok: true, clinic: client.name, emails })
    }

    // Activa la secuencia: crea los 4 pasos (día 0/5/10/20) como 'pending'.
    // Este es el gate humano — nada se envía hasta que se llama 'enroll'.
    if (action === 'enroll') {
      const client = await loadClient(orgId, clientId)
      if (!client) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })

      const seqRef = adminDb.collection(`organizations/${orgId}/clients/${clientId}/outreach_emails`)
      const existing = await seqRef.where('status', 'in', ['pending', 'sent']).limit(1).get()
      if (!existing.empty) {
        return NextResponse.json({ error: 'Este lead ya tiene una secuencia activa' }, { status: 409 })
      }

      const emails = await renderSequence(client)
      const now = Date.now()
      const batch = adminDb.batch()
      for (const e of emails) {
        const ref = seqRef.doc()
        batch.set(ref, {
          orgId, clientId,
          step: e.step,
          language: e.language,
          subject: e.subject,
          body: e.body,
          status: 'pending',
          sendAt: Timestamp.fromMillis(now + e.step * DAY_MS),
          createdAt: adminTimestamp(),
        })
      }
      await batch.commit()
      await adminDb.doc(`organizations/${orgId}/clients/${clientId}`).set(
        { outreachStatus: 'enrolled', updatedAt: adminTimestamp() }, { merge: true }
      )
      return NextResponse.json({ ok: true, steps: emails.length })
    }

    // Detiene la secuencia (ej. cuando el lead responde).
    if (action === 'stop') {
      const seqRef = adminDb.collection(`organizations/${orgId}/clients/${clientId}/outreach_emails`)
      const pending = await seqRef.where('status', '==', 'pending').get()
      const batch = adminDb.batch()
      pending.docs.forEach(d => batch.update(d.ref, { status: 'stopped', updatedAt: FieldValue.serverTimestamp() }))
      if (!pending.empty) await batch.commit()
      await adminDb.doc(`organizations/${orgId}/clients/${clientId}`).set(
        { outreachStatus: 'stopped', updatedAt: adminTimestamp() }, { merge: true }
      )
      return NextResponse.json({ ok: true, stopped: pending.size })
    }

    return NextResponse.json({ error: 'Acción no reconocida' }, { status: 400 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[outreach]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
