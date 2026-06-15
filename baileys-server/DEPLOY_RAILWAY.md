# Despliegue de baileys-server en Railway

Este documento describe los pasos que **TÚ** (el usuario) deberás ejecutar manualmente para desplegar el servidor de WhatsApp en Railway.

## Paso 1: Crear el servicio en Railway

1. Ve a [railway.app](https://railway.app) e inicia sesión.
2. Crea un nuevo servicio (botón "New") y selecciona **GitHub**.
3. Conecta tu repositorio `/Users/branel/CRM-auto`.
4. **Importante:** En la configuración del servicio, establece **Root Directory** = `baileys-server/`.
5. Railway detectará automáticamente que es un proyecto Node.js y usará `Procfile` para arrancar.

## Paso 2: Configurar variables de entorno en Railway

En el panel del servicio baileys-server en Railway, añade estas variables de entorno:

| Variable | Valor | Notas |
|----------|-------|-------|
| `CRM_URL` | URL pública del CRM en Vercel (ej. `https://crm-auto.vercel.app`) | **Sin `/` final** |
| `PORT` | Lo inyecta Railway automáticamente | El código ya hace `process.env.PORT \|\| 3002` |
| `FIREBASE_ADMIN_PROJECT_ID` | Mismo valor que en Vercel CRM | ID del proyecto Firebase |
| `FIREBASE_ADMIN_CLIENT_EMAIL` | Mismo valor que en Vercel CRM | Email de la cuenta de servicio |
| `FIREBASE_ADMIN_PRIVATE_KEY` | Mismo valor que en Vercel CRM | **Importante:** escapar los saltos de línea como `\n` literales |
| `GROQ_API_KEY` | Tu clave de Groq | Para auto-respuesta IA fuera de horario |

**Cómo copiar `FIREBASE_ADMIN_PRIVATE_KEY` correctamente:**
- En tu archivo `.env.local` local (o en el servicio CRM de Vercel), copia el valor tal cual.
- En Railway, pégalo **tal cual** — Railway interpreta automáticamente los `\n` como saltos de línea.
- Si la clave tiene comillas, déjalas (ej. `"-----BEGIN PRIVATE KEY-----\n..."`).

## Paso 3: Verificar ffmpeg en Railway

El archivo `baileys-server/nixpacks.toml` ya incluye:
```toml
nixPkgs = ["ffmpeg"]
```

Esto hace que ffmpeg se instale automáticamente en Railway. Tras el despliegue, revisa los logs:
```
✓ ffmpeg sistema:
```

Si ves este mensaje, ffmpeg está listo para transcodificar notas de voz.

## Paso 4: Obtener la URL pública de Railway

Una vez deployado, Railway te mostrará una URL pública (algo como `https://baileys-server-production.up.railway.app`).

Copia esa URL **sin `/` final**.

## Paso 5: Actualizar `BAILEYS_URL` en Vercel (CRM)

1. Ve a tu proyecto CRM en [vercel.com](https://vercel.com).
2. En Settings → Environment Variables, añade o actualiza:
   - **Nombre:** `BAILEYS_URL`
   - **Valor:** la URL de Railway del paso 4 (ej. `https://baileys-server-production.up.railway.app`)
   - **Sin `/` final**

3. Vuelve a deployar el CRM en Vercel (puede ser automático desde GitHub o manual).

## Paso 6: Escanear el QR de WhatsApp (primera vez)

1. Abre tu CRM en Vercel (URL pública del proyecto).
2. Ve a **Configuración → WhatsApp**.
3. Deberías ver un QR en pantalla.
4. Abre WhatsApp en tu celular, ve a **Configuración → Dispositivos vinculados** y escanea el QR.

**Nota:** El auth de WhatsApp se guarda en Firestore (`whatsapp_sessions/<orgId>/auth`). Los próximos reinicios de Railway **no volverán a pedir QR** — usarán el auth guardado.

## Paso 7: Verificar la conexión

- Desde el CRM, envía un mensaje de prueba a través de WhatsApp.
- Revisa los logs de Railway para confirmar que el servidor recibe y procesa mensajes.
- Si todo va bien, deberías ver el mensaje en WhatsApp Web.

---

## Solución de problemas

### "BAILEYS_URL no responde"
- Verifica que la URL en Vercel esté correcta (sin `/` final).
- Comprueba que el servicio de Railway esté en estado "Active" (no "Idle").
- Si Railway hace sleep, haz clic en tu servicio para despertarlo.

### "Ffmpeg no disponible"
- Revisa los logs de Railway. Deberían mencionar `nixPkgs`.
- Si falta, añade `nixpacks.toml` manualmente (ya está en `baileys-server/`).

### "QR no aparece o no se puede escanear"
- Verifica que `CRM_URL` en Railway sea la URL pública correcta del CRM en Vercel.
- Confirma que el CRM pueda alcanzar el servicio de Railway (sin cortafuegos/bloqueos).

### "Conexión perdida aleatoriamente"
- Railway puede hibernar servicios inactivos. Si usas el plan gratuito, considera el plan pagado.
- Los logs de Railway mostrarán reconexiones si la sesión muere; esto es normal.

---

## Coherencia de puertos en desarrollo local (IMPORTANTE)

En tu máquina local:
- **`baileys-server/.env`:** `CRM_URL=http://localhost:3001`
- **`.env.local`** (CRM): `NEXT_PUBLIC_APP_URL=http://localhost:3000`

Según tus notas, el CRM corre en el puerto **3001** localmente (no 3000). 

**VERIFICAR:** antes de correr el servidor local:
1. ¿En qué puerto arranca `npm run dev` (Next.js) del CRM? Observa la consola: debería decir algo como `localhost:3001`.
2. Asegúrate de que `baileys-server/.env` tenga `CRM_URL=http://localhost:3001` (o el puerto real que uses).
3. El `baileys-server` escucha en `localhost:3002` de forma local (`PORT=3002` en `.env`).

Si los puertos no coinciden, el CRM no podrá conectar con el servidor de WhatsApp localmente, y verás errores como "BAILEYS_URL no responde".

**En producción:** ambas URLs vienen de Vercel/Railway, así que esto no es un problema.
