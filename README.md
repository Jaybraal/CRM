# CRM multicanal

CRM multi-tenant con bandeja unificada: las conversaciones de **WhatsApp** y
**correo** llegan al mismo inbox, asociadas al mismo cliente, sin que el
comercial tenga que saltar entre aplicaciones.

> Un contacto escribe por WhatsApp, responde un correo tres días después y
> rellena un formulario la semana siguiente. Para el negocio es una sola
> conversación; para las herramientas, tres hilos inconexos. Unificarlos es el
> problema que resuelve este proyecto.

## Canales

- **WhatsApp** — servidor dedicado sobre Baileys (`baileys-server/`), desplegado
  aparte porque mantiene una sesión persistente que no encaja en el modelo
  *serverless* de Vercel.
- **Correo** — envío y **lectura de respuestas por IMAP**, para que una
  contestación entre al hilo en vez de perderse en una bandeja externa.
- **Formularios públicos** — captación por organización (`/form/[orgId]`).
- **Importación CSV** de leads.

Los clientes con más de un canal muestran pestañas por canal, manteniendo la
ficha única.

## Módulos

| Módulo | Función |
|---|---|
| Inbox | bandeja unificada de conversaciones |
| Clientes | fichas, historial y canales |
| Pipeline | etapas de la oportunidad comercial |
| Broadcast | campañas y envíos masivos |
| Bot | respuestas automáticas |
| Tareas / Calendario | seguimiento comercial |
| Catálogo / Categorías | productos y servicios |
| Equipo / Usuarios | roles y permisos |
| Reportes | métricas de actividad |
| Onboarding | alta guiada de la organización |

## Stack

| Capa | Tecnología |
|---|---|
| Framework | Next.js (App Router) · TypeScript |
| Datos | Firebase / Firestore (con `firestore.rules` e índices versionados) |
| Mensajería | Baileys (WhatsApp) · IMAP/SMTP |
| Pagos | Stripe |
| Despliegue | Vercel (app) · Railway (servidor de WhatsApp) |

## Decisiones de diseño

- **Reglas de seguridad versionadas** — `firestore.rules` e
  `firestore.indexes.json` viven en el repo, no en la consola de Firebase: el
  control de acceso se revisa en el *pull request* como cualquier otro código.
- **Checkout de Stripe en un solo sitio** — existía una implementación duplicada
  en el backend Express; se eliminó para dejar una única ruta de pago.
- **Servidor de WhatsApp separado** — la sesión de Baileys es persistente y con
  estado; aislarla evita arrastrar esa restricción a toda la aplicación.

## Licencia

Propietario — todos los derechos reservados. Visible para evaluación técnica;
no se autoriza su uso, copia ni distribución. Ver [LICENSE](LICENSE).
