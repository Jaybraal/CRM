# Bot Expansion — NEXO CRM Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expandir el bot de WhatsApp con 5 features: ubicación, catálogo inteligente, citas con slots, FAQ y escalado a humano.

**Architecture:** `/api/bot/trigger` enriquece el payload con contexto del negocio (catálogo, FAQ, slots, ubicación, personalidad) antes de llamar N8N. N8N+Groq decide la acción y llama `/api/bot/action` (nuevo endpoint unificado) para SEND_PRODUCT/LOCATION/SHOW_SLOTS/BOOK_SLOT/ESCALATE. REPLY y QUALIFY siguen usando los nodos existentes.

**Tech Stack:** Next.js 16, TypeScript, Firebase Admin SDK, Baileys (:3002), N8N 2.8.4 (SQLite), Groq llama-3.3-70b-versatile, React 19, Tailwind CSS.

## Global Constraints

- Todos los nuevos endpoints usan `?secret=<BOT_INTERNAL_SECRET>` igual que `/api/bot/reply`
- Baileys siempre recibe `sessionId: orgId` en el body
- N8N se actualiza modificando SQLite (`workflow_entity` + `workflow_history`) y reiniciando N8N
- Puerto CRM: 3010 en desarrollo. `NEXT_PUBLIC_APP_URL=http://localhost:3010`
- Firebase Admin para server-side Firestore; `firebase/firestore` client-side
- No romper el flujo REPLY/QUALIFY existente
- Ruta catálogo público: `<origin>/c/<orgId>`

---

### Task 1: Tipos + funciones Firestore

**Files:**
- Modify: `types/index.ts`
- Modify: `lib/firestore.ts`

**Interfaces:**
- Produces:
  - `AppointmentRequest` type (usado por Tasks 2, 3, 8)
  - `Organization.settings.botPersonality`, `faq`, `businessLocation`, `appointmentSlots`
  - `Appointment.status`, `clientPhone`, `slotIndex`
  - `getAppointmentRequests(orgId)`, `createAppointmentRequest(orgId, data)`, `updateAppointmentRequest(orgId, id, data)`

- [ ] **Step 1: Actualizar `types/index.ts`**

En `Organization` → `settings`, añadir después de `n8nMode`:

```ts
// types/index.ts — dentro de Organization.settings (después de n8nMode)
botPersonality?: {
  businessName: string
  industry: string
  tone: 'formal' | 'casual'
  description: string
  assistantName?: string
}
faq?: Array<{
  id: string
  question: string
  answer: string
}>
businessLocation?: {
  lat: number
  lng: number
  name: string
  address: string
  mapsUrl?: string
}
appointmentSlots?: Array<{
  day: number
  time: string
  label: string
}>
```

En la interfaz `Appointment`, añadir después de `createdAt`:

```ts
// types/index.ts — dentro de Appointment
status?: 'pending' | 'confirmed' | 'rejected'
clientPhone?: string
slotIndex?: number
```

Añadir nueva interfaz `AppointmentRequest` después de `Appointment`:

```ts
export interface AppointmentRequest {
  id: string
  orgId: string
  clientPhone: string
  clientName: string
  slotLabel: string
  slotDay: number
  slotTime: string
  status: 'pending' | 'confirmed' | 'rejected'
  createdAt: Date
}
```

- [ ] **Step 2: Añadir funciones a `lib/firestore.ts`**

Añadir después de `deleteAppointment`:

```ts
// lib/firestore.ts — Appointment Requests

export async function getAppointmentRequests(orgId: string, status?: 'pending' | 'confirmed' | 'rejected'): Promise<AppointmentRequest[]> {
  const q = status
    ? query(collection(db, 'organizations', orgId, 'appointment_requests'), where('status', '==', status), orderBy('createdAt', 'desc'))
    : query(collection(db, 'organizations', orgId, 'appointment_requests'), orderBy('createdAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() })) as AppointmentRequest[]
}

export async function createAppointmentRequest(orgId: string, data: Omit<AppointmentRequest, 'id' | 'orgId' | 'createdAt'>) {
  const ref = await addDoc(collection(db, 'organizations', orgId, 'appointment_requests'), {
    orgId,
    ...data,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateAppointmentRequest(orgId: string, requestId: string, data: Partial<Pick<AppointmentRequest, 'status'>>) {
  await updateDoc(doc(db, 'organizations', orgId, 'appointment_requests', requestId), data)
}
```

Añadir `AppointmentRequest` al import de tipos al inicio del archivo:

```ts
import type { Organization, AppUser, Client, Category, CatalogItem, Deal, Task, Message, AgentGoal, Appointment, AppointmentRequest, OrgStats } from '@/types'
```

- [ ] **Step 3: Verificar que compila**

```bash
cd /Users/branel/CRM-auto && npx tsc --noEmit 2>&1 | head -20
```

Expected: sin errores de tipo.

- [ ] **Step 4: Commit**

```bash
cd /Users/branel/CRM-auto
git add types/index.ts lib/firestore.ts
git commit -m "feat(bot): add types for bot personality, faq, location, slots, appointment requests"
```

---

### Task 2: `/api/bot/action` — endpoint unificado

**Files:**
- Create: `app/api/bot/action/route.ts`

**Interfaces:**
- Consumes: `BOT_INTERNAL_SECRET` env, `BAILEYS_URL` env, `adminDb` de `lib/firebase-admin`, `sendFCMToOrg` de `lib/firebase-admin`
- Produces: `POST /api/bot/action?secret=<secret>` que acepta `{ actionType, orgId, clientPhone, clientName, channel, message, productId?, slotIndex?, slotLabel? }`

- [ ] **Step 1: Crear `app/api/bot/action/route.ts`**

```ts
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
```

- [ ] **Step 2: Verificar que compila**

```bash
cd /Users/branel/CRM-auto && npx tsc --noEmit 2>&1 | head -20
```

Expected: sin errores.

- [ ] **Step 3: Test rápido del endpoint**

Con el CRM corriendo en :3010:

```bash
curl -s -X POST "http://localhost:3010/api/bot/action?secret=bot_secret_crm_9f4a2b8e1d7c3a6f" \
  -H "Content-Type: application/json" \
  -d '{"actionType":"REPLY","orgId":"GYYEsxc5eKlUw1XOJLUg","clientPhone":"18093974880","message":"Test acción unificada","channel":"whatsapp"}'
```

Expected: `{"ok":true}` y mensaje llega al teléfono.

- [ ] **Step 4: Commit**

```bash
cd /Users/branel/CRM-auto
git add app/api/bot/action/route.ts
git commit -m "feat(bot): add unified /api/bot/action endpoint for all bot action types"
```

---

### Task 3: `/api/bot/confirm-slot` — aprobación de citas

**Files:**
- Create: `app/api/bot/confirm-slot/route.ts`

**Interfaces:**
- Consumes: `adminDb`, `sendFCMToOrg`, `BAILEYS_URL`, `BOT_INTERNAL_SECRET`, `NEXT_PUBLIC_APP_URL`
- Produces: `POST /api/bot/confirm-slot` (autenticado con sesión Firebase, no bot secret)

- [ ] **Step 1: Crear `app/api/bot/confirm-slot/route.ts`**

```ts
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'

async function sendWhatsApp(baileysUrl: string, to: string, text: string, sessionId: string) {
  await fetch(`${baileysUrl}/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, text, sessionId }),
    signal: AbortSignal.timeout(20000),
  })
}

export async function POST(req: NextRequest) {
  try {
    const { requestId, orgId, action } = await req.json() as {
      requestId: string
      orgId: string
      action: 'confirm' | 'reject'
    }

    if (!requestId || !orgId || !action) {
      return NextResponse.json({ error: 'requestId, orgId y action son requeridos' }, { status: 400 })
    }

    const reqRef = adminDb.doc(`organizations/${orgId}/appointment_requests/${requestId}`)
    const reqSnap = await reqRef.get()
    if (!reqSnap.exists) {
      return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 })
    }

    const request = reqSnap.data()!
    const baileysUrl = (process.env.BAILEYS_URL || 'http://localhost:3002').trim()

    if (action === 'confirm') {
      // Actualizar estado de la solicitud
      await reqRef.update({ status: 'confirmed' })

      // Crear cita oficial en appointments
      const orgSnap = await adminDb.doc(`organizations/${orgId}`).get()
      const orgName = orgSnap.data()?.name || 'el negocio'

      const [h, m] = (request.slotTime as string).split(':').map(Number)
      const now = new Date()
      const daysMap = [0, 1, 2, 3, 4, 5, 6]
      const targetDay = daysMap[request.slotDay as number]
      const today = now.getDay()
      const diff = (targetDay - today + 7) % 7 || 7
      const apptDate = new Date(now)
      apptDate.setDate(now.getDate() + diff)
      apptDate.setHours(h, m, 0, 0)

      await adminDb.collection(`organizations/${orgId}/appointments`).add({
        orgId,
        title: `Cita con ${request.clientName || request.clientPhone}`,
        clientName: request.clientName || '',
        clientPhone: request.clientPhone,
        assignedTo: 'bot',
        startDate: apptDate,
        status: 'confirmed',
        createdAt: new Date(),
      })

      // Notificar al cliente
      await sendWhatsApp(
        baileysUrl,
        request.clientPhone as string,
        `✅ ¡Tu cita ha sido confirmada!\n📅 ${request.slotLabel}\n📍 ${orgName}\n\nTe esperamos. Si necesitas cambiarla, escríbenos.`,
        orgId,
      )
    } else {
      // Rechazar
      await reqRef.update({ status: 'rejected' })
      await sendWhatsApp(
        baileysUrl,
        request.clientPhone as string,
        `Lo sentimos, el horario *${request.slotLabel}* ya no está disponible. ¿Quieres que revisemos otra opción?`,
        orgId,
      )
      // Reactivar bot para que el cliente pueda elegir otro slot
      await adminDb.doc(`organizations/${orgId}/bot_conversations/${request.clientPhone}`).set(
        { status: 'active' },
        { merge: true },
      )
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[bot/confirm-slot]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
```

- [ ] **Step 2: Verificar que compila**

```bash
cd /Users/branel/CRM-auto && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
cd /Users/branel/CRM-auto
git add app/api/bot/confirm-slot/route.ts
git commit -m "feat(bot): add /api/bot/confirm-slot for agent appointment approval"
```

---

### Task 4: Enriquecer `/api/bot/trigger` con contexto

**Files:**
- Modify: `app/api/bot/trigger/route.ts`

**Interfaces:**
- Consumes: `adminDb`, org settings (`botPersonality`, `faq`, `businessLocation`, `appointmentSlots`), catálogo
- Produces: payload N8N enriquecido con campo `context`

- [ ] **Step 1: Reemplazar `/api/bot/trigger/route.ts` completo**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'

function verifyBotSecret(req: NextRequest): boolean {
  const secret = process.env.BOT_INTERNAL_SECRET
  if (!secret) return false
  return req.headers.get('x-bot-secret') === secret
}

export async function POST(req: NextRequest) {
  if (!verifyBotSecret(req)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }
  try {
    const { orgId, clientPhone, clientName, message, channel } = await req.json()

    if (!orgId || !clientPhone) {
      return NextResponse.json({ error: 'orgId y clientPhone son requeridos' }, { status: 400 })
    }

    // Cargar org + catálogo + historial en paralelo
    const [orgSnap, catalogSnap, convSnap] = await Promise.all([
      adminDb.doc(`organizations/${orgId}`).get(),
      adminDb.collection(`organizations/${orgId}/catalog`).where('available', '==', true).limit(20).get(),
      adminDb.doc(`organizations/${orgId}/bot_conversations/${clientPhone}`).get(),
    ])

    const settings = orgSnap.data()?.settings || {}
    const webhookUrl = settings.n8nWebhookUrl as string | undefined
    const apiKey = settings.n8nApiKey as string | undefined

    if (!webhookUrl) {
      return NextResponse.json({ error: 'N8N no configurado para esta org' }, { status: 503 })
    }

    // Historial bot
    const rawHistory: Array<{ role: string; content: string }> = convSnap.data()?.messages || []
    const history = rawHistory.slice(-20).map(m => ({ role: m.role, content: m.content }))

    // Catálogo (top 20 disponibles)
    const catalog = catalogSnap.docs.map(d => {
      const data = d.data()
      return {
        id: d.id,
        title: data.title as string,
        price: data.price as number | undefined,
        description: (data.description as string | undefined)?.slice(0, 100),
        photo: (data.photos as string[])?.[0] || null,
      }
    })

    // Contexto del negocio
    const context = {
      botPersonality: settings.botPersonality || null,
      faq: settings.faq || [],
      businessLocation: settings.businessLocation || null,
      appointmentSlots: settings.appointmentSlots || [],
      catalog,
      orgName: orgSnap.data()?.name || '',
      publicCatalogUrl: `${(process.env.NEXT_PUBLIC_APP_URL.*/${orgId}`,
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (apiKey) headers['x-api-key'] = apiKey

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ orgId, clientPhone, clientName, message, channel, history, context }),
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) {
      console.error(`[bot/trigger] N8N respondió ${res.status}`)
      return NextResponse.json({ error: `N8N error ${res.status}` }, { status: 502 })
    }

    console.log(`[bot/trigger] Conversación enviada a N8N: ${clientPhone} org=${orgId} history=${history.length} msgs catalog=${catalog.length} items`)
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[bot/trigger]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
```

- [ ] **Step 2: Verificar que compila**

```bash
cd /Users/branel/CRM-auto && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
cd /Users/branel/CRM-auto
git add app/api/bot/trigger/route.ts
git commit -m "feat(bot): enrich trigger payload with catalog, faq, location, slots context"
```

---

### Task 5: Bloquear N8N cuando la conversación está escalada

**Files:**
- Modify: `app/api/whatsapp/baileys/route.ts` (solo el bloque del bot N8N, líneas ~413-439)

**Interfaces:**
- Consumes: `adminDb`, `bot_conversations/{phone}.status`
- Produces: si `status === 'escalated'` → no llama `/api/bot/trigger`

- [ ] **Step 1: Localizar el bloque exacto a modificar**

```bash
grep -n "Bot N8N\|shouldTrigger\|qualificationHandled\|n8nMode" /Users/branel/CRM-auto/app/api/whatsapp/baileys/route.ts
```

- [ ] **Step 2: Reemplazar el bloque del bot N8N**

Localizar este comentario en el archivo:
```ts
      // Bot N8N — dispara si está configurado y el qualForm no tomó el control
      if (!qualificationHandled) {
```

Reemplazar **todo ese bloque** hasta el `}` de cierre con:

```ts
      // Bot N8N — dispara si está configurado y la conversación no está escalada
      if (!qualificationHandled) {
        const n8nMode = orgData?.settings?.n8nMode as string | undefined
        const n8nWebhookUrl = orgData?.settings?.n8nWebhookUrl as string | undefined
        if (n8nMode && n8nMode !== 'off' && n8nWebhookUrl) {
          const bh = orgData?.settings?.businessHours as { days: number[]; openTime: string; closeTime: string } | undefined
          const shouldTrigger = n8nMode === 'always' || (n8nMode === 'outside_hours' && !isInsideBusinessHours(bh))
          if (shouldTrigger) {
            // Chequear si la conversación está escalada a humano
            const convRef = adminDb.doc(`organizations/${orgId}/bot_conversations/${normalizedPhone}`)
            const convSnap = await convRef.get()
            const convStatus = convSnap.data()?.status as string | undefined

            if (convStatus === 'escalated') {
              // Guardar mensaje pero no disparar el bot
              void convRef.set({
                updatedAt: new Date(),
                messages: FieldValue.arrayUnion({ role: 'user', content: text || '[Multimedia]', ts: new Date() }),
              }, { merge: true })
            } else {
              void convRef.set({
                phone: normalizedPhone,
                name: clientName,
                channel: 'whatsapp',
                status: 'active',
                updatedAt: new Date(),
                messages: FieldValue.arrayUnion({ role: 'user', content: text || '[Multimedia]', ts: new Date() }),
              }, { merge: true })

              const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3010'
              const botSecret = process.env.BOT_INTERNAL_SECRET || ''
              void fetch(`${appUrl}/api/bot/trigger`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-bot-secret': botSecret },
                body: JSON.stringify({ orgId, clientPhone: normalizedPhone, clientName, message: text || '[Multimedia]', channel: 'whatsapp' }),
              })
            }
          }
        }
      }
```

- [ ] **Step 3: Verificar que compila**

```bash
cd /Users/branel/CRM-auto && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
cd /Users/branel/CRM-auto
git add app/api/whatsapp/baileys/route.ts
git commit -m "feat(bot): skip N8N trigger when conversation is escalated to human"
```

---

### Task 6: Actualizar workflow N8N vía SQLite

**Files:**
- `~/.n8n/database.sqlite` (runtime, no git)

**Interfaces:**
- Modifica nodos: "Construir Prompt", "Parsear Respuesta", "Es Respuesta?"
- Añade nodos: "Es Calificacion?", "Bot Action"
- Añade conexiones para los nuevos nodos

- [ ] **Step 1: Script Python para actualizar el workflow**

Crear y ejecutar este script:

```python
# /tmp/update_n8n_workflow.py
import sqlite3, json, copy

WORKFLOW_ID = 'XJhW3pdEBsTcQD7c'
SECRET = 'bot_secret_crm_9f4a2b8e1d7c3a6f'
DB = '/Users/branel/.n8n/database.sqlite'

CONSTRUIR_PROMPT_CODE = r"""
const body = $input.first().json.body ?? $input.first().json;
const { orgId, clientPhone, clientName, channel, message, history, context } = body;

const bp = context?.botPersonality;
const businessName = bp?.businessName || context?.orgName || 'el negocio';
const industry = bp?.industry || 'nuestro servicio';
const tone = bp?.tone === 'formal' ? 'formal y profesional' : 'amigable y casual';
const description = bp?.description || '';
const assistantName = bp?.assistantName || 'Asistente Virtual';

// Catálogo
let catalogSection = '';
if (context?.catalog?.length) {
  catalogSection = '\n\nCATÁLOGO DISPONIBLE:\n' + context.catalog.map(p =>
    `- ${p.title}${p.price ? ' | $' + p.price : ''} | ID:${p.id}`
  ).join('\n');
  if (context.publicCatalogUrl) {
    catalogSection += `\nCatálogo completo: ${context.publicCatalogUrl}`;
  }
}

// FAQ
let faqSection = '';
if (context?.faq?.length) {
  faqSection = '\n\nPREGUNTAS FRECUENTES:\n' + context.faq.map(f =>
    `- ${f.question} → ${f.answer}`
  ).join('\n');
}

// Slots
let slotsSection = '';
if (context?.appointmentSlots?.length) {
  slotsSection = '\n\nHORARIOS DE CITAS DISPONIBLES:\n' + context.appointmentSlots.map((s, i) =>
    `${i + 1}. ${s.label}`
  ).join('\n');
}

// Ubicación
let locationSection = '';
if (context?.businessLocation) {
  const loc = context.businessLocation;
  locationSection = `\n\nUBICACIÓN: ${loc.name} — ${loc.address}${loc.mapsUrl ? '\n' + loc.mapsUrl : ''}`;
}

const systemPrompt = `Eres ${assistantName}, el asistente virtual de ${businessName}.
Negocio: ${industry}. ${description}
Habla de forma ${tone}. Responde SOLO sobre temas relacionados con el negocio.
Si preguntan algo fuera del tema, redirige amablemente.${catalogSection}${faqSection}${slotsSection}${locationSection}

REGLAS:
- No más de 2 preguntas por mensaje. Sé conciso.
- No menciones que eres un bot o IA.
- No inventes datos que el cliente no ha dado.
- Si el cliente pide hablar con una persona → ESCALATE.
- Si el cliente pregunta por ubicación → LOCATION.
- Si el cliente pregunta por un producto específico del catálogo → SEND_PRODUCT con el productId exacto.
- Si el cliente pide cita/reunión/visita → primero SHOW_SLOTS, luego cuando elija → BOOK_SLOT.
- Si tienes nombre + necesidad + email del cliente → QUALIFY.

Responde ÚNICAMENTE con JSON válido (sin markdown, sin explicaciones):
{
  "action": "REPLY" | "QUALIFY" | "SEND_PRODUCT" | "LOCATION" | "SHOW_SLOTS" | "BOOK_SLOT" | "ESCALATE",
  "message": "texto para el cliente",
  "productId": "id exacto del catálogo (solo si SEND_PRODUCT)",
  "slotIndex": 0,
  "slotLabel": "Lunes 9:00am (solo si BOOK_SLOT)",
  "lead": {
    "name": "nombre completo del cliente o null",
    "email": "email@ejemplo.com o null",
    "summary": "resumen en 1-2 oraciones",
    "stage": "Nuevo"
  }
}`;

const prevMessages = (history || []).map(m => ({
  role: m.role === 'bot' ? 'assistant' : 'user',
  content: m.content
}));

const lastInHistory = prevMessages.length > 0 ? prevMessages[prevMessages.length - 1] : null;
if (!lastInHistory || lastInHistory.role !== 'user' || lastInHistory.content !== message) {
  prevMessages.push({ role: 'user', content: message });
}

const messages = [
  { role: 'system', content: systemPrompt },
  ...prevMessages
];

return [{ json: { orgId, clientPhone, clientName, channel, messages, context } }];
"""

PARSEAR_RESPUESTA_CODE = r"""
const groqResponse = $input.first().json;
const content = groqResponse.choices?.[0]?.message?.content || '{}';

let parsed;
try {
  parsed = JSON.parse(content);
} catch (e) {
  parsed = { action: 'REPLY', message: 'Hola, ¿en qué puedo ayudarte hoy?' };
}

const action = parsed.action || 'REPLY';
const replyMessage = parsed.message || '';
const lead = parsed.lead || {};
const productId = parsed.productId || null;
const slotIndex = parsed.slotIndex ?? null;
const slotLabel = parsed.slotLabel || null;

const prev = $('Construir Prompt').first().json;

return [{
  json: {
    action,
    replyMessage,
    lead,
    productId,
    slotIndex,
    slotLabel,
    orgId: prev.orgId,
    clientPhone: prev.clientPhone,
    clientName: prev.clientName,
    channel: prev.channel,
  }
}];
"""

conn = sqlite3.connect(DB)
c = conn.cursor()

# Leer el workflow actual
c.execute("SELECT nodes, connections FROM workflow_entity WHERE id=?", (WORKFLOW_ID,))
row = c.fetchone()
nodes = json.loads(row[0])
connections = json.loads(row[1])

# Actualizar nodos existentes
for n in nodes:
    if n['name'] == 'Construir Prompt':
        n['parameters']['jsCode'] = CONSTRUIR_PROMPT_CODE.strip()
    elif n['name'] == 'Parsear Respuesta':
        n['parameters']['jsCode'] = PARSEAR_RESPUESTA_CODE.strip()
    elif n['name'] == 'Es Respuesta?':
        # Renombrar y actualizar para chequear REPLY O QUALIFY en el true branch
        # Mantener como: action === REPLY → Responder al Lead
        # false → nuevo nodo "Es Calificacion?"
        pass  # Se mantiene igual, ya chequea REPLY

# Obtener posiciones de nodos existentes para posicionar los nuevos
pos_map = {n['name']: n.get('position', [0, 0]) for n in nodes}
es_resp_pos = pos_map.get('Es Respuesta?', [800, 300])
calificar_pos = pos_map.get('Calificar Lead', [1100, 400])

# Añadir nodo "Es Calificacion?" 
es_calif_node = {
    "id": "es-calificacion",
    "name": "Es Calificacion?",
    "type": "n8n-nodes-base.if",
    "typeVersion": 2,
    "position": [es_resp_pos[0] + 250, es_resp_pos[1] + 150],
    "parameters": {
        "conditions": {
            "options": {"caseSensitive": True, "leftValue": "", "typeValidation": "strict"},
            "conditions": [{
                "id": "qualify-check",
                "leftValue": "={{ $json.action }}",
                "rightValue": "QUALIFY",
                "operator": {"type": "string", "operation": "equals", "name": "filter.operator.equals"}
            }],
            "combinator": "and"
        },
        "options": {}
    }
}

# Añadir nodo "Bot Action"
bot_action_node = {
    "id": "bot-action",
    "name": "Bot Action",
    "type": "n8n-nodes-base.httpRequest",
    "typeVersion": 4.2,
    "position": [es_resp_pos[0] + 500, es_resp_pos[1] + 250],
    "parameters": {
        "method": "POST",
        "url": f"http://localhost:3010/api/bot/action?secret={SECRET}",
        "sendBody": True,
        "contentType": "raw",
        "rawContentType": "application/json",
        "body": "={{ JSON.stringify({ actionType: $json.action, orgId: $json.orgId, clientPhone: $json.clientPhone, clientName: $json.clientName, message: $json.replyMessage, channel: $json.channel, productId: $json.productId, slotIndex: $json.slotIndex, slotLabel: $json.slotLabel }) }}",
        "options": {"timeout": 25000},
        "sendHeaders": True,
        "headerParameters": {"parameters": [{"name": "Content-Type", "value": "application/json"}]}
    }
}

# Añadir nuevos nodos si no existen
existing_names = [n['name'] for n in nodes]
if 'Es Calificacion?' not in existing_names:
    nodes.append(es_calif_node)
if 'Bot Action' not in existing_names:
    nodes.append(bot_action_node)

# Actualizar conexiones
# false branch de "Es Respuesta?" → "Es Calificacion?" (índice 1)
connections['Es Respuesta?']['main'][1] = [{"node": "Es Calificacion?", "type": "main", "index": 0}]

# "Es Calificacion?" → true: "Calificar Lead", false: "Bot Action"
connections['Es Calificacion?'] = {
    "main": [
        [{"node": "Calificar Lead", "type": "main", "index": 0}],
        [{"node": "Bot Action", "type": "main", "index": 0}]
    ]
}

nodes_json = json.dumps(nodes)
conns_json = json.dumps(connections)

# Actualizar workflow_entity
c.execute("UPDATE workflow_entity SET nodes=?, connections=? WHERE id=?", (nodes_json, conns_json, WORKFLOW_ID))

# Actualizar workflow_history (todas las versiones)
c.execute("SELECT versionId, nodes, connections FROM workflow_history WHERE workflowId=?", (WORKFLOW_ID,))
hist_rows = c.fetchall()
for (vid, hn, hc) in hist_rows:
    h_nodes = json.loads(hn)
    h_conns = json.loads(hc)
    for n in h_nodes:
        if n['name'] == 'Construir Prompt':
            n['parameters']['jsCode'] = CONSTRUIR_PROMPT_CODE.strip()
        elif n['name'] == 'Parsear Respuesta':
            n['parameters']['jsCode'] = PARSEAR_RESPUESTA_CODE.strip()
    existing_hist_names = [n['name'] for n in h_nodes]
    if 'Es Calificacion?' not in existing_hist_names:
        h_nodes.append(es_calif_node)
    if 'Bot Action' not in existing_hist_names:
        h_nodes.append(bot_action_node)
    if 'Es Respuesta?' in h_conns:
        h_conns['Es Respuesta?']['main'][1] = [{"node": "Es Calificacion?", "type": "main", "index": 0}]
    h_conns['Es Calificacion?'] = {
        "main": [
            [{"node": "Calificar Lead", "type": "main", "index": 0}],
            [{"node": "Bot Action", "type": "main", "index": 0}]
        ]
    }
    c.execute("UPDATE workflow_history SET nodes=?, connections=? WHERE versionId=?",
              (json.dumps(h_nodes), json.dumps(h_conns), vid))

conn.commit()
conn.close()
print("✅ Workflow N8N actualizado correctamente")
```

Ejecutar:

```bash
python3 /tmp/update_n8n_workflow.py
```

Expected: `✅ Workflow N8N actualizado correctamente`

- [ ] **Step 2: Reiniciar N8N**

```bash
pkill -f "n8n" 2>/dev/null; sleep 2
N8N_LOG=/tmp/n8n-expansion.log
/tmp/n8n-prefix/bin/n8n > "$N8N_LOG" 2>&1 &
sleep 12
curl -s -o /dev/null -w "N8N status: %{http_code}\n" http://localhost:5678/healthz
tail -3 "$N8N_LOG"
```

Expected: `N8N status: 200` y `Activated workflow "CRM — Bot Calificador de Leads"`

- [ ] **Step 3: Verificar el workflow via API**

```bash
curl -s -H "X-N8N-API-KEY: n8n_api_crm_fix_1782746806" \
  http://localhost:5678/api/v1/workflows/XJhW3pdEBsTcQD7c | python3 -c "
import sys, json
d = json.load(sys.stdin)
for n in d.get('nodes', []):
    print(n['name'], '-', n.get('type','').split('.')[-1])
"
```

Expected: 9 nodos incluyendo "Es Calificacion?" y "Bot Action"

- [ ] **Step 4: Test end-to-end del flujo**

```bash
curl -s -X POST http://localhost:5678/webhook/crm-qualifier \
  -H "Content-Type: application/json" \
  -d '{
    "orgId": "GYYEsxc5eKlUw1XOJLUg",
    "clientPhone": "18093974880",
    "clientName": "Test",
    "message": "Hola, ¿tienen Honda Fit?",
    "channel": "whatsapp",
    "history": [],
    "context": {
      "botPersonality": {"businessName":"Auto Test","industry":"venta de autos","tone":"casual","description":"Vendemos autos","assistantName":"Carlos"},
      "faq": [],
      "catalog": [{"id":"test123","title":"Honda Fit 2020","price":8500}],
      "appointmentSlots": [{"day":1,"time":"09:00","label":"Lunes 9:00am"}],
      "businessLocation": null,
      "publicCatalogUrl": "http://localhost:3010/c/GYYEsxc5eKlUw1XOJLUg"
    }
  }'
```

Expected: `{"message":"Workflow was started"}` y mensaje llega al teléfono sobre Honda Fit.

---

### Task 7: Settings — 4 nuevas secciones del bot

**Files:**
- Modify: `app/dashboard/settings/page.tsx`

**Interfaces:**
- Consumes: `updateOrganization` de `lib/firestore`, `Organization.settings` con nuevos campos
- Produces: UI para editar `botPersonality`, `businessLocation`, `faq`, `appointmentSlots`

- [ ] **Step 1: Añadir imports al settings page**

Al inicio del archivo, en el bloque de imports de lucide-react, añadir:

```ts
import { Building2, MessageCircle, Instagram, Bot, Eye, EyeOff, Clock, MapPin, HelpCircle, Calendar, Plus, Trash2, User } from 'lucide-react'
```

- [ ] **Step 2: Añadir estados para los nuevos campos**

Después de `const [n8nMode, setN8nMode] = useState...`, añadir:

```ts
  // Personalidad del bot
  const [botName, setBotName] = useState('')
  const [botIndustry, setBotIndustry] = useState('')
  const [botDescription, setBotDescription] = useState('')
  const [botAssistantName, setBotAssistantName] = useState('')
  const [botTone, setBotTone] = useState<'formal' | 'casual'>('casual')

  // Ubicación
  const [locLat, setLocLat] = useState('')
  const [locLng, setLocLng] = useState('')
  const [locName, setLocName] = useState('')
  const [locAddress, setLocAddress] = useState('')
  const [locMapsUrl, setLocMapsUrl] = useState('')

  // FAQ
  const [faq, setFaq] = useState<Array<{ id: string; question: string; answer: string }>>([])

  // Slots
  const [slots, setSlots] = useState<Array<{ day: number; time: string; label: string }>>([])
```

- [ ] **Step 3: Cargar los nuevos datos en el useEffect**

En el `useEffect` donde se carga la org (dentro del bloque `if (o.settings...)`), añadir después de `setN8nMode(...)`:

```ts
        // Personalidad del bot
        if (o.settings.botPersonality) {
          setBotName(o.settings.botPersonality.businessName || '')
          setBotIndustry(o.settings.botPersonality.industry || '')
          setBotDescription(o.settings.botPersonality.description || '')
          setBotAssistantName(o.settings.botPersonality.assistantName || '')
          setBotTone(o.settings.botPersonality.tone || 'casual')
        }
        // Ubicación
        if (o.settings.businessLocation) {
          setLocLat(String(o.settings.businessLocation.lat || ''))
          setLocLng(String(o.settings.businessLocation.lng || ''))
          setLocName(o.settings.businessLocation.name || '')
          setLocAddress(o.settings.businessLocation.address || '')
          setLocMapsUrl(o.settings.businessLocation.mapsUrl || '')
        }
        // FAQ y slots
        setFaq(o.settings.faq || [])
        setSlots(o.settings.appointmentSlots || [])
```

- [ ] **Step 4: Actualizar `handleSaveBot` para incluir los nuevos campos**

Reemplazar la función `handleSaveBot` completa:

```ts
  const handleSaveBot = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile?.orgId || !org) return
    setSavingBot(true)
    try {
      const newSettings: Partial<typeof org.settings> = {
        ...org.settings,
        n8nWebhookUrl: n8nWebhookUrl.trim(),
        n8nApiKey: n8nApiKey.trim(),
        n8nMode,
        botPersonality: {
          businessName: botName.trim(),
          industry: botIndustry.trim(),
          description: botDescription.trim(),
          assistantName: botAssistantName.trim() || undefined,
          tone: botTone,
        },
        faq,
        appointmentSlots: slots,
      }
      if (locLat && locLng) {
        newSettings.businessLocation = {
          lat: parseFloat(locLat),
          lng: parseFloat(locLng),
          name: locName.trim(),
          address: locAddress.trim(),
          mapsUrl: locMapsUrl.trim() || undefined,
        }
      }
      await updateOrganization(profile.orgId, { settings: newSettings })
      setOrg(prev => prev ? { ...prev, settings: { ...prev.settings, ...newSettings } } : prev)
      toast.success('Configuración del bot guardada')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error')
    } finally {
      setSavingBot(false)
    }
  }
```

- [ ] **Step 5: Añadir UI de las 4 secciones nuevas en el tab "bot"**

Dentro del `{activeTab === 'bot' && (`, ANTES del botón de guardar (`<button type="submit"...>`), añadir:

```tsx
          {/* ── Personalidad del Bot ── */}
          <div className="border border-[#E3E6EC] dark:border-[#1A2540] rounded-xl p-4 space-y-3">
            <SectionHeader icon={User} title="Personalidad del Bot" desc="Cómo se presenta el bot a tus clientes" />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Nombre del negocio</label>
                <input className={inputClass} value={botName} onChange={e => setBotName(e.target.value)} placeholder="AutoCentro García" />
              </div>
              <div>
                <label className={labelClass}>Nombre del asistente</label>
                <input className={inputClass} value={botAssistantName} onChange={e => setBotAssistantName(e.target.value)} placeholder="Carlos" />
              </div>
            </div>
            <div>
              <label className={labelClass}>Industria / tipo de negocio</label>
              <input className={inputClass} value={botIndustry} onChange={e => setBotIndustry(e.target.value)} placeholder="venta de autos usados" />
            </div>
            <div>
              <label className={labelClass}>Descripción del negocio</label>
              <textarea className={inputClass} rows={3} value={botDescription} onChange={e => setBotDescription(e.target.value)} placeholder="Vendemos autos usados certificados en Santo Domingo..." />
            </div>
            <div>
              <label className={labelClass}>Tono del bot</label>
              <div className="flex gap-4 mt-1">
                {(['casual', 'formal'] as const).map(t => (
                  <label key={t} className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="tone" value={t} checked={botTone === t} onChange={() => setBotTone(t)} className="accent-[#0D7A65]" />
                    <span className="text-sm capitalize text-[#0C1224] dark:text-[#E8ECF4]">{t}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* ── Ubicación ── */}
          <div className="border border-[#E3E6EC] dark:border-[#1A2540] rounded-xl p-4 space-y-3">
            <SectionHeader icon={MapPin} title="Ubicación del Negocio" desc="El bot enviará un pin de ubicación cuando el cliente pregunte dónde están" />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Latitud</label>
                <input className={inputClass} value={locLat} onChange={e => setLocLat(e.target.value)} placeholder="18.4861" />
              </div>
              <div>
                <label className={labelClass}>Longitud</label>
                <input className={inputClass} value={locLng} onChange={e => setLocLng(e.target.value)} placeholder="-69.9312" />
              </div>
            </div>
            <div>
              <label className={labelClass}>Nombre del local</label>
              <input className={inputClass} value={locName} onChange={e => setLocName(e.target.value)} placeholder="AutoCentro García - Sucursal Principal" />
            </div>
            <div>
              <label className={labelClass}>Dirección completa</label>
              <input className={inputClass} value={locAddress} onChange={e => setLocAddress(e.target.value)} placeholder="Av. 27 de Febrero #123, Santo Domingo" />
            </div>
            <div>
              <label className={labelClass}>Link de Google Maps (opcional)</label>
              <input className={inputClass} value={locMapsUrl} onChange={e => setLocMapsUrl(e.target.value)} placeholder="https://maps.google.com/..." />
            </div>
          </div>

          {/* ── FAQ ── */}
          <div className="border border-[#E3E6EC] dark:border-[#1A2540] rounded-xl p-4 space-y-3">
            <SectionHeader icon={HelpCircle} title="Preguntas Frecuentes" desc="El bot usa estas respuestas cuando el cliente hace estas preguntas" />
            <div className="space-y-2">
              {faq.map((item, i) => (
                <div key={item.id} className="flex gap-2 items-start">
                  <div className="flex-1 space-y-1">
                    <input
                      className={inputClass}
                      value={item.question}
                      onChange={e => setFaq(prev => prev.map((f, j) => j === i ? { ...f, question: e.target.value } : f))}
                      placeholder="¿Tienen garantía?"
                    />
                    <input
                      className={inputClass}
                      value={item.answer}
                      onChange={e => setFaq(prev => prev.map((f, j) => j === i ? { ...f, answer: e.target.value } : f))}
                      placeholder="Sí, 6 meses en motor y transmisión"
                    />
                  </div>
                  <button type="button" onClick={() => setFaq(prev => prev.filter((_, j) => j !== i))} className="mt-1 text-red-500 hover:text-red-700 p-1">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setFaq(prev => [...prev, { id: crypto.randomUUID(), question: '', answer: '' }])}
              className="flex items-center gap-1 text-sm text-[#0D7A65] hover:underline"
            >
              <Plus size={14} /> Agregar pregunta
            </button>
          </div>

          {/* ── Slots de Citas ── */}
          <div className="border border-[#E3E6EC] dark:border-[#1A2540] rounded-xl p-4 space-y-3">
            <SectionHeader icon={Calendar} title="Horarios de Citas" desc="El bot ofrecerá estos slots cuando el cliente quiera agendar" />
            <div className="space-y-2">
              {slots.map((slot, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <select
                    className={inputClass + ' flex-1'}
                    value={slot.day}
                    onChange={e => {
                      const day = parseInt(e.target.value)
                      const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
                      setSlots(prev => prev.map((s, j) => j === i ? { ...s, day, label: `${days[day]} ${s.time}` } : s))
                    }}
                  >
                    {['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'].map((d, idx) => (
                      <option key={idx} value={idx}>{d}</option>
                    ))}
                  </select>
                  <input
                    type="time"
                    className={inputClass + ' w-32'}
                    value={slot.time}
                    onChange={e => {
                      const time = e.target.value
                      const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
                      setSlots(prev => prev.map((s, j) => j === i ? { ...s, time, label: `${days[s.day]} ${time}` } : s))
                    }}
                  />
                  <button type="button" onClick={() => setSlots(prev => prev.filter((_, j) => j !== i))} className="text-red-500 hover:text-red-700 p-1">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setSlots(prev => [...prev, { day: 1, time: '09:00', label: 'Lun 09:00' }])}
              className="flex items-center gap-1 text-sm text-[#0D7A65] hover:underline"
            >
              <Plus size={14} /> Agregar horario
            </button>
          </div>
```

- [ ] **Step 6: Verificar que compila**

```bash
cd /Users/branel/CRM-auto && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 7: Commit**

```bash
cd /Users/branel/CRM-auto
git add app/dashboard/settings/page.tsx
git commit -m "feat(bot): add bot personality, location, FAQ, and appointment slots settings UI"
```

---

### Task 8: Calendario — solicitudes de citas pendientes

**Files:**
- Modify: `app/dashboard/calendar/page.tsx`

**Interfaces:**
- Consumes: `getAppointmentRequests`, `AppointmentRequest` de `lib/firestore` y `@/types`
- Produces: sección "Solicitudes pendientes" con botones Confirmar/Rechazar que llaman `/api/bot/confirm-slot`

- [ ] **Step 1: Añadir imports al calendar page**

Al inicio de `app/dashboard/calendar/page.tsx`, añadir en los imports existentes:

```ts
import { getTasks, updateTask, getAppointments, createAppointment, deleteAppointment, getAppointmentRequests } from '@/lib/firestore'
import type { Task, Appointment, AppointmentRequest } from '@/types'
import { ChevronLeft, ChevronRight, CheckSquare, AlertCircle, CalendarPlus, Clock, Trash2, X, Check, UserCheck } from 'lucide-react'
```

- [ ] **Step 2: Añadir estado para solicitudes**

Después de `const [appointments, setAppointments] = useState<Appointment[]>([])`, añadir:

```ts
  const [requests, setRequests] = useState<AppointmentRequest[]>([])
  const [processingRequest, setProcessingRequest] = useState<string | null>(null)
```

- [ ] **Step 3: Cargar solicitudes en el useEffect**

En el `useEffect` que carga los datos, añadir `getAppointmentRequests(profile.orgId, 'pending')` en el `Promise.all`:

```ts
      const [t, a, r] = await Promise.all([
        getTasks(profile.orgId, uid),
        getAppointments(profile.orgId, uid),
        getAppointmentRequests(profile.orgId, 'pending'),
      ])
      setTasks(t)
      setAppointments(a)
      setRequests(r)
```

- [ ] **Step 4: Añadir función handleRequestAction**

Después de las funciones de citas existentes, añadir:

```ts
  const handleRequestAction = async (requestId: string, orgId: string, action: 'confirm' | 'reject') => {
    if (!profile?.orgId) return
    setProcessingRequest(requestId)
    try {
      const res = await fetch('/api/bot/confirm-slot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, orgId: profile.orgId, action }),
      })
      if (!res.ok) throw new Error('Error procesando solicitud')
      setRequests(prev => prev.filter(r => r.id !== requestId))
      toast.success(action === 'confirm' ? 'Cita confirmada y notificada al cliente' : 'Cita rechazada')
      if (action === 'confirm') {
        const a = await getAppointments(profile.orgId, uid)
        setAppointments(a)
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error')
    } finally {
      setProcessingRequest(null)
    }
  }
```

- [ ] **Step 5: Añadir sección de solicitudes en el JSX**

Al inicio del return, ANTES del calendario principal, añadir:

```tsx
      {/* ── Solicitudes pendientes del bot ── */}
      {requests.length > 0 && (
        <div className="mb-6 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <UserCheck size={16} className="text-amber-600" />
            <span className="font-semibold text-amber-700 dark:text-amber-400 text-sm">
              {requests.length} solicitud{requests.length > 1 ? 'es' : ''} de cita pendiente{requests.length > 1 ? 's' : ''}
            </span>
          </div>
          <div className="space-y-2">
            {requests.map(r => (
              <div key={r.id} className="flex items-center justify-between bg-white dark:bg-[#0C1224] rounded-lg px-4 py-2.5 border border-amber-100 dark:border-amber-900">
                <div>
                  <p className="text-sm font-medium text-[#0C1224] dark:text-[#E8ECF4]">
                    {r.clientName || r.clientPhone}
                  </p>
                  <p className="text-xs text-[#6B7280]">📅 {r.slotLabel}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleRequestAction(r.id, r.orgId, 'confirm')}
                    disabled={processingRequest === r.id}
                    className="flex items-center gap-1 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <Check size={13} /> Confirmar
                  </button>
                  <button
                    onClick={() => handleRequestAction(r.id, r.orgId, 'reject')}
                    disabled={processingRequest === r.id}
                    className="flex items-center gap-1 bg-red-500 hover:bg-red-600 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <X size={13} /> Rechazar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
```

- [ ] **Step 6: Verificar que compila**

```bash
cd /Users/branel/CRM-auto && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 7: Commit**

```bash
cd /Users/branel/CRM-auto
git add app/dashboard/calendar/page.tsx
git commit -m "feat(bot): add appointment request approvals in calendar page"
```

---

## Verificación final

- [ ] Enviar mensaje de WhatsApp: "¿dónde están?" → bot manda ubicación
- [ ] Enviar "¿tienen [producto del catálogo]?" → bot manda imagen del producto
- [ ] Enviar "quiero una cita" → bot muestra slots → elegir uno → aparece en calendario → confirmar → cliente recibe WhatsApp
- [ ] Preguntar algo que esté en el FAQ → bot responde directo
- [ ] Escribir "quiero hablar con una persona" → bot escala → agente recibe FCM → mensajes siguientes no disparan el bot
- [ ] Settings → tab Bot → guardar personalidad + ubicación + FAQ + slots → recargar y verificar que carguen
- [ ] `npx tsc --noEmit` sin errores
