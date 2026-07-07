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
