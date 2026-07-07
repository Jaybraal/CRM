# STOD Lead Engine — Diseño

**Fecha:** 2026-07-06
**Estado:** Fase 1 en implementación · Fase 2 diferida
**Repo host:** CRM-auto (rama `feat/lead-engine-gmail`)

## Objetivo

Conseguir clientes para STOD (sistema de odontología) de forma sistemática: una base de
datos estructurada de clínicas prospecto, con envío de outreach por email (Gmail),
personalizado por idioma, con secuencia de seguimiento automática y estado en el CRM.

A largo plazo, el mismo motor sirve para captar clientes de cualquier otro producto
(restaurantes, hoteles, etc.), pero **este spec no construye eso todavía** (ver Fase 2).

## Decisión de fondo: reutilizar, no reconstruir

CRM-Auto ya es multi-tenant (`orgId`, roles), con `Client`, `Deal`, `PipelineStage`,
`EmailThread`, cifrado AES-256-GCM (`lib/encrypt.ts`), secretos por-org en `org_tokens`,
y un cron cada 5 min (`app/api/cron/send-scheduled`). El outreach de STOD vive **dentro
de CRM-Auto como una organización propia** (`orgId` dedicado, ej. `stod-growth`),
reutilizando todo eso. Lo único genuinamente nuevo es el envío por Gmail y la carga de
leads. El scraper/enriquecimiento (Fase 2) se construye aparte cuando el mensaje esté
validado.

## Alcance acordado

- **Vertical:** solo STOD (clínicas dentales) por ahora. Campo `product` existe pero con
  un solo valor (`"stod"`).
- **Idiomas:** modelo guarda `language` (es/en/de). Plantillas para los tres. Los 13 leads
  iniciales son RD → `es`.
- **Automatización:** secuencia día 0/5/10/20 automática, con un gate humano de un click
  para activar el día 0 de cada lote (revisar los emails generados antes de que salgan).
  De ahí en adelante corre sola.

---

## Fase 1 — Lo que se construye ahora

### 1. Integración Gmail en CRM-Auto

**Por qué Gmail SMTP + App Password (no Gmail API/OAuth):** para enviar el propio outreach
desde la propia cuenta, a bajo volumen, SMTP con contraseña de aplicación es el camino
pragmático — funciona en minutos, sin montar proyecto en Google Cloud ni consent screen.
La cuenta habilita 2FA y genera una app password de 16 caracteres; el CRM la guarda
cifrada.

- **Almacenamiento:** `org_tokens/{orgId}` con campos `gmail_user` (email) y
  `gmail_app_password` (cifrado con `encrypt()`). Sigue el patrón exacto de `ig_token`.
- **Backend settings** (`app/api/settings/route.ts`):
  - `POST action=save_gmail_credentials` → valida y guarda cifrado.
  - `GET action=get_gmail_status` → devuelve `{ configured: boolean, gmail_user }`.
  - `POST action=test_gmail` → envía un email de prueba a la propia cuenta para verificar.
- **Envío** (`app/api/email/send-gmail/route.ts`, nuevo): usa `nodemailer` vía
  `smtp.gmail.com`, lee credenciales de `org_tokens`, envía, y guarda el hilo en
  `organizations/{orgId}/clients/{clientId}/emails` (mismo esquema que el envío Resend).
  Cada email incluye pie con opción de baja (cumplimiento CAN-SPAM/RGPD).
- **UI** (`app/dashboard/settings/page.tsx`): sección "Gmail / Email de captación" con
  input de email + app password, indicador de estado, botón de prueba, y un enlace a las
  instrucciones de cómo generar la app password.

### 2. Modelo de leads (extensión de `Client`)

Campos nuevos, todos opcionales (Firestore schemaless, no rompe nada existente):
`specialty`, `language` (`'es'|'en'|'de'`), `product` (`'stod'`), `opportunityScore`
(0-100), `enrichmentSummary`, `signals` (objeto: `hasWhatsapp`, `hasOnlineBooking`,
`hasChatbot`, `hasSSL`, `websiteLooksOld`, `googleRating`), `website`, `discoverySource`
(`'manual'|'places'|'directory'`). El estado "Contactado"/"Respondió" de la tabla ya lo
cubren `status`/`pipelineStage` — no se duplican.

### 3. Carga de los 13 leads iniciales

Script/endpoint de carga que inserta los 13 contactos reales ya recopilados (clínicas
dentales RD) como `Client` en el org `stod-growth`, con `language='es'`,
`discoverySource='manual'`, `product='stod'`.

### 4. Emails multilingües + personalización

- Plantillas base por idioma (es/en/de) con el ángulo validado por la investigación de
  mercado (no-shows 12-30%, recepcionista gastando ~4h/día en confirmaciones).
- Personalización por lead vía **Groq** (mismo patrón `fetch` a la API que ya usan STOD y
  MUSAWEB, sin SDK): inserta nombre de la clínica y una observación concreta del
  `enrichmentSummary`. En Fase 1, sin enrichment automático, la observación se deja
  editable manualmente.

### 5. Secuencia de seguimiento (día 0/5/10/20)

- Colección `organizations/{orgId}/outreach_emails` con `sendAt`, `status`
  (`pending|sent|failed|stopped`), `step` (0/5/10/20), `clientId`, `language`.
- Cron nuevo `app/api/cron/send-outreach/route.ts` (patrón idéntico al
  `send-scheduled` de WhatsApp): recoge `outreach_emails` con `sendAt<=now` y
  `status=pending`, envía por Gmail, avanza el estado.
- **Gate humano:** el paso día 0 de un lote arranca en `status=draft`; requiere un click
  de "Activar secuencia" tras revisar. Pasos 5/10/20 se programan automáticamente al
  activar.
- **Parar al responder:** por ahora manual — marcar el lead como "Respondió" pone los
  `outreach_emails` pendientes de ese cliente en `stopped`.

---

## Fase 2 — Diferido (NO se construye ahora)

Se construye cuando el mensaje esté validado (≥1 respuesta/cierre de los 13 manuales):

- **Motor de descubrimiento (Python):** script CLI `discover.py --query --location
  --language`. Google Places API para encontrar negocios; Playwright + BeautifulSoup para
  visitar cada sitio y extraer email/señales. Parametrizado desde el día 1 para que
  agregar un vertical nuevo sea cambiar el comando.
- **Enriquecimiento + score automático:** detecta WhatsApp/booking/chatbot/SSL/web
  antigua/rating y calcula `opportunityScore`.
- **Multi-vertical real, exportación (Excel/CSV/Airtable/Notion), dashboard del engine,
  detección automática de respuestas por email entrante.**

## Riesgos / cumplimiento

- **Reputación del dominio/cuenta:** Gmail gratis limita ~500 destinatarios/día. A 13 leads
  es trivial; al escalar, migrar a dominio propio verificado. El envío respeta límites de
  tasa.
- **Legalidad:** solo datos de contacto públicos de empresas; cada email con opción de
  baja; mensajes dirigidos y relevantes, no masivos indiscriminados (CAN-SPAM / RGPD).

## No-objetivos (YAGNI en Fase 1)

Scraper, OAuth de Google, multi-vertical, exportadores, dashboard propio del engine,
parsing de respuestas entrantes.
