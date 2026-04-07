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

    // ── Auto-renovar tokens de Meta que expiran en < 7 días ──────────────────
    const appId = process.env.META_APP_ID
    const appSecret = process.env.META_APP_SECRET
    if (appId && appSecret) {
      const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      const expiringSnaps = await adminDb.collection('org_tokens')
        .where('wa_token_expires_at', '<=', sevenDaysFromNow)
        .where('wa_token', '!=', '')
        .get()

      for (const tokenDoc of expiringSnaps.docs) {
        const { wa_token } = tokenDoc.data()
        if (!wa_token) continue
        try {
          const url = `https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${wa_token}`
          const res = await fetch(url)
          if (res.ok) {
            const data = await res.json()
            if (data.access_token) {
              const expiresIn = data.expires_in || (60 * 24 * 60 * 60)
              const expiresAt = new Date(Date.now() + expiresIn * 1000)
              await tokenDoc.ref.update({
                wa_token: data.access_token,
                wa_token_expires_at: expiresAt,
                updatedAt: FieldValue.serverTimestamp(),
              })
              console.log('[cron] Token renovado para org:', tokenDoc.id, '| expira:', expiresAt.toISOString())
            }
          }
        } catch (e) {
          console.error('[cron] Error renovando token para org:', tokenDoc.id, e)
        }
      }
    }

    return NextResponse.json({ ok: true, sent, failed, total: pending.size })
  } catch (err) {
    console.error('Cron send-scheduled error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
