export const dynamic = 'force-dynamic'

import { adminDb } from '@/lib/firebase-admin'
import { checkGmailReplies } from '@/lib/gmail-imap'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/cron/check-replies — Vercel Cron.
// Revisa la bandeja IMAP de Gmail de cada org configurada, busca respuestas
// de leads conocidos y detiene su secuencia de outreach si responden.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const orgsWithGmail = await adminDb
    .collection('org_tokens')
    .where('gmail_user', '!=', '')
    .get()

  let totalProcessed = 0
  let totalMatched = 0
  const errors: string[] = []

  for (const doc of orgsWithGmail.docs) {
    try {
      const { processed, matched } = await checkGmailReplies(doc.id)
      totalProcessed += processed
      totalMatched += matched
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('[cron/check-replies]', doc.id, msg)
      errors.push(`${doc.id}: ${msg}`)
    }
  }

  return NextResponse.json({ ok: true, orgs: orgsWithGmail.size, processed: totalProcessed, matched: totalMatched, errors })
}
