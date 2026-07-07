import { NextRequest, NextResponse } from 'next/server'
import { adminDb, adminTimestamp } from '@/lib/firebase-admin'
import { sendGmail } from '@/lib/gmail'

// POST /api/email/send-gmail — envía un email por Gmail SMTP y guarda el hilo.
export async function POST(req: NextRequest) {
  try {
    const { orgId, clientId, toEmail, toName, subject, body, fromName, unsubscribeNote } =
      (await req.json()) as {
        orgId: string
        clientId?: string
        toEmail: string
        toName?: string
        subject: string
        body: string
        fromName?: string
        unsubscribeNote?: string
      }

    if (!orgId || !toEmail || !subject || !body) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
    }

    const { messageId } = await sendGmail({
      orgId,
      toEmail,
      toName,
      subject,
      body,
      fromName,
      unsubscribeNote,
    })

    // Guardar el hilo bajo el cliente (mismo esquema que el envío Resend existente).
    if (clientId) {
      await adminDb
        .collection('organizations').doc(orgId)
        .collection('clients').doc(clientId)
        .collection('emails').add({
          orgId, clientId, subject, body,
          fromName: fromName || 'STOD',
          toEmail,
          direction: 'outbound',
          provider: 'gmail',
          messageId,
          createdAt: adminTimestamp(),
        })
    }

    console.log(`[email/send-gmail] org=${orgId} client=${clientId ?? '-'} to=${toEmail}`)
    return NextResponse.json({ ok: true, messageId })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[email/send-gmail]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
