export const dynamic = 'force-dynamic'

import { adminDb, adminTimestamp } from '@/lib/firebase-admin'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { NextRequest, NextResponse } from 'next/server'
import { sendGmail } from '@/lib/gmail'

// GET /api/cron/send-outreach — Vercel Cron (recomendado: 1 vez al día por la mañana).
// Envía los pasos de outreach (día 0/5/10/20) cuyo sendAt ya venció, vía Gmail.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = Timestamp.now()
  let sent = 0
  let failed = 0

  try {
    const pending = await adminDb
      .collectionGroup('outreach_emails')
      .where('status', '==', 'pending')
      .where('sendAt', '<=', now)
      .limit(50)
      .get()

    for (const docSnap of pending.docs) {
      const data = docSnap.data()
      const { orgId, clientId, subject, body } = data

      try {
        // Datos del cliente (email destino + nombre).
        const clientSnap = await adminDb.doc(`organizations/${orgId}/clients/${clientId}`).get()
        const client = clientSnap.data()
        const toEmail = client?.email as string | undefined

        if (!toEmail) {
          await docSnap.ref.update({ status: 'failed', failReason: 'client_sin_email', updatedAt: FieldValue.serverTimestamp() })
          failed++
          continue
        }

        const { messageId } = await sendGmail({
          orgId,
          toEmail,
          toName: client?.name as string | undefined,
          subject,
          body,
          fromName: 'Marck — STOD',
        })

        // Guardar el hilo bajo el cliente (mismo esquema que send-gmail).
        await adminDb
          .collection(`organizations/${orgId}/clients/${clientId}/emails`)
          .add({
            orgId, clientId, subject, body,
            fromName: 'Marck — STOD',
            toEmail,
            direction: 'outbound',
            provider: 'gmail',
            messageId,
            outreachStep: data.step,
            createdAt: adminTimestamp(),
          })

        await docSnap.ref.update({ status: 'sent', sentAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() })
        await adminDb.doc(`organizations/${orgId}/clients/${clientId}`).set(
          { lastMessage: `Outreach día ${data.step} enviado`, lastMessageAt: FieldValue.serverTimestamp() },
          { merge: true }
        ).catch(() => {})
        sent++
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        console.error('[cron/send-outreach]', docSnap.id, msg)
        await docSnap.ref.update({ status: 'failed', failReason: msg, updatedAt: FieldValue.serverTimestamp() }).catch(() => {})
        failed++
      }
    }

    return NextResponse.json({ ok: true, sent, failed, total: pending.size })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[cron/send-outreach] fatal', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
