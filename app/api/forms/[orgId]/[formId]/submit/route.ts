import { NextRequest, NextResponse } from 'next/server'
import { adminDb, adminTimestamp } from '@/lib/firebase-admin'
import type { CaptureForm, CaptureFormField } from '@/types'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; formId: string }> }
) {
  try {
    const { values } = await req.json() as { values: Record<string, string> }
    const { orgId, formId } = await params

    const snap = await adminDb.collection('organizations').doc(orgId).collection('forms').doc(formId).get()
    if (!snap.exists) return NextResponse.json({ error: 'Formulario no encontrado' }, { status: 404 })

    const form = { id: snap.id, ...snap.data() } as CaptureForm
    if (!form.active) return NextResponse.json({ error: 'Formulario inactivo' }, { status: 400 })

    // Build client data from field mappings
    const clientData: Record<string, string> = { status: form.defaultStatus || 'lead' }
    let clientName = ''

    form.fields.forEach((field: CaptureFormField) => {
      const val = values[field.id]?.trim()
      if (!val) return
      if (field.mapTo) clientData[field.mapTo] = val
      if (field.mapTo === 'name') clientName = val
      if (!field.mapTo && !clientName && field.type === 'text') clientName = val
    })

    if (!clientName) clientName = values[form.fields[0]?.id] || 'Lead desde formulario'
    clientData.name = clientData.name || clientName

    // Save as notes the raw fields without mapping
    const notes = form.fields
      .filter(f => !f.mapTo)
      .map(f => `${f.label}: ${values[f.id] || ''}`)
      .filter(Boolean)
      .join('\n')
    if (notes) clientData.notes = notes

    // Create client in Firestore
    await adminDb.collection('organizations').doc(orgId).collection('clients').add({
      ...clientData,
      orgId,
      tags: [],
      photos: [],
      source: 'form',
      formId,
      assignedTo: form.assignTo || '',
      createdBy: 'form',
      createdAt: adminTimestamp(),
      updatedAt: adminTimestamp(),
    })

    // Increment submission count
    await adminDb.collection('organizations').doc(orgId).collection('forms').doc(formId).update({
      submissionCount: (form.submissionCount || 0) + 1,
    })

    // Fire webhooks for new_client event
    try {
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL || ''}/api/webhooks/trigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId, event: 'new_client', data: { name: clientName, source: 'form' } }),
      })
    } catch { /* webhook failure non-critical */ }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[form/submit]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
