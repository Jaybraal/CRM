import 'dotenv/config'
import { spawn, execFileSync } from 'child_process'
import { createRequire } from 'module'
import { tmpdir } from 'os'
import { join } from 'path'
import { writeFileSync, readFileSync, unlinkSync } from 'fs'
import { randomUUID } from 'crypto'
import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  initAuthCreds,
  BufferJSON,
  downloadContentFromMessage,
} from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import qrcode from 'qrcode-terminal'
import QRCode from 'qrcode'
import express from 'express'
import pino from 'pino'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

// ── ffmpeg: sistema primero, ffmpeg-static como fallback ─────
const require_ = createRequire(import.meta.url)
let FFMPEG = null

// 1. Probar ffmpeg del sistema (instalado via nixpacks.toml)
try {
  const ver = execFileSync('ffmpeg', ['-version'], { timeout: 5000 }).toString().split('\n')[0]
  FFMPEG = 'ffmpeg'
  console.log(`✓ ffmpeg sistema: ${ver}`)
} catch {
  // 2. Fallback: ffmpeg-static (binario npm)
  try {
    const staticPath = require_('ffmpeg-static')
    if (staticPath) {
      execFileSync(staticPath, ['-version'], { timeout: 5000 })
      FFMPEG = staticPath
      console.log(`✓ ffmpeg-static: ${FFMPEG}`)
    }
  } catch (e) {
    FFMPEG = null
    console.warn(`✗ ffmpeg no disponible: ${e.message}. Audio se enviará como adjunto.`)
  }
}

// Transcodifica audio a ogg/opus usando archivos temporales (más fiable que pipe).
// Usa los mismos parámetros que WhatsApp internamente: 16kHz mono 32kbps.
async function transcodeToOpus(inputBuffer) {
  if (!FFMPEG) return null
  const id = randomUUID()
  const inFile  = join(tmpdir(), `wa_in_${id}`)
  const outFile = join(tmpdir(), `wa_out_${id}.ogg`)
  try {
    writeFileSync(inFile, inputBuffer)
    await new Promise((resolve, reject) => {
      // Parámetros exactos recomendados por Baileys para compatibilidad total con WhatsApp
      const proc = spawn(FFMPEG, [
        '-y', '-i', inFile,
        '-avoid_negative_ts', 'make_zero',
        '-ac', '1',
        outFile,
      ], { stdio: ['ignore', 'pipe', 'pipe'] })
      let stderr = ''
      proc.stderr.on('data', c => { stderr += c.toString() })
      proc.on('error', reject)
      proc.on('close', code => {
        if (code === 0) resolve()
        else reject(new Error(`ffmpeg exit ${code}: ${stderr.slice(-400)}`))
      })
    })
    const result = readFileSync(outFile)
    if (result.length === 0) throw new Error('ffmpeg produjo archivo vacío')
    return result
  } catch (e) {
    console.warn('transcodeToOpus falló:', e.message)
    return null
  } finally {
    try { unlinkSync(inFile) } catch {}
    try { unlinkSync(outFile) } catch {}
  }
}

// Códigos que borran auth y requieren QR nuevo
const AUTH_CLEAR_CODES = new Set([401, 500])
// Códigos que paran reconexión (440 = otra instancia tomó la sesión)
const STOP_RECONNECT_CODES = new Set([401, 440, 500])

const CRM_URL = process.env.CRM_URL || 'http://localhost:3000'
const PORT    = process.env.PORT    || 3001

const logger = pino({ level: 'silent' })

// Evitar que errores no capturados maten el proceso
process.on('uncaughtException', err => console.error('uncaughtException:', err.message))
process.on('unhandledRejection', err => console.error('unhandledRejection:', err?.message || err))

// ── Firebase Admin ─────────────────────────────────────────────
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId:   process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey:  process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  })
}
const db = getFirestore()

// ── Firestore auth state ───────────────────────────────────────
// Guarda creds + keys en Firestore para sobrevivir reinicios
async function useFirestoreAuthState(sessionId) {
  const docRef = db.collection('whatsapp_sessions').doc(sessionId)

  async function readData(key) {
    try {
      const snap = await docRef.collection('auth').doc(key).get()
      if (!snap.exists) return null
      return JSON.parse(snap.data().value, BufferJSON.reviver)
    } catch {
      return null
    }
  }

  async function writeData(key, value) {
    await docRef.collection('auth').doc(key).set({
      value: JSON.stringify(value, BufferJSON.replacer),
      updatedAt: FieldValue.serverTimestamp(),
    })
  }

  async function removeData(key) {
    await docRef.collection('auth').doc(key).delete().catch(() => {})
  }

  const creds = (await readData('creds')) || initAuthCreds()

  const state = {
    creds,
    keys: {
      get: async (type, ids) => {
        const data = {}
        await Promise.all(
          ids.map(async (id) => {
            const val = await readData(`${type}-${id}`)
            if (val) data[id] = val
          })
        )
        return data
      },
      set: async (data) => {
        await Promise.all(
          Object.entries(data).flatMap(([type, ids]) =>
            Object.entries(ids).map(([id, value]) =>
              value ? writeData(`${type}-${id}`, value) : removeData(`${type}-${id}`)
            )
          )
        )
      },
    },
  }

  const saveCreds = () => writeData('creds', state.creds)

  const clearAuth = async () => {
    try {
      const authSnap = await docRef.collection('auth').get()
      const batch = db.batch()
      authSnap.docs.forEach(d => batch.delete(d.ref))
      await batch.commit()
    } catch (e) {
      console.error('Error borrando auth:', e.message)
    }
  }

  return { state, saveCreds, clearAuth }
}

// ── Session management ─────────────────────────────────────────
const sessions = new Map()

async function startSession(sessionId, orgId) {
  if (sessions.has(sessionId)) {
    const existing = sessions.get(sessionId)
    // Siempre actualizar orgId si se proporciona y no estaba seteado
    if (orgId && !existing.orgId) {
      existing.orgId = orgId
      db.collection('whatsapp_sessions').doc(sessionId).set({ orgId }, { merge: true }).catch(() => {})
      console.log(`[${sessionId}] orgId seteado en sesión existente: ${orgId}`)
    }
    if (existing.status === 'open') return existing
    // No reiniciar si ya hay un QR esperando ser escaneado
    if (existing.status === 'qr' || existing.status === 'connecting') return existing
    if (!orgId) orgId = existing.orgId
  }

  // persist orgId in Firestore so we can restore it on restart
  if (orgId) {
    await db.collection('whatsapp_sessions').doc(sessionId).set(
      { orgId },
      { merge: true }
    )
  } else {
    const snap = await db.collection('whatsapp_sessions').doc(sessionId).get()
    orgId = snap.data()?.orgId || ''
  }

  const { state, saveCreds, clearAuth } = await useFirestoreAuthState(sessionId)
  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    version,
    auth: state,
    logger,
    printQRInTerminal: false,
    browser: ['CRM Auto', 'Chrome', '120.0'],
    keepAliveIntervalMs: 25000,
    retryRequestDelayMs: 2000,
    connectTimeoutMs: 120000, // 2 min para conectar
    qrTimeout: 90000, // 90s antes de regenerar QR (default es ~20s)
    defaultQueryTimeoutMs: 60000,
    markOnlineOnConnect: false,
    syncFullHistory: false,
    emitOwnEvents: false,
  })

  // Preservar conteo de reconexiones si ya existía la sesión
  const prevReconnects = sessions.get(sessionId)?.reconnectCount || 0
  const session = { sock, qr: null, status: 'connecting', orgId, clearAuth, reconnectCount: prevReconnects }
  sessions.set(sessionId, session)

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    const s = sessions.get(sessionId)
    if (!s) return

    if (qr) {
      s.qr = await QRCode.toDataURL(qr)
      s.status = 'qr'
      if (sessionId === 'default') {
        console.clear()
        console.log('══════════════════════════════════════════════')
        console.log('  Escanea QR para sesion:', sessionId)
        console.log('══════════════════════════════════════════════\n')
        qrcode.generate(qr, { small: true })
      }
    }

    if (connection === 'open') {
      s.status = 'open'
      s.qr = null
      s.reconnectCount = 0
      console.log(`Sesion [${sessionId}] conectada (org: ${s.orgId || 'sin org'})`)
      await db.collection('whatsapp_sessions').doc(sessionId).set(
        { status: 'connected', connectedAt: FieldValue.serverTimestamp() },
        { merge: true }
      )
      if (s.orgId) {
        fetch(`${CRM_URL}/api/whatsapp/sessions/status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orgId: s.orgId, sessionId, status: 'connected' }),
        }).catch(() => {})
      }
    }

    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode
      const shouldClearAuth = AUTH_CLEAR_CODES.has(code)
      const shouldStopReconnect = STOP_RECONNECT_CODES.has(code)
      console.log(`Sesion [${sessionId}] cerrada (codigo ${code}, clearAuth: ${shouldClearAuth}, stopReconnect: ${shouldStopReconnect})`)

      if (shouldStopReconnect) {
        s.status = 'disconnected'
        s.qr = null
        s.sock = null

        if (shouldClearAuth) {
          // 401 (loggedOut) o 500 (badSession): auth inválido, borrar
          await s.clearAuth?.()
          console.log(`[${sessionId}] Auth borrado (código ${code}). Requiere QR nuevo.`)
        } else {
          // 440 (connectionReplaced): auth sigue válido, no borrar
          // Esto pasa durante deploys de Railway (rolling restart)
          console.log(`[${sessionId}] Otra instancia tomó la sesión. Auth preservado.`)
        }

        await db.collection('whatsapp_sessions').doc(sessionId).set(
          { status: shouldClearAuth ? 'disconnected' : 'replaced' },
          { merge: true }
        )
        sessions.delete(sessionId)
      } else {
        // Reconexión infinita con backoff exponencial: 5s→10s→20s→40s→60s (máx)
        // No hay límite de intentos para errores de red — la sesión siempre se recupera
        s.reconnectCount = (s.reconnectCount || 0) + 1
        const delay = Math.min(5000 * Math.pow(2, s.reconnectCount - 1), 60000)
        console.log(`[${sessionId}] reconectando en ${delay / 1000}s (intento ${s.reconnectCount})...`)
        s.status = 'connecting'
        setTimeout(() => startSession(sessionId), delay)
      }
    }
  })

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return

    for (const msg of messages) {
      if (msg.key.fromMe) continue
      const jid = msg.key.remoteJid || ''
      if (jid.endsWith('@g.us')) continue
      if (jid.endsWith('@newsletter')) continue
      if (jid.endsWith('@broadcast')) continue
      if (jid === 'status@broadcast') continue
      if (!jid.endsWith('@s.whatsapp.net') && !jid.endsWith('@lid')) continue

      const isLid = jid.endsWith('@lid')
      const from  = jid.replace('@s.whatsapp.net', '').replace('@lid', '')
      const fromName = msg.pushName || from
      const msgId   = msg.key.id || ''

      let text = ''
      let msgType = 'text'
      let locationData = null
      let mediaBase64 = null
      let mediaMime = null

      // Normalizar: desempaquetar wrappers de WhatsApp
      let m = msg.message || {}
      if (m.ephemeralMessage?.message) m = m.ephemeralMessage.message
      if (m.viewOnceMessage?.message) m = m.viewOnceMessage.message
      if (m.viewOnceMessageV2?.message?.message) m = m.viewOnceMessageV2.message.message

      if (m.conversation) {
        text = m.conversation
      } else if (m.extendedTextMessage?.text) {
        text = m.extendedTextMessage.text
      } else if (m.imageMessage) {
        text = m.imageMessage.caption || ''
        msgType = 'image'
        try {
          const stream = await downloadContentFromMessage(m.imageMessage, 'image')
          const chunks = []
          for await (const chunk of stream) chunks.push(chunk)
          const buf = Buffer.concat(chunks)
          mediaBase64 = buf.toString('base64')
          mediaMime = m.imageMessage.mimetype || 'image/jpeg'
        } catch (e) { console.warn('Error descargando imagen:', e.message) }
      } else if (m.videoMessage) {
        msgType = 'video'
        text = m.videoMessage.caption || ''
        try {
          const stream = await downloadContentFromMessage(m.videoMessage, 'video')
          const chunks = []
          for await (const chunk of stream) chunks.push(chunk)
          const buf = Buffer.concat(chunks)
          mediaBase64 = buf.toString('base64')
          mediaMime = m.videoMessage.mimetype || 'video/mp4'
        } catch (e) { console.warn('Error descargando video:', e.message) }
      } else if (m.audioMessage) {
        msgType = 'audio'
        text = ''
        try {
          const stream = await downloadContentFromMessage(m.audioMessage, 'audio')
          const chunks = []
          for await (const chunk of stream) chunks.push(chunk)
          const buf = Buffer.concat(chunks)
          mediaBase64 = buf.toString('base64')
          mediaMime = m.audioMessage.mimetype || 'audio/ogg'
        } catch (e) { console.warn('Error descargando audio:', e.message) }
      } else if (m.locationMessage) {
        msgType = 'location'
        locationData = {
          lat: m.locationMessage.degreesLatitude,
          lng: m.locationMessage.degreesLongitude,
          name: m.locationMessage.name || '',
        }
      } else if (m.documentMessage) {
        msgType = 'document'
        text = m.documentMessage.fileName || 'archivo'
        try {
          const stream = await downloadContentFromMessage(m.documentMessage, 'document')
          const chunks = []
          for await (const chunk of stream) chunks.push(chunk)
          const buf = Buffer.concat(chunks)
          mediaBase64 = buf.toString('base64')
          mediaMime = m.documentMessage.mimetype || 'application/octet-stream'
        } catch (e) { console.warn('Error descargando documento:', e.message) }
      } else if (m.stickerMessage) {
        text = '[Sticker]'
      } else if (m.reactionMessage) {
        continue // ignorar reacciones
      } else if (m.protocolMessage) {
        continue // ignorar mensajes de protocolo (ediciones, borrados)
      } else if (m.senderKeyDistributionMessage || m.messageContextInfo || m.callLogMessag) {
        continue // ignorar mensajes de sistema/señalización
      } else if (!text && msgType === 'text' && !mediaBase64 && !locationData) {
        // Mensaje sin contenido reconocido — ignorar para no crear burbuja vacía
        console.log(`[${sessionId}] Mensaje ignorado (sin contenido). Claves: ${Object.keys(m).join(',')}`)
        continue
      }

      console.log(`[${sessionId}] ${fromName} [${msgId}]: ${text || `[${msgType}]`}${mediaBase64 ? ' [+media]' : ''}`)
      const orgId = sessions.get(sessionId)?.orgId
      if (!orgId) continue

      // Enviar al CRM secuencialmente con reintentos
      const payload = JSON.stringify({ orgId, from, fromName, text, type: msgType, jid, isLid, location: locationData, sessionId, mediaBase64, mediaMime, msgId })
      let sent = false
      for (let attempt = 1; attempt <= 4; attempt++) {
        try {
          const res = await fetch(`${CRM_URL}/api/whatsapp/baileys`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payload,
            signal: AbortSignal.timeout(15000),
          })
          if (res.ok) { sent = true; break }
          console.warn(`CRM webhook intento ${attempt} fallido: ${res.status}`)
        } catch (e) {
          console.warn(`CRM webhook intento ${attempt} error: ${e.message}`)
        }
        if (attempt < 4) await new Promise(r => setTimeout(r, attempt * 1500))
      }
      if (!sent) console.error(`Mensaje de ${fromName} perdido después de 4 intentos`)

      // Auto-respuesta IA fuera de horario laboral
      if (text && msgType === 'text' && process.env.GROQ_API_KEY) {
        try {
          const orgDoc = await db.collection('organizations').doc(orgId).get()
          const orgData = orgDoc.data() || {}
          const settings = orgData.settings || {}

          if (settings.autoReply?.enabled && settings.businessHours) {
            const bh = settings.businessHours
            const now = new Date()
            const day = now.getDay()
            const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`
            const isOpen = bh.days.includes(day) && timeStr >= bh.openTime && timeStr < bh.closeTime

            if (!isOpen) {
              const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  model: 'llama3-8b-8192',
                  messages: [
                    {
                      role: 'system',
                      content: `Eres el asistente virtual de "${orgData.name || 'este negocio'}". Estamos fuera de horario (${bh.openTime}–${bh.closeTime}). Responde amablemente, informa el horario y recoge lo que necesita el cliente. Máximo 3 líneas. En español.`,
                    },
                    { role: 'user', content: text },
                  ],
                  max_tokens: 200,
                }),
                signal: AbortSignal.timeout(10000),
              })
              if (groqRes.ok) {
                const groqData = await groqRes.json()
                const reply = groqData.choices?.[0]?.message?.content
                if (reply) await sock.sendMessage(jid, { text: reply })
              }
            }
          }
        } catch (e) {
          console.warn('[auto-reply IA]', e.message)
        }
      }
    }
  })

  // Actualizaciones de estado de mensajes enviados (ticks)
  sock.ev.on('messages.update', async (updates) => {
    const orgId = sessions.get(sessionId)?.orgId
    if (!orgId) return
    for (const update of updates) {
      if (!update.key?.fromMe) continue // solo mensajes enviados por nosotros
      const msgId = update.key.id
      const statusCode = update.update?.status
      if (!msgId || statusCode == null) continue

      // Necesitamos el clientId — lo buscamos en Firestore por el JID
      const jid = update.key.remoteJid || ''
      const phone = jid.replace('@s.whatsapp.net', '').replace('@lid', '')
      if (!phone) continue

      fetch(`${CRM_URL}/api/whatsapp/message-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId, phone, whatsappMsgId: msgId, statusCode }),
      }).catch(() => {})
    }
  })

  sock.ev.on('call', async (calls) => {
    for (const call of calls) {
      if (call.status === 'offer') {
        const from = call.from.replace('@s.whatsapp.net', '')
        console.log(`Llamada de ${from} en sesion [${sessionId}]`)
        const orgId = sessions.get(sessionId)?.orgId
        if (orgId) {
          fetch(`${CRM_URL}/api/whatsapp/baileys`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orgId, from, fromName: from, text: '[Llamada entrante]', type: 'call', jid: call.from, callDuration: -1, sessionId }),
          }).catch(() => {})
          sock.rejectCall(call.id, call.from).catch(() => {})
        }
      }
    }
  })

  return session
}

// ── Restaurar sesiones activas al arrancar ─────────────────────
async function restoreActiveSessions() {
  try {
    // Restaurar sesiones que estaban 'connected' O 'replaced' (auth preservado tras 440)
    const [connSnap, replSnap] = await Promise.all([
      db.collection('whatsapp_sessions').where('status', '==', 'connected').get(),
      db.collection('whatsapp_sessions').where('status', '==', 'replaced').get(),
    ])
    const allDocs = [...connSnap.docs, ...replSnap.docs]
    if (allDocs.length === 0) {
      console.log('No hay sesiones previas, iniciando sesion default...')
      startSession('default')
      return
    }
    console.log(`Restaurando ${allDocs.length} sesion(es) (${connSnap.size} connected, ${replSnap.size} replaced)...`)
    for (const doc of allDocs) {
      startSession(doc.id).catch(e => console.error(`Error restaurando [${doc.id}]:`, e.message))
    }
  } catch (e) {
    console.error('Error leyendo sesiones de Firestore:', e.message)
    startSession('default')
  }
}

// ── Watchdog: revive sesiones con auth válido que quedaron disconnected ────────
// Corre cada 3 minutos. Si el servidor de WhatsApp estaba caído o hubo corte
// de internet prolongado, las sesiones se reconectan automáticamente sin QR.
async function startWatchdog() {
  setInterval(async () => {
    try {
      const snap = await db.collection('whatsapp_sessions')
        .where('status', '==', 'disconnected')
        .get()
      for (const doc of snap.docs) {
        const sessionId = doc.id
        // No reiniciar si ya hay una sesión activa en memoria
        const existing = sessions.get(sessionId)
        if (existing && (existing.status === 'open' || existing.status === 'connecting' || existing.status === 'qr')) continue
        // Verificar que tenga auth guardado (si no, necesita QR nuevo)
        const authSnap = await db.collection('whatsapp_sessions').doc(sessionId).collection('auth').limit(1).get()
        if (authSnap.empty) continue
        console.log(`[watchdog] Reviviendo sesión desconectada: ${sessionId}`)
        startSession(sessionId).catch(e => console.error(`[watchdog] Error reviviendo [${sessionId}]:`, e.message))
      }
    } catch (e) {
      console.error('[watchdog] Error:', e.message)
    }
  }, 3 * 60 * 1000) // cada 3 minutos
}

// ── REST API ───────────────────────────────────────────────────
const app = express()
app.use(express.json({ limit: '50mb' }))

app.get('/sessions', (_req, res) => {
  const list = []
  for (const [id, s] of sessions) {
    list.push({ sessionId: id, status: s.status, orgId: s.orgId || '', hasQr: !!s.qr })
  }
  res.json(list)
})

app.get('/debug', (_req, res) => {
  const sessionList = []
  for (const [id, s] of sessions) {
    sessionList.push({ sessionId: id, status: s.status, orgId: s.orgId || '' })
  }
  res.json({ crmUrl: CRM_URL, port: PORT, sessions: sessionList })
})

// Forzar orgId en una sesión activa (para recuperación)
app.post('/set-org/:sessionId', async (req, res) => {
  const { sessionId } = req.params
  const { orgId } = req.body
  if (!orgId) return res.status(400).json({ error: 'orgId requerido' })
  const s = sessions.get(sessionId)
  if (!s) return res.status(404).json({ error: 'Sesion no encontrada' })
  s.orgId = orgId
  await db.collection('whatsapp_sessions').doc(sessionId).set({ orgId }, { merge: true })
  res.json({ ok: true, sessionId, orgId })
})

app.get('/status/:sessionId?', (req, res) => {
  const sessionId = req.params.sessionId || 'default'
  const s = sessions.get(sessionId)
  res.json({ sessionId, status: s?.status || 'disconnected', connected: s?.status === 'open' })
})

app.get('/qr/:sessionId?', async (req, res) => {
  const sessionId = req.params.sessionId || 'default'
  const s = sessions.get(sessionId)
  if (!s) {
    startSession(sessionId).catch(console.error)
    return res.json({ qr: null, status: 'connecting' })
  }
  res.json({ qr: s.qr, status: s.status })
})

app.post('/connect/:sessionId?', async (req, res) => {
  const sessionId = req.params.sessionId || 'default'
  const orgId = req.body?.orgId || ''
  try {
    const s = sessions.get(sessionId)
    if (s?.status === 'open') {
      // Actualizar orgId en memoria y en Firestore aunque la sesión ya esté abierta
      if (orgId && s.orgId !== orgId) {
        s.orgId = orgId
        db.collection('whatsapp_sessions').doc(sessionId).set({ orgId }, { merge: true }).catch(() => {})
        console.log(`[${sessionId}] orgId actualizado: ${orgId}`)
      }
      return res.json({ status: 'open', message: 'Ya conectado' })
    }
    startSession(sessionId, orgId)
    res.json({ status: 'connecting', message: 'Iniciando sesion, solicita QR en /qr/' + sessionId })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.delete('/session/:sessionId?', async (req, res) => {
  const sessionId = req.params.sessionId || 'default'
  const s = sessions.get(sessionId)
  if (!s) return res.json({ ok: true, message: 'Sesion no existe' })
  try {
    if (s.sock) await s.sock.logout()
  } catch {}
  sessions.delete(sessionId)
  try {
    const authSnap = await db.collection('whatsapp_sessions').doc(sessionId).collection('auth').get()
    const batch = db.batch()
    authSnap.docs.forEach(d => batch.delete(d.ref))
    await batch.commit()
    await db.collection('whatsapp_sessions').doc(sessionId).set({ status: 'disconnected' }, { merge: true })
  } catch (e) {
    console.error('Error borrando auth de Firestore:', e.message)
  }
  res.json({ ok: true })
})

// ── Wrapper seguro para envíos ─────────────────────────────────
// Verifica sesión, intenta enviar, y si el socket se murió lo marca
function getSession(sid) {
  const sessionId = sid || 'default'
  const s = sessions.get(sessionId)
  if (!s || !s.sock || s.status !== 'open') return { sessionId, s: null }
  return { sessionId, s }
}

async function safeSend(sessionId, s, jid, content) {
  try {
    const result = await s.sock.sendMessage(jid, content)
    return { ok: true, msgId: result?.key?.id || null }
  } catch (e) {
    console.error(`[${sessionId}] sendMessage error:`, e.message)
    // Solo marcar sesión muerta si es un error de CONEXIÓN, no de protocolo
    // Errores de protocolo (audio malformado, etc.) NO deben matar la sesión
    const msg = e.message || ''
    const isConnectionDead =
      msg.includes('Connection Closed') ||
      msg.includes('not open') ||
      msg.includes('WebSocket') ||
      msg.includes('connect ECONNREFUSED') ||
      (!s.sock?.user && msg !== '')
    if (isConnectionDead) {
      console.error(`[${sessionId}] Conexión muerta detectada. Reconectando...`)
      s.status = 'connecting'
      s.reconnectCount = (s.reconnectCount || 0) + 1
      setTimeout(() => startSession(sessionId), 3000)
    }
    throw e
  }
}

function toJid(to) {
  return to.includes('@') ? to : `${to}@s.whatsapp.net`
}

async function downloadUrl(url, label) {
  const res = await fetch(url, { signal: AbortSignal.timeout(30000) })
  if (!res.ok) throw new Error(`No se pudo descargar ${label}: HTTP ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length === 0) throw new Error(`${label} descargado está vacío`)
  return { buffer: buf, contentType: res.headers.get('content-type') || '' }
}

// ── Endpoints de envío ────────────────────────────────────────

app.post('/send', async (req, res) => {
  const { to, text, sessionId: sid } = req.body
  const { sessionId, s } = getSession(sid)
  if (!s) return res.status(503).json({ error: 'Sesion no conectada: ' + sessionId })
  if (!to || !text) return res.status(400).json({ error: 'Faltan parametros' })
  try {
    const result = await safeSend(sessionId, s, toJid(to), { text })
    res.json(result)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post('/send-image', async (req, res) => {
  const { to, url, caption, sessionId: sid } = req.body
  const { sessionId, s } = getSession(sid)
  if (!s) return res.status(503).json({ error: 'Sesion no conectada: ' + sessionId })
  if (!to || !url) return res.status(400).json({ error: 'Faltan parametros' })
  try {
    const { buffer, contentType } = await downloadUrl(url, 'imagen')
    console.log(`[${sessionId}] send-image: ${buffer.length} bytes`)
    const result = await safeSend(sessionId, s, toJid(to), {
      image: buffer,
      mimetype: contentType.startsWith('image/') ? contentType : 'image/jpeg',
      caption: caption || '',
    })
    res.json(result)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post('/send-video', async (req, res) => {
  const { to, url, caption, sessionId: sid } = req.body
  const { sessionId, s } = getSession(sid)
  if (!s) return res.status(503).json({ error: 'Sesion no conectada: ' + sessionId })
  if (!to || !url) return res.status(400).json({ error: 'Faltan parametros' })
  try {
    const { buffer: rawBuffer, contentType } = await downloadUrl(url, 'video')
    console.log(`[${sessionId}] send-video: ${rawBuffer.length} bytes, ${contentType}`)

    // Intentar transcodificar webm → mp4 (ffmpeg); si no, enviar raw
    let vidBuffer = rawBuffer
    let mime = contentType || 'video/mp4'
    if (FFMPEG && (contentType.includes('webm') || contentType.includes('quicktime'))) {
      try {
        vidBuffer = await new Promise((resolve, reject) => {
          const proc = spawn(FFMPEG, [
            '-i', 'pipe:0', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '28',
            '-c:a', 'aac', '-b:a', '128k',
            '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
            '-f', 'mp4', 'pipe:1',
          ], { stdio: ['pipe', 'pipe', 'pipe'] })
          const chunks = []
          proc.stdout.on('data', c => chunks.push(c))
          proc.on('close', code => code === 0 ? resolve(Buffer.concat(chunks)) : reject(new Error('ffmpeg error')))
          proc.stdin.on('error', () => {})
          proc.stdin.end(rawBuffer)
        })
        mime = 'video/mp4'
        console.log(`[${sessionId}] video transcodificado → ${vidBuffer.length} bytes`)
      } catch { vidBuffer = rawBuffer }
    }

    const result = await safeSend(sessionId, s, toJid(to), {
      video: vidBuffer, mimetype: mime, caption: caption || '',
    })
    res.json(result)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Detecta si un buffer es realmente ogg/opus por sus magic bytes
function isOggOpus(buf) {
  // OGG: empieza con "OggS" (4f 67 67 53)
  return buf.length > 4 && buf[0] === 0x4f && buf[1] === 0x67 && buf[2] === 0x67 && buf[3] === 0x53
}

app.post('/send-audio', async (req, res) => {
  const { to, url, ptt, sessionId: sid } = req.body
  const { sessionId, s } = getSession(sid)
  if (!s) return res.status(503).json({ error: 'Sesion no conectada: ' + sessionId })
  if (!to || !url) return res.status(400).json({ error: 'Faltan parametros' })
  try {
    const jid = toJid(to)
    const { buffer: rawBuffer, contentType } = await downloadUrl(url, 'audio')

    if (rawBuffer.length === 0) {
      return res.status(400).json({ error: 'El archivo de audio está vacío' })
    }

    console.log(`[${sessionId}] send-audio: ${rawBuffer.length} bytes, contentType=${contentType}, isOgg=${isOggOpus(rawBuffer)}`)

    // Si ya es ogg/opus (Firefox, o conversión previa), enviar directo como PTT
    if (isOggOpus(rawBuffer)) {
      console.log(`[${sessionId}] audio ya en ogg/opus, enviando como PTT`)
      const result = await safeSend(sessionId, s, jid, {
        audio: rawBuffer,
        mimetype: 'audio/ogg; codecs=opus',
        ptt: ptt !== false,
      })
      return res.json(result)
    }

    // Si ffmpeg disponible: transcodificar webm/mp4 → ogg/opus
    const oggBuffer = await transcodeToOpus(rawBuffer)
    if (oggBuffer && oggBuffer.length > 0) {
      console.log(`[${sessionId}] audio transcodificado: ${rawBuffer.length}→${oggBuffer.length} bytes`)
      const result = await safeSend(sessionId, s, jid, {
        audio: oggBuffer,
        mimetype: 'audio/ogg; codecs=opus',
        ptt: ptt !== false,
      })
      return res.json(result)
    }

    // Sin ffmpeg: enviar como audio adjunto normal (NO PTT) — se reproduce pero no es nota de voz
    const mime = contentType?.split(';')[0] || 'audio/webm'
    console.log(`[${sessionId}] ffmpeg no disponible, enviando como audio adjunto (${mime})`)
    const result = await safeSend(sessionId, s, jid, {
      audio: rawBuffer,
      mimetype: mime,
      ptt: false,
    })
    res.json(result)
  } catch (e) {
    console.error(`[${sessionId}] /send-audio error:`, e.message)
    res.status(500).json({ error: e.message })
  }
})

app.post('/send-document', async (req, res) => {
  const { to, url, fileName, mimetype, sessionId: sid } = req.body
  const { sessionId, s } = getSession(sid)
  if (!s) return res.status(503).json({ error: 'Sesion no conectada: ' + sessionId })
  if (!to || !url) return res.status(400).json({ error: 'Faltan parametros' })
  try {
    const { buffer, contentType } = await downloadUrl(url, 'documento')
    const result = await safeSend(sessionId, s, toJid(to), {
      document: buffer,
      fileName: fileName || 'archivo',
      mimetype: mimetype || contentType || 'application/octet-stream',
    })
    res.json(result)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post('/send-location', async (req, res) => {
  const { to, lat, lng, name, sessionId: sid } = req.body
  const { sessionId, s } = getSession(sid)
  if (!s) return res.status(503).json({ error: 'Sesion no conectada: ' + sessionId })
  if (!to || lat == null || lng == null) return res.status(400).json({ error: 'Faltan parametros' })
  try {
    const result = await safeSend(sessionId, s, toJid(to), {
      location: { degreesLatitude: parseFloat(lat), degreesLongitude: parseFloat(lng), name: name || '' },
    })
    res.json(result)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post('/call', async (_req, res) => {
  res.status(501).json({ error: 'Llamadas salientes no soportadas por Baileys.' })
})

// Forzar reset completo de una sesión: borra auth, desconecta, genera QR fresco
app.post('/reset/:sessionId?', async (req, res) => {
  const sessionId = req.params.sessionId || 'default'
  const { orgId } = req.body || {}
  const s = sessions.get(sessionId)
  try {
    if (s?.sock) { try { s.sock.end(undefined) } catch {} }
    sessions.delete(sessionId)
  } catch {}
  // Borrar auth de Firestore
  try {
    const docRef = db.collection('whatsapp_sessions').doc(sessionId)
    const authSnap = await docRef.collection('auth').get()
    const batch = db.batch()
    authSnap.docs.forEach(d => batch.delete(d.ref))
    await batch.commit()
    await docRef.set({ status: 'disconnected' }, { merge: true })
  } catch (e) {
    console.error('Error borrando auth en reset:', e.message)
  }
  // Iniciar sesión fresca (generará QR nuevo)
  startSession(sessionId, orgId).catch(console.error)
  res.json({ ok: true, message: 'Sesión reseteada, nuevo QR generándose' })
})

app.listen(PORT, () => {
  console.log(`Baileys server en http://localhost:${PORT}`)
  console.log(`CRM: ${CRM_URL}`)
  console.log('Modo multi-tenant: orgId por sesion')
})

restoreActiveSessions()
startWatchdog()
