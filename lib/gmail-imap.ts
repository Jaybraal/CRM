import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'
import { adminDb, adminTimestamp } from '@/lib/firebase-admin'
import { getGmailCredentials } from '@/lib/gmail'
import { FieldValue } from 'firebase-admin/firestore'

/**
 * Revisa la bandeja IMAP de Gmail de una organización buscando respuestas
 * de leads conocidos (match por email), las guarda como mensaje bajo el
 * cliente correspondiente y detiene la secuencia de outreach automática
 * (si estaba activa) — un lead que responde no debe seguir recibiendo
 * los correos de seguimiento programados.
 */
export async function checkGmailReplies(orgId: string): Promise<{ processed: number; matched: number }> {
  const creds = await getGmailCredentials(orgId)
  if (!creds) return { processed: 0, matched: 0 }

  const tokenRef = adminDb.doc(`org_tokens/${orgId}`)
  const tokenSnap = await tokenRef.get()
  const lastUid = (tokenSnap.data()?.gmail_last_uid as number) || 0

  const client = new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: { user: creds.user, pass: creds.appPassword },
    logger: false,
  })

  let processed = 0
  let matched = 0
  let maxUid = lastUid

  await client.connect()
  try {
    const lock = await client.getMailboxLock('INBOX')
    try {
      const status = await client.status('INBOX', { uidNext: true })
      const uidNext = status.uidNext || 1

      if (lastUid === 0) {
        // Primera corrida: no reprocesar todo el historial, solo marcar el punto de partida.
        await tokenRef.set({ gmail_last_uid: uidNext - 1 }, { merge: true })
        return { processed: 0, matched: 0 }
      }
      if (uidNext - 1 <= lastUid) {
        return { processed: 0, matched: 0 }
      }

      const range = `${lastUid + 1}:${uidNext - 1}`
      for await (const msg of client.fetch(range, { envelope: true, source: true, uid: true }, { uid: true })) {
        processed++
        if (msg.uid > maxUid) maxUid = msg.uid

        const fromAddress = msg.envelope?.from?.[0]?.address?.toLowerCase().trim()
        if (!fromAddress) continue

        const clientsSnap = await adminDb
          .collection(`organizations/${orgId}/clients`)
          .where('email', '==', fromAddress)
          .limit(1)
          .get()
        if (clientsSnap.empty) continue

        const leadDoc = clientsSnap.docs[0]
        const leadData = leadDoc.data()

        const parsed = msg.source ? await simpleParser(msg.source) : null
        const text = (parsed?.text || '').trim().slice(0, 5000)
        const subject = parsed?.subject || msg.envelope?.subject || '(sin asunto)'

        await adminDb.collection(`organizations/${orgId}/clients/${leadDoc.id}/emails`).add({
          orgId,
          clientId: leadDoc.id,
          product: (leadData.product as string) || 'stod',
          subject,
          body: text,
          fromEmail: fromAddress,
          direction: 'inbound',
          provider: 'gmail',
          createdAt: adminTimestamp(),
        })

        await leadDoc.ref.set(
          {
            lastMessage: text ? `Respondió: ${text.slice(0, 120)}` : `Respondió: ${subject}`,
            lastMessageAt: FieldValue.serverTimestamp(),
            unreadCount: FieldValue.increment(1),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        )

        // Un lead que responde no debe seguir recibiendo la secuencia automática.
        if (leadData.outreachStatus === 'enrolled') {
          const seqRef = adminDb.collection(`organizations/${orgId}/clients/${leadDoc.id}/outreach_emails`)
          const pending = await seqRef.where('status', '==', 'pending').get()
          const batch = adminDb.batch()
          pending.docs.forEach(d => batch.update(d.ref, { status: 'stopped', updatedAt: FieldValue.serverTimestamp() }))
          if (!pending.empty) await batch.commit()
          await leadDoc.ref.set({ outreachStatus: 'stopped', repliedAt: adminTimestamp() }, { merge: true })
        }

        matched++
      }
    } finally {
      lock.release()
    }
  } finally {
    await client.logout().catch(() => client.close())
  }

  if (maxUid > lastUid) {
    await tokenRef.set({ gmail_last_uid: maxUid }, { merge: true })
  }

  return { processed, matched }
}
