import { initializeApp, getApps, cert, App } from 'firebase-admin/app'
import { getFirestore, Firestore } from 'firebase-admin/firestore'

let app: App | undefined
let _adminDb: Firestore | undefined

function getAdminApp(): App {
  if (!app || !getApps().length) {
    app = initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID!,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL!,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    })
  }
  return getApps()[0]
}

export function getAdminDb(): Firestore {
  if (!_adminDb) {
    getAdminApp()
    _adminDb = getFirestore()
  }
  return _adminDb
}

// Proxy para uso transparente: adminDb.collection(...) etc.
export const adminDb = new Proxy({} as Firestore, {
  get(_target, prop) {
    return (getAdminDb() as unknown as Record<string | symbol, unknown>)[prop]
  },
})
