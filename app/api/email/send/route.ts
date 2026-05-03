import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { adminDb, adminTimestamp } from '@/lib/firebase-admin'

export async function POST(req: NextRequest) {
  try {
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ error: 'Email no configurado. Añade RESEND_API_KEY al .env.local' }, { status: 503 })
    }

    const { orgId, clientId, toEmail, toName, subject, body, fromName } = await req.json() as {
      orgId: string; clientId: string; toEmail: string; toName?: string
      subject: string; body: string; fromName?: string
    }

    if (!toEmail || !subject || !body) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
    }

    const resend = new Resend(process.env.RESEND_API_KEY)
    const fromDomain = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'

    await resend.emails.send({
      from: fromName ? `${fromName} <${fromDomain}>` : fromDomain,
      to: toName ? `${toName} <${toEmail}>` : toEmail,
      subject,
      html: body.replace(/\n/g, '<br>'),
      text: body,
    })

    // Save thread to Firestore
    await adminDb
      .collection('organizations').doc(orgId)
      .collection('clients').doc(clientId)
      .collection('emails').add({
        orgId, clientId, subject,
        fromName: fromName || 'CRM',
        fromEmail: fromDomain,
        toEmail,
        body,
        direction: 'outbound',
        createdAt: adminTimestamp(),
      })

    console.log(`[email/send] org=${orgId} client=${clientId} to=${toEmail}`)
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[email/send]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
