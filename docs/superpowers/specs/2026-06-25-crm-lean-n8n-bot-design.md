# CRM-auto → Lean Base + Bot N8N

**Fecha:** 2026-06-25
**Estado:** Aprobado por usuario — pendiente de implementación

---

## Contexto y objetivo

CRM-auto es un CRM multi-tenant (WA + Instagram) que había acumulado funcionalidades que N8N puede reemplazar conversacionalmente: templates de mensajes, formularios de calificación, autorespuestas, configuración manual de etapas. El objetivo es convertirlo en un **panel de observación y acción humana** — todo lo que sea automatizable queda en N8N, no en la UI.

El resultado es un CRM universal: funciona igual para un restaurante, una clínica, un taller o cualquier tipo de negocio, porque el bot N8N adapta el flujo conversacional por industria sin que el cliente tenga que configurar nada en el CRM.

---

## Diseño del Sidebar

### Antes (10 ítems)
Dashboard, Inbox WA/IG, Pipeline, Calendario, Catálogo, Nexo Connect, Blueprints, Ajustes, Super Admin, Alex IA (footer)

### Después (6 ítems)
| # | Ruta | Ícono |
|---|---|---|
| 1 | `/dashboard` | LayoutDashboard |
| 2 | `/dashboard/inbox` | Inbox |
| 3 | `/dashboard/clients` | Users |
| 4 | `/dashboard/pipeline` | KanbanSquare |
| 5 | `/dashboard/bot` | Bot |
| 6 | `/dashboard/settings` | Settings |

Super Admin (`/admin`) se mantiene pero solo visible para `super_admin`.
Páginas `tasks`, `team`, `users`, `reports`, `broadcast`, `categories`, `instagram`, `profile` quedan en código, accesibles por URL, sin aparecer en nav.

### Eliminados del sidebar y del proyecto
- `Nexo Connect` → `/dashboard/nexo/page.tsx` eliminado
- `Blueprints` → `/dashboard/marketplace/page.tsx` eliminado
- `Calendario` → ítem de nav eliminado (página `/dashboard/calendar` se conserva en código)
- `Catálogo` → ítem de nav eliminado (página `/dashboard/catalog` se conserva en código)
- `Alex IA` → botón footer eliminado, `components/ui/ChatAssistant.tsx` eliminado, `app/api/chat/route.ts` eliminado, `context/AlexChatContext.tsx` eliminado

---

## Diseño de Settings

### Antes (5 tabs)
General · Conexiones · Pipeline · Mensajes · Avanzado

### Después (3 tabs)
| Tab | Contenido |
|---|---|
| **Negocio** | Nombre org, industria, número WA, horario de atención (días + hora apertura/cierre), URL web |
| **Conexiones** | WhatsApp QR (Baileys) + Instagram OAuth |
| **Bot N8N** | URL webhook, API key secreta, modo de activación, indicador de conexión |

### Tabs eliminadas y por qué
- **Pipeline** — etapas fijas por defecto son suficientes; N8N mueve los deals automáticamente
- **Mensajes** — templates, autorespuesta, mensaje de seguimiento 24h y formulario de calificación son reemplazados por el flujo conversacional de N8N
- **Avanzado** — webhooks salientes, formularios de captura web, limpieza de datos y Stripe se eliminan de la UI; los webhooks salen desde N8N directamente

---

## Diseño del módulo Bot N8N

### Tab "Bot N8N" en Settings
```
┌─────────────────────────────────────┐
│ URL Webhook N8N         [input]     │
│ API Key secreta         [input]     │
│ Modo de activación                  │
│   ○ Siempre activo                  │
│   ○ Solo fuera de horario           │
│   ○ Desactivado                     │
│ [Probar conexión]  estado: ● Online │
└─────────────────────────────────────┘
```

### Dashboard `/dashboard/bot/page.tsx`
- Indicador de estado (activo / inactivo)
- Contadores: leads capturados por el bot, conversaciones manejadas hoy
- Tabla de últimos N leads: nombre, teléfono, resumen de calificación, fecha
- Botón "Configurar bot" → Settings > Bot N8N

### API routes nuevas

**`POST /api/bot/webhook`** — N8N llama aquí al terminar de calificar un cliente.
```typescript
// Body esperado desde N8N:
{
  orgId: string
  name: string
  phone: string
  email?: string
  summary: string       // resumen de calificación en texto libre
  stage?: string        // etapa del pipeline destino
  appointmentAt?: string // ISO 8601 si agendó cita
}
// CRM crea automáticamente: Cliente + Deal + Nota con summary
```

**`POST /api/bot/trigger`** — CRM llama aquí cuando llega un mensaje y no hay agente disponible.
```typescript
// Body que el CRM envía a N8N:
{
  orgId: string
  clientPhone: string
  clientName?: string
  message: string       // último mensaje recibido
  channel: 'whatsapp' | 'instagram'
}
```

---

## Flujo N8N ↔ CRM

```
Mensaje WA/IG entrante
  → CRM recibe (Baileys / Instagram webhook)
  → ¿Agente disponible en horario configurado?
      SI  → Inbox (humano atiende normalmente)
      NO  → POST /api/bot/trigger → N8N toma el control
              → N8N conversa y califica al cliente
              → N8N termina calificación
              → POST /api/bot/webhook con datos
              → CRM crea: Cliente + Deal + Nota automáticamente
              → Conversación aparece en Inbox con tag [Bot]
```

La lógica de "¿hay agente disponible?" se evalúa comparando la hora actual contra `businessHours` guardado en la org + el modo configurado en Bot N8N.

---

## Orden de ejecución

1. **Limpieza** — eliminar Alex (ChatAssistant + API route + contexto) + Nexo + referencias en Sidebar
2. **Sidebar** — reducir a 6 ítems, agregar ruta `/dashboard/bot`
3. **Settings** — quitar tabs Pipeline y Mensajes, renombrar General → Negocio, agregar tab Bot N8N
4. **API routes** — `app/api/bot/webhook/route.ts` y `app/api/bot/trigger/route.ts`
5. **Dashboard bot** — `app/dashboard/bot/page.tsx`
6. **Lógica de trigger** — en el webhook de WA/IG existente, añadir evaluación de disponibilidad y llamada a `/api/bot/trigger`

---

## Pantalla de onboarding (aprobada)

Al registrar una organización nueva, mostrar un wizard de 3 pasos antes de entrar al dashboard:

```
Paso 1: Conecta WhatsApp
  → Escanear QR de Baileys (mismo componente que Settings > Conexiones)

Paso 2: Configura tu bot N8N
  → Pegar URL del webhook + API key
  → Seleccionar modo de activación

Paso 3: Cuéntanos de tu negocio
  → Nombre de la organización
  → Industria (restaurante / real estate / clínica / taller / agencia / salón / otro)
  → Horario de atención

→ [Ir al dashboard]
```

Ruta: `app/dashboard/onboarding/page.tsx`
Lógica: si `org.settings.onboardingCompleted !== true`, redirigir a `/dashboard/onboarding` antes de entrar al dashboard principal.

---

## Invariantes que no cambian

- Auth multi-tenant (Firebase) — sin tocar
- Baileys (WhatsApp) — sin tocar
- Instagram webhook — sin tocar
- Pipeline y Clientes pages — sin tocar (solo se eliminan sus tabs de Settings)
- Stripe billing — se elimina de Settings UI pero la API route `/api/billing/` se conserva
- Super Admin — sin tocar
