import type { Client } from '@/types'

export type ClientChannel = 'whatsapp' | 'email' | 'other'

export function getChannel(c: Client): ClientChannel {
  if (c.whatsappPhone || c.whatsappJid) return 'whatsapp'
  if (c.email) return 'email'
  return 'other'
}

export function isChatChannel(c: Client): boolean {
  return getChannel(c) === 'whatsapp'
}

// getChannel() picks ONE primary channel (whatsapp > email) for filtering/icons.
// A client can legitimately have both a WhatsApp conversation and an email
// outreach sequence at once (e.g. STOD leads contacted by both) — these two
// checks are independent of each other and of getChannel(), so the UI can
// offer both views instead of hiding one.
export function hasWhatsapp(c: Client): boolean {
  return !!(c.whatsappPhone || c.whatsappJid)
}

export function hasEmail(c: Client): boolean {
  return !!c.email
}
