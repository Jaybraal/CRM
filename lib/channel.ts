import type { Client } from '@/types'

export type ClientChannel = 'whatsapp' | 'instagram' | 'email' | 'other'

export function getChannel(c: Client): ClientChannel {
  if (c.instagramId) return 'instagram'
  if (c.whatsappPhone || c.whatsappJid) return 'whatsapp'
  if (c.email) return 'email'
  return 'other'
}

export function isChatChannel(c: Client): boolean {
  const channel = getChannel(c)
  return channel === 'whatsapp' || channel === 'instagram'
}
