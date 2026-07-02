# Bot Expansion — NEXO CRM
**Fecha:** 2026-06-29  
**Estado:** Aprobado

## Objetivo

Expandir el bot de WhatsApp del CRM para que sea un asistente completo del negocio: responde con la personalidad de la empresa, busca productos en el catálogo, manda ubicación, agenda citas con slots predefinidos y aprobación del agente, responde FAQ automáticamente, y escala a humano cuando es necesario.

---

## Arquitectura

```
WhatsApp → Baileys (:3002) → /api/whatsapp/baileys
  → chequea bot_conversations.status (si 'escalated' → no dispara N8N)
  → /api/bot/trigger (enriquece payload: catálogo, FAQ, slots, ubicación, personalidad)
  → N8N → Groq (con contexto completo del negocio)
  → action: REPLY | QUALIFY | SEND_PRODUCT | LOCATION | SHOW_SLOTS | BOOK_SLOT | ESCALATE
  → /api/bot/action (endpoint unificado, despacha por actionType)
  → Baileys /send | /send-image | /send-location
  → Cliente en WhatsApp
```

---

## Modelo de Datos

### `Organization.settings` (adiciones a `types/index.ts`)

```ts
botPersonality?: {
  businessName: string      // "AutoCentro García"
  industry: string          // "venta de autos usados"
  tone: 'formal' | 'casual'
  description: string       // descripción libre del negocio
  assistantName?: string    // nombre del asistente virtual
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
  day: number     // 0=Dom…6=Sáb
  time: string    // "09:00"
  label: string   // "Lunes 9:00am"
}>
```

### `Appointment` (adiciones)

```ts
status?: 'pending' | 'confirmed' | 'rejected'
clientPhone?: string
slotIndex?: number
```

### Nueva subcolección: `organizations/{orgId}/appointment_requests/{id}`

```ts
{
  clientPhone: string
  clientName: string
  slotLabel: string     // "Lunes 9:00am"
  slotDay: number
  slotTime: string
  status: 'pending' | 'confirmed' | 'rejected'
  createdAt: Timestamp
}
```

### `bot_conversations/{phone}` (campo nuevo)

```ts
status: 'active' | 'escalated'
```

---

## API Layer

### `/api/bot/trigger` — modificar existente

Antes de llamar N8N, fetch en paralelo desde Firestore:
- Top 20 productos del catálogo (id, title, price, available, photos[0])
- `botPersonality`, `faq`, `businessLocation`, `appointmentSlots` de org settings

Envía todo como campo `context` en el payload a N8N.

### `/api/bot/action` — nuevo endpoint unificado

**Ruta:** `POST /api/bot/action?secret=<BOT_INTERNAL_SECRET>`

**Body:**
```ts
{
  actionType: 'REPLY' | 'SEND_PRODUCT' | 'LOCATION' | 'SHOW_SLOTS' | 'BOOK_SLOT' | 'ESCALATE'
  orgId: string
  clientPhone: string
  clientName: string
  channel: 'whatsapp'
  message: string           // texto para el cliente
  productId?: string        // solo SEND_PRODUCT
  slotIndex?: number        // solo BOOK_SLOT
  lead?: object             // solo QUALIFY (para compatibilidad)
}
```

**Comportamiento por actionType:**

| actionType | Acción |
|---|---|
| `REPLY` | Guarda en historial + envía texto vía Baileys `/send` |
| `SEND_PRODUCT` | Busca producto en Firestore → envía imagen vía `/send-image` + texto con precio y link catálogo |
| `LOCATION` | Envía texto + pin vía Baileys `/send-location` |
| `SHOW_SLOTS` | Envía texto con slots formateados (Groq ya lo formatea, solo enviar message) |
| `BOOK_SLOT` | Crea `appointment_request` (status: pending) + FCM a agentes + confirma al cliente |
| `ESCALATE` | Envía message al cliente + FCM a agentes + setea `bot_conversations.status = 'escalated'` |

### `/api/bot/confirm-slot` — nuevo

**Body:** `{ requestId, orgId, action: 'confirm' | 'reject' }`

- `confirm` → crea `Appointment` (status: confirmed) + actualiza request + manda WhatsApp al cliente
- `reject` → actualiza request (rejected) + manda mensaje alternativo al cliente

### `/api/whatsapp/baileys` — modificar

Antes de disparar N8N, leer `bot_conversations/{normalizedPhone}.status`.  
Si es `'escalated'` → solo guarda mensaje en Firestore, no llama `/api/bot/trigger`.

---

## N8N Workflow

### Nodo "Construir Prompt" (reemplazar jsCode)

Usa `context` del payload para construir sistema prompt dinámico:

```
Eres [assistantName], el asistente virtual de [businessName].
Negocio: [industry]. [description]
Tono: [formal/casual].

IMPORTANTE: Solo respondes sobre temas del negocio. Si preguntan algo fuera, redirige amablemente.

CATÁLOGO:
- [title] | $[price] | ID:[id] | [available ? 'Disponible' : 'No disponible']
...

FAQ:
- [question] → [answer]
...

HORARIOS DE CITAS:
1. [label]
2. [label]

UBICACIÓN: [name] — [address]

Responde ÚNICAMENTE con JSON válido:
{
  "action": "REPLY"|"SEND_PRODUCT"|"LOCATION"|"SHOW_SLOTS"|"BOOK_SLOT"|"QUALIFY"|"ESCALATE",
  "message": "texto para el cliente",
  "productId": "id del producto (solo SEND_PRODUCT)",
  "slotIndex": 0,
  "lead": { "name":"","email":"","summary":"","stage":"Nuevo" }
}
```

### Nodo "Parsear Respuesta" (actualizar)

Extrae: `action`, `message`, `productId`, `slotIndex`, `lead`.  
Pasa `orgId`, `clientPhone`, `clientName`, `channel` del nodo anterior.

### Nodo "Router" (renombrar "Es Respuesta?")

Switch por `action`:
- `REPLY` → nodo "Responder al Lead" (existente, llama `/api/bot/reply`)
- `QUALIFY` → nodo "Calificar Lead" (existente)
- Todo lo demás → **nuevo nodo "Bot Action"** → `POST /api/bot/action?secret=...`

El nodo "Bot Action" envía el payload completo con `actionType = action`.

---

## Frontend

### Settings → tab "Bot" (nuevas secciones)

1. **Personalidad del Bot** — businessName, industry, assistantName, tone (radio), description (textarea)
2. **Ubicación del Negocio** — lat, lng, name, address, mapsUrl (opcional)
3. **FAQ** — lista editable de pares pregunta/respuesta con botón "+ Agregar"
4. **Slots de Citas** — lista de horarios predefinidos con selector de día + hora + botón "+ Agregar"

Todas las secciones guardan en `organizations/{orgId}` vía `updateDoc`.

### Calendario — nueva sección "Solicitudes pendientes"

- Badge con número de solicitudes `pending` en el título del calendario
- Lista de cards con: nombre del cliente, slot solicitado, tiempo transcurrido
- Botones [✓ Confirmar] [✗ Rechazar] → llaman `/api/bot/confirm-slot`
- Al confirmar/rechazar: actualiza lista en tiempo real y el cliente recibe WhatsApp

---

## Flujos por feature

### Ubicación
`Cliente: "¿dónde están?"` → Groq: `{ action: "LOCATION", message: "Aquí te mando nuestra ubicación:" }` → `/api/bot/action` envía texto + pin

### Producto
`Cliente: "¿tienen Honda Fit?"` → Groq (con catálogo): `{ action: "SEND_PRODUCT", message: "¡Sí tenemos! Aquí la ficha:", productId: "abc123" }` → `/api/bot/action` busca producto, envía imagen + precio + link catálogo

### Citas
`Cliente: "Quiero una cita"` → Groq: `{ action: "SHOW_SLOTS", message: "Estos son nuestros horarios:\n1. Lunes 9am\n2. Martes 3pm" }` → Cliente elige → Groq: `{ action: "BOOK_SLOT", slotIndex: 0, message: "Perfecto, solicité el Lunes 9am. Un asesor confirmará pronto." }` → Agente aprueba en calendario → bot confirma al cliente

### FAQ
`Cliente: "¿tienen garantía?"` → Groq (con FAQ en prompt): responde directamente con `{ action: "REPLY", message: "Sí, ofrecemos 6 meses de garantía en motor y transmisión." }`

### Escalado
`Cliente: "quiero hablar con alguien"` → Groq: `{ action: "ESCALATE", message: "Entendido, te conecto con un asesor ahora." }` → FCM a agentes + `bot_conversations.status = 'escalated'` → bot no vuelve a responder hasta que agente restablezca

---

## Archivos a crear/modificar

| Archivo | Acción |
|---|---|
| `types/index.ts` | Agregar campos a `Organization.settings` y `Appointment` |
| `app/api/bot/action/route.ts` | CREAR — endpoint unificado |
| `app/api/bot/confirm-slot/route.ts` | CREAR — aprobación de citas |
| `app/api/bot/trigger/route.ts` | MODIFICAR — fetch contexto |
| `app/api/whatsapp/baileys/route.ts` | MODIFICAR — chequear status escalated |
| `lib/firestore.ts` | AGREGAR — getAppointmentRequests, createAppointmentRequest, updateAppointmentRequest |
| `app/dashboard/settings/page.tsx` | MODIFICAR — 4 nuevas secciones en tab Bot |
| `app/dashboard/calendar/page.tsx` | MODIFICAR — sección solicitudes pendientes |
| N8N workflow (SQLite) | MODIFICAR — Construir Prompt, Parsear Respuesta, Router, Bot Action node |
