export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { adminDb, sendFCMToOrg } from '@/lib/firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'

function verifySecret(req: NextRequest): boolean {
  const secret = process.env.BOT_INTERNAL_SECRET
  if (!secret) return false
  if (req.headers.get('x-bot-secret') === secret) return true
  const url = new URL(req.url)
  if (url.searchParams.get('secret') === secret) return true
  return false
}

async function sendText(baileysUrl: string, to: string, text: string, sessionId: string) {
  const res = await fetch(`${baileysUrl}/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, text, sessionId }),
    signal: AbortSignal.timeout(20000),
  })
  if (!res.ok) throw new Error(`Baileys /send error ${res.status}`)
}

export async function POST(req: NextRequest) {
  if (!verifySecret(req)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  try {
    const body = await req.json() as {
      actionType: string
      orgId: string
      clientPhone: string
      clientName?: string
      channel: string
      message: string
      productId?: string
      slotIndex?: number
      slotLabel?: string
    }

    const { actionType, orgId, clientPhone, clientName = '', channel, message } = body
    if (!actionType || !orgId || !clientPhone || !message) {
      return NextResponse.json({ error: 'Faltan parámetros requeridos' }, { status: 400 })
    }

    const baileysUrl = (process.env.BAILEYS_URL || 'http://localhost:3002').trim()
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3010').trim()

    // Guardar mensaje del bot en historial
    const convRef = adminDb.doc(`organizations/${orgId}/bot_conversations/${clientPhone}`)
    void convRef.set({
      updatedAt: new Date(),
      messages: FieldValue.arrayUnion({ role: 'bot', content: message, ts: new Date() }),
    }, { merge: true })

    switch (actionType) {
      case 'REPLY': {
        await sendText(baileysUrl, clientPhone, message, orgId)
        break
      }

      case 'SEND_PRODUCT': {
        const { productId } = body
        if (!productId) {
          await sendText(baileysUrl, clientPhone, message, orgId)
          break
        }
        const productSnap = await adminDb.doc(`organizations/${orgId}/catalog/${productId}`).get()
        const product = productSnap.data()
        if (!product) {
          await sendText(baileysUrl, clientPhone, 'Lo siento, no encontré ese producto en el catálogo.', orgId)
          break
        }
        // Send message text first
        await sendText(baileysUrl, clientPhone, message, orgId)
        // Send product image if available
        if (product.photos?.[0]) {
          const imgRes = await fetch(`${baileysUrl}/send-image`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: clientPhone,
              url: product.photos[0],
              caption: `*${product.title}*\n${product.description || ''}\n💰 $${product.price ?? 'Consultar'}\n${product.available ? '✅ Disponible' : '❌ No disponible'}`,
              sessionId: orgId,
            }),
            signal: AbortSignal.timeout(20000),
          })
          if (!imgRes.ok) console.error('[bot/action] send-image error', imgRes.status)
        }
        // Send catalog link
        const catalogLink = `${appUrl.replace(':3010', '')}/c/${orgId}`
        await sendText(baileysUrl, clientPhone, `Ver catálogo completo: ${catalogLink}`, orgId)
        break
      }

      case 'LOCATION': {
        const orgSnap = await adminDb.doc(`organizations/${orgId}`).get()
        const loc = orgSnap.data()?.settings?.businessLocation
        if (!loc) {
          await sendText(baileysUrl, clientPhone, message, orgId)
          break
        }
        await sendText(baileysUrl, clientPhone, message, orgId)
        const locRes = await fetch(`${baileysUrl}/send-location`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to: clientPhone, lat: loc.lat, lng: loc.lng, name: loc.name, sessionId: orgId }),
          signal: AbortSignal.timeout(20000),
        })
        if (!locRes.ok) console.error('[bot/action] send-location error', locRes.status)
        if (loc.mapsUrl) {
          await sendText(baileysUrl, clientPhone, `📍 ${loc.address}\n${loc.mapsUrl}`, orgId)
        }
        break
      }

      case 'SHOW_SLOTS': {
        // Groq ya formateó el mensaje con los slots, solo enviarlo
        await sendText(baileysUrl, clientPhone, message, orgId)
        break
      }

      case 'BOOK_SLOT': {
        const { slotIndex, slotLabel } = body
        const orgSnap = await adminDb.doc(`organizations/${orgId}`).get()
        const slots = orgSnap.data()?.settings?.appointmentSlots as Array<{ day: number; time: string; label: string }> | undefined

        const chosenLabel = slotLabel || slots?.[slotIndex ?? 0]?.label || 'Horario solicitado'
        const chosenDay = slots?.[slotIndex ?? 0]?.day ?? 0
        const chosenTime = slots?.[slotIndex ?? 0]?.time ?? '09:00'

        // Crear solicitud pendiente
        await adminDb.collection(`organizations/${orgId}/appointment_requests`).add({
          orgId,
          clientPhone,
          clientName,
          slotLabel: chosenLabel,
          slotDay: chosenDay,
          slotTime: chosenTime,
          status: 'pending',
          createdAt: new Date(),
        })

        // Notificar a agentes
        void sendFCMToOrg(
          orgId,
          '📅 Nueva solicitud de cita',
          `${clientName || clientPhone} quiere el ${chosenLabel}`,
          `${appUrl}/dashboard/calendar`,
        )

        // Confirmar al cliente
        await sendText(baileysUrl, clientPhone, message, orgId)
        break
      }

      case 'ESCALATE': {
        // Notificar a agentes
        void sendFCMToOrg(
          orgId,
          '🚨 Cliente solicita agente humano',
          `${clientName || clientPhone} necesita atención personal`,
          `${appUrl}/dashboard/inbox`,
        )
        // Marcar conversación como escalada
        await convRef.set({ status: 'escalated', updatedAt: new Date() }, { merge: true })
        // Enviar mensaje al cliente
        await sendText(baileysUrl, clientPhone, message, orgId)
        break
      }

      default:
        await sendText(baileysUrl, clientPhone, message, orgId)
    }

    console.log(`[bot/action] ${actionType} → ${clientPhone} org=${orgId}`)
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[bot/action]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
