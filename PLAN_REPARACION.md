# Plan de reparación CRM-Auto — guía para subagentes (Haiku)

> Auditoría del 2026-06-14. Cada tarea trae: **archivo + línea exacta + el cambio
> literal + cómo verificar**. Los subagentes NO deben improvisar ni "mejorar" cosas
> fuera de su bloque. Si un bloque dice "no tocar X", respetarlo.
>
> Directorio de trabajo: `/Users/branel/CRM-auto`
> El servidor de WhatsApp está en `/Users/branel/CRM-auto/baileys-server`.
>
> Orden de prioridad: **B1 y B2 son los problemas que el usuario reportó**
> (notas de voz + desconexión). B3–B7 son robustez. Hacer en orden.

---

## RESUMEN DE LA AUDITORÍA (contexto para todos los subagentes)

Arquitectura:
- **CRM**: Next.js 16 + React 19 + Firebase (Firestore/Auth/Storage) → se despliega en **Vercel**.
- **baileys-server/**: proceso Node aparte (`index.js`, ~1000 líneas) que mantiene la
  conexión WebSocket con WhatsApp vía `@whiskeysockets/baileys`. Habla con el CRM por
  HTTP. **Debe correr 24/7 en Railway**, NO en el portátil.
- El CRM llama al baileys-server vía `BAILEYS_URL`. Hoy `BAILEYS_URL=http://localhost:3002`
  (local). El auth de WhatsApp se persiste en Firestore (`whatsapp_sessions/<orgId>/auth`),
  así que el servidor sobrevive reinicios sin re-escanear QR.

Estado verificado hoy:
- `npx tsc --noEmit` → **0 errores** (el build NO está roto por tipos).
- La lógica de reconexión de baileys (watchdog cada 3 min, backoff exponencial, locks
  anti-socket-duplicado, caché de auth en memoria) está **bien hecha**. La desconexión
  NO es un bug de código: es que el proceso corre en local y muere cuando el Mac
  duerme / se cierra la terminal / cambia el wifi.

---

## B1 — NOTAS DE VOZ NO SE ENVÍAN  ⭐ (causa raíz encontrada)

**Severidad: ALTA. Es el bug nº1 que reportó el usuario.**

**Archivo:** `baileys-server/index.js` — función `transcodeToOpus()`, líneas **49–82**.

**Diagnóstico (verificado):** la función transcodifica el audio a un archivo `.ogg`
con este comando ffmpeg (líneas 58–63):
```js
const proc = spawn(FFMPEG, [
  '-y', '-i', inFile,
  '-avoid_negative_ts', 'make_zero',
  '-ac', '1',
  outFile,                       // outFile = wa_out_<id>.ogg
], { stdio: ['ignore', 'pipe', 'pipe'] })
```
NO especifica códec de audio. Cuando ffmpeg escribe un `.ogg` sin `-c:a`, **NO usa
Opus** — usa el códec por defecto del contenedor ogg (flac/vorbis según el build;
verificado hoy: en este Mac produce **flac**). Pero luego el resultado se envía a
WhatsApp marcado como Opus (líneas 937–941):
```js
audio: oggBuffer,
mimetype: 'audio/ogg; codecs=opus',
ptt: true,
```
WhatsApp exige **OGG/Opus real** para notas de voz (PTT). Bytes flac/vorbis con
etiqueta "opus" → WhatsApp rechaza o no las reproduce como nota de voz. **Ese es el bug.**

**Acción — reemplazar los args del spawn (líneas 58–63) por:**
```js
const proc = spawn(FFMPEG, [
  '-y', '-i', inFile,
  '-avoid_negative_ts', 'make_zero',
  '-ac', '1',
  '-ar', '16000',
  '-c:a', 'libopus',
  '-b:a', '32k',
  '-application', 'voip',
  outFile,
], { stdio: ['ignore', 'pipe', 'pipe'] })
```
(Se añaden `-ar 16000 -c:a libopus -b:a 32k -application voip`. Son exactamente los
parámetros que WhatsApp usa para sus notas de voz: 16 kHz, mono, 32 kbps, Opus modo voz.)

**Verificar:**
1. Test aislado de ffmpeg (debe imprimir `codec_name=opus`):
   ```bash
   ffmpeg -f lavfi -i "sine=frequency=440:duration=1" -avoid_negative_ts make_zero \
     -ac 1 -ar 16000 -c:a libopus -b:a 32k -application voip /tmp/t.ogg -y 2>/dev/null
   ffprobe -v error -show_entries stream=codec_name -of default=nw=1 /tmp/t.ogg
   rm -f /tmp/t.ogg
   ```
2. Con el baileys-server corriendo y una sesión conectada, grabar una nota de voz
   desde el chat del CRM y confirmar que llega a WhatsApp como nota de voz reproducible.
3. En los logs del servidor debe verse: `audio transcodificado: <n>→<m> bytes`.

**NO tocar:** la rama `isOggOpus(rawBuffer)` (líneas 922–931) ya envía bien el audio
que YA viene en opus (Firefox); el fix es solo para el camino de transcodificación
(Chrome/Safari graban webm/mp4 → hay que convertir).

---

## B2 — EL SERVIDOR BAILEYS SE DESCONECTA  ⭐ (problema arquitectónico, no de código)

**Severidad: ALTA. Es el bug nº2 que reportó el usuario.**

**Diagnóstico:** `BAILEYS_URL=http://localhost:3002` y `CRM_URL=http://localhost:3001`
→ todo corre en el portátil. Una conexión Baileys es un WebSocket persistente a
WhatsApp que tiene que estar **siempre encendido**. En un portátil se cae cuando: el
Mac entra en reposo, se cierra la terminal, cambia el wifi, o se mata el proceso `node`.
La reconexión del código ayuda, pero no puede arreglar un proceso que ya no existe.

**No hay archivos de despliegue para Railway en `baileys-server/`** (solo `nixpacks.toml`).
Falta `Procfile`/`railway.json` y la variable `BAILEYS_URL` de producción.

### Esta tarea requiere acciones del USUARIO (no se puede automatizar entera). El subagente debe:

**B2.1 — Crear los archivos de despliegue que faltan.**

Crear `baileys-server/Procfile`:
```
web: node index.js
```
Confirmar que `baileys-server/package.json` tiene `"start": "node index.js"` (ya lo tiene)
y `"type": "module"` (ya lo tiene).

**B2.2 — Documentar para el usuario los pasos manuales** (escribir en un archivo
`baileys-server/DEPLOY_RAILWAY.md` con este contenido):
- Crear un servicio Railway apuntando a la carpeta `baileys-server/` (root directory).
- Variables de entorno en ese servicio Railway:
  - `CRM_URL` = la URL pública del CRM en Vercel (ej. `https://crm-auto.vercel.app`).
  - `PORT` = Railway lo inyecta solo; el código ya hace `process.env.PORT || 3002`.
  - `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`,
    `FIREBASE_ADMIN_PRIVATE_KEY` (las mismas del CRM; la private key con `\n` escapados).
  - `GROQ_API_KEY` (para la auto-respuesta IA fuera de horario).
- En **Vercel** (proyecto del CRM): poner `BAILEYS_URL` = URL pública del servicio
  Railway (ej. `https://baileys-server-production.up.railway.app`). **Sin `/` final.**
- ffmpeg en Railway: ya está cubierto por `baileys-server/nixpacks.toml`
  (`nixPkgs = ["ffmpeg"]`). Confirmar que tras desplegar el log dice `✓ ffmpeg sistema:`.
- Tras desplegar, escanear el QR una vez desde el CRM (Configuración → WhatsApp).
  El auth queda en Firestore; los reinicios de Railway ya no piden QR.

**B2.3 — El subagente NO debe** intentar `railway up`, crear cuentas, ni tocar
secretos. Solo deja los archivos y la guía. El usuario ejecuta el despliegue.

**Verificar:** `ls baileys-server/Procfile baileys-server/DEPLOY_RAILWAY.md` existe;
`grep -q "node index.js" baileys-server/Procfile`.

---

## B3 — Defaults de `BAILEYS_URL` inconsistentes (puerto equivocado)

**Severidad: MEDIA.** Si `BAILEYS_URL` llega a faltar, la mitad de las rutas pegan al
puerto incorrecto y fallan en silencio.

**Hallazgo:** el puerto real del baileys-server es **3002** (`baileys-server/.env`:
`PORT=3002`, y `.env.local`: `BAILEYS_URL=http://localhost:3002`). Pero varias rutas
usan `http://localhost:3001` como fallback por defecto:
- `app/api/whatsapp/status/route.ts:5`
- `app/api/whatsapp/sessions/route.ts:5`
- `app/api/whatsapp/sessions/[sessionId]/route.ts:5`
- `app/api/debug/route.ts:6`

**Acción:** en esos 4 archivos, cambiar el fallback `'http://localhost:3001'` por
`'http://localhost:3002'`. Es un reemplazo literal de cadena, una ocurrencia por archivo.

**NO tocar** los archivos que ya usan `process.env.BAILEYS_URL?.trim()` sin fallback
(`whatsapp/send/route.ts`, `whatsapp/baileys/route.ts`) — esos ya validan que exista.

**Verificar:**
```bash
grep -rn "localhost:3001" app/api/whatsapp app/api/debug   # debe dar 0 resultados
```

---

## B4 — Sacar de git credenciales de sesión y node_modules (seguridad + peso)

**Severidad: MEDIA (seguridad).** `baileys-server/auth_info_baileys/` y
`auth_info_default/` (credenciales vivas de la sesión de WhatsApp) y
`baileys-server/node_modules/` están **rastreados en git**. Las credenciales de
WhatsApp NO deben estar en el repo. El `git status` actual muestra cientos de estos
archivos.

**Acción** (deja de rastrear; NO borra del disco):
```bash
cd /Users/branel/CRM-auto
git rm -r --cached baileys-server/node_modules baileys-server/auth_info_baileys baileys-server/auth_info_default 2>/dev/null
```
Confirmar que `.gitignore` (raíz) y/o `baileys-server/.gitignore` excluyen:
```
baileys-server/node_modules/
baileys-server/auth_info_*/
baileys-server/.env
```
Si no están, añadirlos.

**Verificar:**
```bash
git status --short | grep -c "auth_info_\|baileys-server/node_modules"   # 0 rastreados nuevos
ls baileys-server/auth_info_baileys/creds.json   # SIGUE existiendo en disco
```
**NO** usar `git rm` sin `--cached`. **NO** commitear todavía (dejar staged para revisión).

---

## B5 — Unificar el transcode de vídeo con el patrón de audio (anti-deadlock)

**Severidad: BAJA-MEDIA.** `/send-video` (líneas 860–899 de `index.js`) transcodifica
con **pipes** (`pipe:0`/`pipe:1`). Con vídeos grandes el pipe de stdout puede llenar el
buffer del SO y bloquear a ffmpeg (deadlock), mientras que `/send-audio` ya usa el
patrón fiable de **archivos temporales** (`transcodeToOpus`). 

**Acción:** refactorizar el transcode de vídeo para que use archivos temporales en
`tmpdir()` igual que `transcodeToOpus` (escribir input a fichero, correr ffmpeg
fichero→fichero, leer output, borrar ambos en `finally`). Mantener los mismos flags de
vídeo ya presentes (`-c:v libx264 -preset veryfast -crf 28 -c:a aac -b:a 128k`) pero
quitar los `-movflags frag_...` (necesarios solo para pipe/streaming; con fichero de
salida `.mp4` normal no hacen falta).

**Verificar:** enviar un vídeo `.webm` desde el CRM y confirmar que llega reproducible.
**Riesgo:** medio. Si el subagente no está seguro, dejar este bloque para el final y
solo anotar el cambio propuesto sin aplicarlo.

---

## B6 — Coherencia de URLs locales (`.env`)

**Severidad: BAJA (solo afecta a desarrollo local).**

**Hallazgo:** `baileys-server/.env` tiene `CRM_URL=http://localhost:3001` pero
`.env.local` tiene `NEXT_PUBLIC_APP_URL=http://localhost:3000`. Según la memoria del
proyecto, el CRM corre local en el **3001** (el 3000 lo ocupa otro proyecto). 

**Acción:** NO cambiar nada automáticamente. Solo **anotar** en este plan (o avisar al
usuario) que confirme en qué puerto arranca `next dev` localmente y que `CRM_URL` del
baileys-server apunte a ese mismo puerto. En producción ambos van a las URLs públicas
(Railway/Vercel), así que esto es solo para pruebas locales.

---

## B7 — Limpieza cosmética ya documentada

Existe `PLAN_LIMPIEZA.md` con tareas de bajo riesgo (unificar spinners, quitar
`openwa-server/` si existe). **No bloquea nada funcional.** Ejecutar solo DESPUÉS de
B1–B4 y siguiendo ese documento al pie de la letra (tiene sus propias verificaciones).

---

## B8 — Limpieza de código muerto (scripts huérfanos) 🧹

**Severidad: BAJA (higiene).** El usuario pidió eliminar lo que "solo ocupa líneas y
no hace nada". Auditado el repo. Resultado **clasificado** (no borrar a ciegas):

### SÍ eliminar — código muerto real (0 referencias, no son parte de la app)
Scripts de mantenimiento de un solo uso en `baileys-server/`, sin referencias en
ningún archivo ni en `package.json`, 183 líneas en total:
- `baileys-server/fix-clients.js`  (69 líneas)
- `baileys-server/get-org-id.js`   (58 líneas)
- `baileys-server/inspect-lids.js` (56 líneas)

```bash
cd /Users/branel/CRM-auto
git rm baileys-server/fix-clients.js baileys-server/get-org-id.js baileys-server/inspect-lids.js 2>/dev/null \
  || rm -f baileys-server/fix-clients.js baileys-server/get-org-id.js baileys-server/inspect-lids.js
```
(Quedan en el historial de git por si alguna vez se necesitan otra vez.)

### NO eliminar — parece "log/loop suelto" pero SÍ se usa (importante)
El usuario sospechaba que había logs inútiles tirados. Tras auditar: **no los hay como
basura**. Conservar:
- Los **8 `console.log`** del CRM (`app/api/.../route.ts`) son logs **operativos
  estructurados** con prefijo `[tag]` (billing, webhooks, email, cron, push). Sirven
  para depurar en producción. **NO borrarlos.**
- Los **~32 `console.log`** de `baileys-server/index.js` reportan estado de conexión,
  códigos de cierre y reconexiones. Son justo lo que se necesita para diagnosticar la
  desconexión (B2). **NO borrarlos.**
- Endpoints admin `cleanup-fake-clients`, `fix-phone-data` → **están cableados** a
  `app/dashboard/settings/page.tsx` (líneas 248/258). NO son código muerto.
- `fix-lid-clients`, `api/cleanup` → verificar si la UI los llama antes de tocarlos;
  si nadie los referencia, anotarlo pero **no borrar** sin confirmación del usuario
  (son endpoints, riesgo mayor que un script suelto).

### El watchdog (`setInterval` cada 3 min) y el `keepAliveIntervalMs` NO son "loops
inútiles": mantienen viva la sesión de WhatsApp. NO tocarlos.

**Verificar:**
```bash
ls baileys-server/fix-clients.js 2>/dev/null && echo "ERROR: sigue ahí" || echo "OK: scripts muertos eliminados"
grep -rn "console.log" app/api | grep -v node_modules | wc -l   # debe seguir habiendo 8 (logs útiles intactos)
```

---

## VERIFICACIÓN FINAL (obligatoria antes de cerrar)

```bash
cd /Users/branel/CRM-auto
npx tsc --noEmit            # debe seguir en 0 errores
npm run lint                # sin errores nuevos
node --check baileys-server/index.js   # sintaxis del servidor OK
grep -rn "localhost:3001" app/api/whatsapp app/api/debug   # 0 (B3 hecho)
grep -q "libopus" baileys-server/index.js && echo "B1 OK: opus presente"
ls baileys-server/Procfile && echo "B2 OK: Procfile creado"
git status --short | grep -c "auth_info_"   # 0 rastreados (B4 hecho)
```

## REGLAS PARA LOS SUBAGENTES (leer antes de empezar)
- Trabajar un bloque a la vez, en orden. Marcar la casilla al terminar.
- NO commitear ni hacer push (dejar todo staged/working para que el usuario revise).
- NO tocar secretos, `.env`, ni hacer despliegues reales (B2 solo crea archivos+guía).
- NO refactorizar lógica de negocio, Firestore ni endpoints fuera del bloque asignado.
- Si una verificación falla, NO seguir al siguiente bloque: reportar el fallo.
- Ante la duda en B5 (riesgo medio), anotar el cambio sin aplicarlo.

### Casillas
- [ ] B1 — fix opus en `transcodeToOpus`
- [ ] B2 — Procfile + DEPLOY_RAILWAY.md (despliegue lo hace el usuario)
- [ ] B3 — fallback de puerto 3001→3002 en 4 rutas
- [ ] B4 — `git rm --cached` de auth_info_* y node_modules
- [ ] B5 — (opcional/riesgo medio) transcode de vídeo por ficheros temporales
- [ ] B6 — anotar coherencia de puertos locales (sin cambiar)
- [ ] B7 — limpieza cosmética según `PLAN_LIMPIEZA.md`
- [ ] B8 — eliminar 3 scripts huérfanos de `baileys-server/` (conservar logs útiles)
