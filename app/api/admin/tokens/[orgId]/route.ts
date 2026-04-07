export const dynamic = 'force-dynamic'

import { adminDb } from '@/lib/firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'
import { NextRequest, NextResponse } from 'next/server'

const SUPER_ADMIN_UID = process.env.NEXT_PUBLIC_SUPER_ADMIN_UID

async function verifySuperAdmin(req: NextRequest): Promise<boolean> {
  const authHeader = req.headers.get('x-user-uid')
  if (!authHeader) return false
  const userSnap = await adminDb.doc(`users/${authHeader}`).get()
  return userSnap.data()?.role === 'super_admin' || authHeader === SUPER_ADMIN_UID
}

// Intercambia un token temporal de Meta por uno de larga duración (60 días)
async function exchangeForLongLivedToken(shortToken: string): Promise<{ token: string; expiresAt: Date } | null> {
  const appId = process.env.META_APP_ID
  const appSecret = process.env.META_APP_SECRET
  if (!appId || !appSecret) return null

  try {
    const url = `https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${shortToken}`
    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json()
    if (!data.access_token) return null
    const expiresIn = data.expires_in || (60 * 24 * 60 * 60) // default 60 días en segundos
    const expiresAt = new Date(Date.now() + expiresIn * 1000)
    return { token: data.access_token, expiresAt }
  } catch {
    return null
  }
}

// GET — devuelve tokens + info de expiración (solo superadmin)
export async function GET(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params
  if (!(await verifySuperAdmin(req))) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }
  try {
    const snap = await adminDb.doc(`org_tokens/${orgId}`).get()
    if (!snap.exists) return NextResponse.json({ wa_phone_number_id: '', wa_token: '', ig_token: '', wa_token_expires_at: null })
    const data = snap.data()!
    const expiresAt = data.wa_token_expires_at?.toDate?.() || null
    return NextResponse.json({
      wa_phone_number_id: data.wa_phone_number_id || '',
      wa_token: data.wa_token || '',
      ig_token: data.ig_token || '',
      wa_token_expires_at: expiresAt ? expiresAt.toISOString() : null,
    })
  } catch (e) {
    console.error('Error reading tokens:', e)
    return NextResponse.json({ error: 'Error al leer tokens' }, { status: 500 })
  }
}

// POST — guarda tokens + intenta canjear por token de 60 días (solo superadmin)
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
      update.wa_phone_number_id = wa_phone_number_id?.trim() || ''
    }

    if (wa_token !== undefined) {
      const rawToken = wa_token?.trim() || ''
      let finalToken = rawToken
      let expiresAt: Date | null = null

      // Intentar canjear por token de 60 días automáticamente
      if (rawToken) {
        const longLived = await exchangeForLongLivedToken(rawToken)
        if (longLived) {
          finalToken = longLived.token
          expiresAt = longLived.expiresAt
          console.log('[tokens] Canjeado por token de larga duración, expira:', expiresAt.toISOString())
        } else {
          // Si falla el canje, guardar el token como está con ~24h de expiración
          expiresAt = new Date(Date.now() + 23 * 60 * 60 * 1000)
          console.warn('[tokens] No se pudo canjear por token largo, usando token original (~24h)')
        }
      }

      update.wa_token = finalToken
      update.wa_token_expires_at = expiresAt

      // Actualizar whatsapp_configs para lookup por phoneNumberId en el webhook
      const phoneId = wa_phone_number_id?.trim()
      if (phoneId) {
        await adminDb.doc(`whatsapp_configs/${phoneId}`).set({ orgId }, { merge: true })
      }
    }

    if (ig_token !== undefined) {
      update.ig_token = ig_token?.trim() || ''
    }

    await adminDb.doc(`org_tokens/${orgId}`).set(update, { merge: true })

    // Guardar flag no sensible en org para que el frontend sepa si Meta está activo
    const hasMetaConfig = !!(wa_phone_number_id?.trim() && wa_token?.trim())
    if (wa_token !== undefined) {
      await adminDb.doc(`organizations/${orgId}`).update({
        'settings.whatsappMetaConfigured': hasMetaConfig,
      }).catch(() => {})
    }

    return NextResponse.json({ ok: true, longLivedToken: !!(update.wa_token_expires_at && new Date(update.wa_token_expires_at as Date).getTime() > Date.now() + 48 * 60 * 60 * 1000) })
  } catch (e) {
    console.error('Error saving tokens:', e)
    return NextResponse.json({ error: 'Error al guardar tokens' }, { status: 500 })
  }
}
