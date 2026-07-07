export const dynamic = 'force-dynamic'

import { adminDb, adminTimestamp } from '@/lib/firebase-admin'
import { requireSuperAdminJWT } from '@/lib/admin-auth'
import { STOD_SEED_LEADS } from '@/lib/data/stod-leads'
import { NextRequest, NextResponse } from 'next/server'

// POST /api/admin/seed-stod-leads  body: { orgId, assignedTo }
// Carga los 13 leads iniciales de STOD como clientes en la org indicada.
// Deduplica por email para ser idempotente (re-ejecutar no crea duplicados).
export async function POST(req: NextRequest) {
  if (!(await requireSuperAdminJWT(req))) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }
  try {
    const { orgId, assignedTo } = (await req.json()) as { orgId: string; assignedTo?: string }
    if (!orgId) return NextResponse.json({ error: 'orgId requerido' }, { status: 400 })

    const clientsRef = adminDb.collection('organizations').doc(orgId).collection('clients')

    // Emails ya existentes en la org, para no duplicar.
    const existing = await clientsRef.get()
    const existingEmails = new Set(
      existing.docs.map(d => (d.data().email as string || '').toLowerCase()).filter(Boolean)
    )

    let created = 0
    let skipped = 0
    const batch = adminDb.batch()

    for (const lead of STOD_SEED_LEADS) {
      if (existingEmails.has(lead.email.toLowerCase())) {
        skipped++
        continue
      }
      const ref = clientsRef.doc()
      batch.set(ref, {
        orgId,
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        website: lead.website || '',
        city: lead.city,
        country: lead.country,
        specialty: lead.specialty,
        language: lead.language,
        product: 'stod',
        discoverySource: 'manual',
        notes: lead.notes || '',
        status: 'nuevo',
        pipelineStage: 'nuevo',
        tags: ['lead-engine', 'stod'],
        photos: [],
        source: 'lead-engine',
        assignedTo: assignedTo || '',
        createdBy: 'lead-engine',
        createdAt: adminTimestamp(),
        updatedAt: adminTimestamp(),
      })
      created++
    }

    if (created > 0) await batch.commit()

    return NextResponse.json({ ok: true, created, skipped, total: STOD_SEED_LEADS.length })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[seed-stod-leads]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
