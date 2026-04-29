import { initializeApp, getApps, cert, getApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'
import { getStorage } from 'firebase-admin/storage'
import { getMessaging } from 'firebase-admin/messaging'

function getAdminApp() {
  if (getApps().length) return getApp()

  const projectId   = process.env.FIREBASE_ADMIN_PROJECT_ID
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL
  const rawKey      = process.env.FIREBASE_ADMIN_PRIVATE_KEY

  if (!projectId || !clientEmail || !rawKey) {
    throw new Error(
      `Firebase Admin SDK: variables faltantes — ` +
      `PROJECT_ID=${!!projectId}, CLIENT_EMAIL=${!!clientEmail}, PRIVATE_KEY=${!!rawKey}`
    )
  }

  // Normalizar la clave (Vercel puede guardar \n como literal o como salto real)
  const privateKey = rawKey.replace(/\\n/g, '\n').trim()

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  })
}

// Pasamos la app explícitamente para evitar el error "default app does not exist"
export function getAdminDb() {
  return getFirestore(getAdminApp())
}

export function getAdminAuth() {
  return getAuth(getAdminApp())
}

export function getAdminStorage() {
  const bucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
  if (!bucket) throw new Error('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET no configurado')
  return getStorage(getAdminApp()).bucket(bucket)
}

export function getAdminMessaging() {
  return getMessaging(getAdminApp())
}

// Send FCM push to all tokens of org members
export async function sendFCMToOrg(orgId: string, title: string, body: string, url: string) {
  try {
    const db = getAdminDb()
    const tokensSnap = await db.collection('fcm_tokens').where('orgId', '==', orgId).get()
    if (tokensSnap.empty) return
    const tokens = tokensSnap.docs.map(d => d.data().token as string).filter(Boolean)
    if (tokens.length === 0) return
    await getAdminMessaging().sendEachForMulticast({
      tokens,
      notification: { title, body },
      webpush: { fcmOptions: { link: url } },
    })
  } catch (e) {
    console.warn('FCM send failed:', e)
  }
}

import { FieldValue } from 'firebase-admin/firestore'
export const adminTimestamp = () => FieldValue.serverTimestamp()

// Proxy transparente: adminDb.collection(...) etc.
export const adminDb = new Proxy({} as ReturnType<typeof getFirestore>, {
  get(_target, prop) {
    return (getAdminDb() as unknown as Record<string | symbol, unknown>)[prop]
  },
})
