export const dynamic = 'force-dynamic'

import { adminDb } from '@/lib/firebase-admin'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/cron/send-scheduled — ejecutado por Vercel Cron cada 5 minutos
export async function GET(req: NextRequest) {
  // Verificar que viene de Vercel Cron (o de un secreto interno)
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = Timestamp.now()
  let sent = 0
  let failed = 0

  try {
    // Buscar mensajes pendientes cuyo sendAt ya pasó, en todas las orgs
    const pending = await adminDb
      .collectionGroup('scheduled_messages')
      .where('status', '==', 'pending')
      .where('sendAt', '<=', now)
      .limit(50)
      .get()

    for (const docSnap of pending.docs) {
      const data = docSnap.data()
      const { orgId, whatsappPhone, message } = data

      try {
        // Leer tokens de la org
        const tokenSnap = await adminDb.doc(`org_tokens/${orgId}`).get()
        const tokenData = tokenSnap.data() || {}
        const phoneNumberId = (tokenData.wa_phone_number_id as string) || ''
        const waToken = (tokenData.wa_token as string) || ''

        if (!phoneNumberId || !waToken || !whatsappPhone || !message) {
          await docSnap.ref.update({ status: 'failed', failReason: 'missing_config', updatedAt: FieldValue.serverTimestamp() })
          failed++
          continue
        }

        const to = whatsappPhone.replace(/@.+$/, '').replace(/^\+/, '')
        const metaRes = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${waToken}` },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to,
            type: 'text',
            text: { body: message, preview_url: false },
          }),
        })

        if (metaRes.ok) {
          const metaData = await metaRes.json().catch(() => ({}))
          // Guardar mensaje en historial del cliente
          await adminDb.collection(`organizations/${orgId}/clients/${data.clientId}/messages`).add({
            orgId,
            clientId: data.clientId,
            type: 'text',
            text: message,
            photos: [],
            senderId: 'system',
            senderName: 'Auto',
            source: 'whatsapp',
            status: 'sent',
            whatsappMsgId: metaData?.messages?.[0]?.id || null,
            createdAt: FieldValue.serverTimestamp(),
          })
          await adminDb.doc(`organizations/${orgId}/clients/${data.clientId}`).update({
            lastMessage: message.substring(0, 100),
            lastMessageAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          }).catch(() => {})
          await docSnap.ref.update({ status: 'sent', updatedAt: FieldValue.serverTimestamp() })
          sent++
        } else {
          const err = await metaRes.json().catch(() => ({}))
          await docSnap.ref.update({ status: 'failed', failReason: err?.error?.message || 'meta_error', updatedAt: FieldValue.serverTimestamp() })
          failed++
        }
      } catch (e) {
        console.error('Error sending scheduled message:', docSnap.id, e)
        await docSnap.ref.update({ status: 'failed', failReason: String(e), updatedAt: FieldValue.serverTimestamp() }).catch(() => {})
        failed++
      }
    }

    return NextResponse.json({ ok: true, sent, failed, total: pending.size })
  } catch (err) {
    console.error('Cron send-scheduled error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
