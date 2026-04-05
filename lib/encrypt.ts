import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'

function getKey(): Buffer {
  const hex = process.env.TOKENS_ENCRYPTION_KEY
  if (!hex || hex.length !== 64) {
    throw new Error('TOKENS_ENCRYPTION_KEY must be a 64-char hex string (32 bytes)')
  }
  return Buffer.from(hex, 'hex')
}

export function encrypt(text: string): string {
  const key = getKey()
  const iv = randomBytes(12) // 96-bit IV for GCM
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`
}

export function decrypt(data: string): string {
  const key = getKey()
  const parts = data.split(':')
  if (parts.length !== 3) throw new Error('Invalid encrypted data format')
  const [ivHex, tagHex, encryptedHex] = parts
  const iv = Buffer.from(ivHex, 'hex')
  const tag = Buffer.from(tagHex, 'hex')
  const encrypted = Buffer.from(encryptedHex, 'hex')
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  return decipher.update(encrypted).toString('utf8') + decipher.final('utf8')
}

export function safeDecrypt(data: string | undefined | null): string {
  if (!data) return ''
  try { return decrypt(data) } catch { return '' }
}
