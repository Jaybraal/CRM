import { getAdminAuth, getAdminDb } from './firebase-admin'
import { NextRequest } from 'next/server'

// Verifica el Firebase ID token del header Authorization: Bearer <token>
// Devuelve el UID verificado, o null si es inválido/ausente.
export async function verifyFirebaseToken(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const idToken = authHeader.slice(7)
  try {
    const decoded = await getAdminAuth().verifyIdToken(idToken)
    return decoded.uid
  } catch {
    return null
  }
}

// Verifica que el token corresponde a un superadmin.
// SUPER_ADMIN_UID es una variable de entorno no pública (no NEXT_PUBLIC_*).
export async function requireSuperAdminJWT(req: NextRequest): Promise<boolean> {
  const uid = await verifyFirebaseToken(req)
  if (!uid) return false
  const superAdminUid = process.env.SUPER_ADMIN_UID
  if (superAdminUid && uid === superAdminUid) return true
  const snap = await getAdminDb().doc(`users/${uid}`).get()
  return snap.data()?.role === 'super_admin'
}
