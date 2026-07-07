import nodemailer from 'nodemailer'
import { adminDb } from '@/lib/firebase-admin'
import { encrypt, safeDecrypt } from '@/lib/encrypt'

export interface GmailCredentials {
  user: string
  appPassword: string
}

/**
 * Lee las credenciales de Gmail cifradas de org_tokens/{orgId}.
 * La app password se guarda cifrada con AES-256-GCM (lib/encrypt).
 * Devuelve null si la org no tiene Gmail configurado.
 */
export async function getGmailCredentials(orgId: string): Promise<GmailCredentials | null> {
  const snap = await adminDb.doc(`org_tokens/${orgId}`).get()
  const data = snap.exists ? snap.data() : null
  const user = (data?.gmail_user as string) || ''
  const appPassword = safeDecrypt(data?.gmail_app_password as string | undefined)
  if (!user || !appPassword) return null
  return { user, appPassword }
}

/** Guarda las credenciales de Gmail, cifrando la app password antes de persistir. */
export async function saveGmailCredentials(orgId: string, user: string, appPassword: string): Promise<void> {
  const cleanPassword = appPassword.replace(/\s+/g, '') // Google muestra la app password con espacios
  await adminDb.doc(`org_tokens/${orgId}`).set(
    {
      gmail_user: user.trim(),
      gmail_app_password: encrypt(cleanPassword),
      gmail_updated_at: new Date().toISOString(),
    },
    { merge: true }
  )
}

function buildTransport(creds: GmailCredentials) {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user: creds.user, pass: creds.appPassword },
  })
}

export interface SendGmailInput {
  orgId: string
  toEmail: string
  toName?: string
  subject: string
  /** Cuerpo en texto plano (se convierte a HTML con saltos de línea). */
  body: string
  fromName?: string
  /** URL o instrucción de baja; si se omite se usa una genérica. */
  unsubscribeNote?: string
}

/**
 * Pie de baja para cumplimiento (CAN-SPAM / RGPD). Se agrega a todo outreach.
 */
function unsubscribeFooter(note?: string): string {
  const line =
    note ||
    'Si no deseas recibir más correos, responde con "BAJA" y no volveremos a escribirte.'
  return `\n\n—\n${line}`
}

/**
 * Envía un email por Gmail SMTP usando las credenciales cifradas de la org.
 * Lanza error si la org no tiene Gmail configurado.
 */
export async function sendGmail(input: SendGmailInput): Promise<{ messageId: string }> {
  const creds = await getGmailCredentials(input.orgId)
  if (!creds) throw new Error('Gmail no configurado para esta organización')

  const transport = buildTransport(creds)
  const fullBody = input.body + unsubscribeFooter(input.unsubscribeNote)
  const from = input.fromName ? `${input.fromName} <${creds.user}>` : creds.user
  const to = input.toName ? `${input.toName} <${input.toEmail}>` : input.toEmail

  const info = await transport.sendMail({
    from,
    to,
    subject: input.subject,
    text: fullBody,
    html: fullBody.replace(/\n/g, '<br>'),
  })

  return { messageId: info.messageId }
}

/** Verifica que las credenciales conectan enviando un correo de prueba a la propia cuenta. */
export async function testGmail(orgId: string): Promise<{ ok: true }> {
  const creds = await getGmailCredentials(orgId)
  if (!creds) throw new Error('Gmail no configurado para esta organización')
  const transport = buildTransport(creds)
  await transport.verify()
  await transport.sendMail({
    from: creds.user,
    to: creds.user,
    subject: 'STOD Lead Engine — prueba de conexión',
    text: 'Si recibes este correo, tu Gmail está correctamente conectado al CRM. ✅',
  })
  return { ok: true }
}
