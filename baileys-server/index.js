import 'dotenv/config'
import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  initAuthCreds,
  BufferJSON,
} from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import qrcode from 'qrcode-terminal'
import QRCode from 'qrcode'
import express from 'express'
import pino from 'pino'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

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

  return { state, saveCreds }
}

// ── Session management ─────────────────────────────────────────
const sessions = new Map()

async function startSession(sessionId, orgId) {
  if (sessions.has(sessionId)) {
    const existing = sessions.get(sessionId)
    if (existing.status === 'open') return existing
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

  const { state, saveCreds } = await useFirestoreAuthState(sessionId)
  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    version,
    auth: state,
    logger,
    printQRInTerminal: false,
    browser: ['CRM Auto', 'Chrome', '120.0'],
    keepAliveIntervalMs: 15000,
    retryRequestDelayMs: 2000,
    connectTimeoutMs: 60000,
  })

  const session = { sock, qr: null, status: 'connecting', orgId }
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
      const reconnect = code !== DisconnectReason.loggedOut
      console.log(`Sesion [${sessionId}] cerrada (codigo ${code})`)
      if (reconnect) {
        s.status = 'connecting'
        setTimeout(() => startSession(sessionId), 3000)
      } else {
        s.status = 'disconnected'
        s.sock = null
        await db.collection('whatsapp_sessions').doc(sessionId).set(
          { status: 'disconnected' },
          { merge: true }
        )
        console.log(`Sesion [${sessionId}] cerrada permanentemente.`)
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

      let text = ''
      let msgType = 'text'
      let locationData = null

      const m = msg.message || {}
      if (m.conversation) {
        text = m.conversation
      } else if (m.extendedTextMessage?.text) {
        text = m.extendedTextMessage.text
      } else if (m.ephemeralMessage?.message?.extendedTextMessage?.text) {
        text = m.ephemeralMessage.message.extendedTextMessage.text
      } else if (m.imageMessage) {
        text = m.imageMessage.caption || ''
        msgType = 'image'
      } else if (m.videoMessage) {
        msgType = 'video'
        text = m.videoMessage.caption || '[Video]'
      } else if (m.audioMessage) {
        msgType = 'audio'
        text = '[Audio]'
      } else if (m.locationMessage) {
        msgType = 'location'
        locationData = {
          lat: m.locationMessage.degreesLatitude,
          lng: m.locationMessage.degreesLongitude,
          name: m.locationMessage.name || '',
        }
      } else if (m.documentMessage) {
        text = `[Documento: ${m.documentMessage.fileName || ''}]`
      } else if (m.stickerMessage) {
        text = '[Sticker]'
      } else if (m.reactionMessage) {
        continue // ignorar reacciones
      } else if (m.protocolMessage) {
        continue // ignorar mensajes de protocolo (ediciones, borrados)
      }

      console.log(`[${sessionId}] ${fromName}: ${text || `[${msgType}]`}`)
      const orgId = sessions.get(sessionId)?.orgId
      if (!orgId) continue

      // Enviar al CRM secuencialmente con reintentos
      const payload = JSON.stringify({ orgId, from, fromName, text, type: msgType, jid, isLid, location: locationData, sessionId })
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
    const snap = await db.collection('whatsapp_sessions').where('status', '==', 'connected').get()
    if (snap.empty) {
      console.log('No hay sesiones previas, iniciando sesion default...')
      startSession('default')
      return
    }
    console.log(`Restaurando ${snap.size} sesion(es)...`)
    for (const doc of snap.docs) {
      startSession(doc.id).catch(e => console.error(`Error restaurando [${doc.id}]:`, e.message))
    }
  } catch (e) {
    console.error('Error leyendo sesiones de Firestore:', e.message)
    startSession('default')
  }
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

app.post('/send', async (req, res) => {
  const { to, text, sessionId: sid, orgId, clientId } = req.body
  const sessionId = sid || 'default'
  const s = sessions.get(sessionId)
  if (!s?.sock || s.status !== 'open') return res.status(503).json({ error: 'Sesion no conectada: ' + sessionId })
  if (!to || !text) return res.status(400).json({ error: 'Faltan parametros' })
  try {
    const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`
    const result = await s.sock.sendMessage(jid, { text })
    const msgId = result?.key?.id || null
    res.json({ ok: true, msgId })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post('/send-image', async (req, res) => {
  const { to, url, caption, sessionId: sid } = req.body
  const sessionId = sid || 'default'
  const s = sessions.get(sessionId)
  if (!s?.sock || s.status !== 'open') return res.status(503).json({ error: 'Sesion no conectada: ' + sessionId })
  if (!to || !url) return res.status(400).json({ error: 'Faltan parametros' })
  try {
    const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`
    const result = await s.sock.sendMessage(jid, { image: { url }, caption: caption || '' })
    const msgId = result?.key?.id || null
    res.json({ ok: true, msgId })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post('/send-location', async (req, res) => {
  const { to, lat, lng, name, sessionId: sid } = req.body
  const sessionId = sid || 'default'
  const s = sessions.get(sessionId)
  if (!s?.sock || s.status !== 'open') return res.status(503).json({ error: 'Sesion no conectada: ' + sessionId })
  if (!to || lat == null || lng == null) return res.status(400).json({ error: 'Faltan parametros' })
  try {
    const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`
    const result = await s.sock.sendMessage(jid, {
      location: { degreesLatitude: parseFloat(lat), degreesLongitude: parseFloat(lng), name: name || '' },
    })
    const msgId = result?.key?.id || null
    res.json({ ok: true, msgId })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post('/call', async (_req, res) => {
  res.status(501).json({ error: 'Llamadas salientes no soportadas por Baileys.' })
})

app.listen(PORT, () => {
  console.log(`Baileys server en http://localhost:${PORT}`)
  console.log(`CRM: ${CRM_URL}`)
  console.log('Modo multi-tenant: orgId por sesion')
})

restoreActiveSessions()
