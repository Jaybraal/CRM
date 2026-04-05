export const dynamic = 'force-dynamic'

import { adminDb } from '@/lib/firebase-admin'
import { encrypt, safeDecrypt } from '@/lib/encrypt'
import { FieldValue } from 'firebase-admin/firestore'
import { NextRequest, NextResponse } from 'next/server'

const SUPER_ADMIN_UID = process.env.NEXT_PUBLIC_SUPER_ADMIN_UID

async function verifySuperAdmin(req: NextRequest): Promise<boolean> {
  const authHeader = req.headers.get('x-user-uid')
  if (!authHeader) return false
  const userSnap = await adminDb.doc(`users/${authHeader}`).get()
  return userSnap.data()?.role === 'super_admin' || authHeader === SUPER_ADMIN_UID
}

// GET — devuelve tokens desencriptados (solo superadmin)
export async function GET(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params
  if (!(await verifySuperAdmin(req))) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }
  try {
    const snap = await adminDb.doc(`org_tokens/${orgId}`).get()
    if (!snap.exists) return NextResponse.json({ wa_phone_number_id: '', wa_token: '', ig_token: '' })
    const data = snap.data()!
    return NextResponse.json({
      wa_phone_number_id: safeDecrypt(data.wa_phone_number_id_enc),
      wa_token: safeDecrypt(data.wa_token_enc),
      ig_token: safeDecrypt(data.ig_token_enc),
    })
  } catch (e) {
    console.error('Error reading tokens:', e)
    return NextResponse.json({ error: 'Error al leer tokens' }, { status: 500 })
  }
}

// POST — guarda tokens encriptados (solo superadmin)
export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params
  if (!(await verifySuperAdmin(req))) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }
  try {
    const { wa_phone_number_id, wa_token, ig_token, updatedBy } = await req.json()

    const update: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: updatedBy || 'superadmin',
    }

    if (wa_phone_number_id !== undefined) {
      update.wa_phone_number_id_enc = wa_phone_number_id ? encrypt(wa_phone_number_id.trim()) : ''
    }
    if (wa_token !== undefined) {
      update.wa_token_enc = wa_token ? encrypt(wa_token.trim()) : ''
      // Actualizar whatsapp_configs para lookup por phoneNumberId en el webhook
      const phoneId = wa_phone_number_id?.trim()
      if (phoneId) {
        await adminDb.doc(`whatsapp_configs/${phoneId}`).set({ orgId }, { merge: true })
      }
    }
    if (ig_token !== undefined) {
      update.ig_token_enc = ig_token ? encrypt(ig_token.trim()) : ''
    }

    await adminDb.doc(`org_tokens/${orgId}`).set(update, { merge: true })

    // Guardar flag no sensible en org para que el frontend sepa si Meta está activo
    const hasMetaConfig = !!(wa_phone_number_id?.trim() && wa_token?.trim())
    if (wa_token !== undefined) {
      await adminDb.doc(`organizations/${orgId}`).update({
        'settings.whatsappMetaConfigured': hasMetaConfig,
      }).catch(() => {})
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('Error saving tokens:', e)
    return NextResponse.json({ error: 'Error al guardar tokens' }, { status: 500 })
  }
}
