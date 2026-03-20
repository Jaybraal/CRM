import 'dotenv/config'
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import qrcode from 'qrcode-terminal'
import QRCode from 'qrcode'
import express from 'express'
import pino from 'pino'

const CRM_URL = process.env.CRM_URL || 'http://localhost:3000'
const ORG_ID  = process.env.ORG_ID  || ''
const PORT    = process.env.PORT    || 3001

const logger = pino({ level: 'silent' })

// sessions: sessionId -> { sock, qr, status }
const sessions = new Map()

const app = express()
app.use(express.json({ limit: '50mb' }))

// ── Session management ─────────────────────────────────────────

async function startSession(sessionId) {
  if (sessions.has(sessionId)) {
    const existing = sessions.get(sessionId)
    if (existing.status === 'open') return existing
  }

  const authFolder = `auth_info_${sessionId}`
  const { state, saveCreds } = await useMultiFileAuthState(authFolder)
  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    version,
    auth: state,
    logger,
    printQRInTerminal: false,
    browser: ['CRM Auto', 'Chrome', '120.0'],
  })

  const session = { sock, qr: null, status: 'connecting' }
  sessions.set(sessionId, session)

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    const s = sessions.get(sessionId)
    if (!s) return

    if (qr) {
      s.qr = await QRCode.toDataURL(qr)
      s.status = 'qr'
      // Also print to terminal for default session
      if (sessionId === 'default') {
        console.clear()
        console.log('══════════════════════════════════════════════')
        console.log('  📱  Escanea QR para sesión:', sessionId)
        console.log('══════════════════════════════════════════════\n')
        qrcode.generate(qr, { small: true })
      }
    }

    if (connection === 'open') {
      s.status = 'open'
      s.qr = null
      console.log(`✅ Sesión [${sessionId}] conectada`)
      // Notify CRM
      if (ORG_ID) {
        try {
          await fetch(`${CRM_URL}/api/whatsapp/sessions/status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orgId: ORG_ID, sessionId, status: 'connected' }),
          }).catch(() => {})
        } catch {}
      }
    }

    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode
      const reconnect = code !== DisconnectReason.loggedOut
      console.log(`❌ Sesión [${sessionId}] cerrada (código ${code})`)
      if (reconnect) {
        s.status = 'connecting'
        setTimeout(() => startSession(sessionId), 3000)
      } else {
        s.status = 'disconnected'
        s.sock = null
        console.log(`Sesión [${sessionId}] cerrada permanentemente.`)
      }
    }
  })

  // Handle incoming messages
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return
    for (const msg of messages) {
      if (msg.key.fromMe) continue
      if (msg.key.remoteJid?.endsWith('@g.us')) continue

      const jid      = msg.key.remoteJid || ''
      const from     = jid.replace('@s.whatsapp.net', '').replace('@lid', '')
      const fromName = msg.pushName || from

      let text = ''
      let msgType = 'text'
      let locationData = null

      if (msg.message?.conversation) {
        text = msg.message.conversation
      } else if (msg.message?.extendedTextMessage?.text) {
        text = msg.message.extendedTextMessage.text
      } else if (msg.message?.imageMessage) {
        text = msg.message.imageMessage.caption || ''
        msgType = 'image'
      } else if (msg.message?.locationMessage) {
        msgType = 'location'
        locationData = {
          lat: msg.message.locationMessage.degreesLatitude,
          lng: msg.message.locationMessage.degreesLongitude,
          name: msg.message.locationMessage.name || '',
        }
      } else if (msg.message?.audioMessage) {
        msgType = 'audio'
        text = '[Audio]'
      } else if (msg.message?.videoMessage) {
        msgType = 'video'
        text = msg.message.videoMessage.caption || '[Video]'
      } else if (msg.message?.documentMessage) {
        text = `[Documento: ${msg.message.documentMessage.fileName || ''}]`
      }

      console.log(`📨 [${sessionId}] ${fromName}: ${text || `[${msgType}]`}`)
      if (!ORG_ID) continue

      try {
        await fetch(`${CRM_URL}/api/whatsapp/baileys`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orgId: ORG_ID, from, fromName, text, type: msgType, jid, location: locationData, sessionId }),
        })
      } catch (e) {
        console.error('No se pudo reenviar al CRM:', e.message)
      }
    }
  })

  // Handle incoming calls
  sock.ev.on('call', async (calls) => {
    for (const call of calls) {
      if (call.status === 'offer') {
        const from = call.from.replace('@s.whatsapp.net', '')
        console.log(`📞 [${sessionId}] Llamada de ${from}`)
        if (ORG_ID) {
          try {
            await fetch(`${CRM_URL}/api/whatsapp/baileys`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ orgId: ORG_ID, from, fromName: from, text: '[Llamada entrante]', type: 'call', jid: call.from, callDuration: -1, sessionId }),
            })
            await sock.rejectCall(call.id, call.from)
          } catch (e) {
            console.error('Error manejando llamada:', e.message)
          }
        }
      }
    }
  })

  return session
}

// ── REST API ───────────────────────────────────────────────────

// List all sessions
app.get('/sessions', (_req, res) => {
  const list = []
  for (const [id, s] of sessions) {
    list.push({ sessionId: id, status: s.status, hasQr: !!s.qr })
  }
  res.json(list)
})

// Get status of a session
app.get('/status/:sessionId?', (req, res) => {
  const sessionId = req.params.sessionId || 'default'
  const s = sessions.get(sessionId)
  res.json({ sessionId, status: s?.status || 'disconnected', connected: s?.status === 'open' })
})

// Get QR for a session
app.get('/qr/:sessionId?', async (req, res) => {
  const sessionId = req.params.sessionId || 'default'
  const s = sessions.get(sessionId)
  if (!s) {
    // Start session if not exists
    startSession(sessionId).catch(console.error)
    return res.json({ qr: null, status: 'connecting' })
  }
  res.json({ qr: s.qr, status: s.status })
})

// Start/connect a session
app.post('/connect/:sessionId?', async (req, res) => {
  const sessionId = req.params.sessionId || 'default'
  try {
    const s = sessions.get(sessionId)
    if (s?.status === 'open') return res.json({ status: 'open', message: 'Ya conectado' })
    startSession(sessionId)
    res.json({ status: 'connecting', message: 'Iniciando sesión, solicita el QR en /qr/' + sessionId })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Disconnect a session
app.delete('/session/:sessionId?', async (req, res) => {
  const sessionId = req.params.sessionId || 'default'
  const s = sessions.get(sessionId)
  if (!s) return res.json({ ok: true, message: 'Sesión no existe' })
  try {
    if (s.sock) await s.sock.logout()
    sessions.delete(sessionId)
    // Remove auth folder
    const { rm } = await import('fs/promises')
    await rm(`auth_info_${sessionId}`, { recursive: true, force: true })
    res.json({ ok: true })
  } catch (e) {
    sessions.delete(sessionId)
    res.json({ ok: true, warning: e.message })
  }
})

// Send text (sessionId optional, defaults to 'default')
app.post('/send', async (req, res) => {
  const { to, text, sessionId: sid } = req.body
  const sessionId = sid || 'default'
  const s = sessions.get(sessionId)
  if (!s?.sock || s.status !== 'open') return res.status(503).json({ error: 'Sesión no conectada: ' + sessionId })
  if (!to || !text) return res.status(400).json({ error: 'Faltan parámetros' })
  try {
    const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`
    await s.sock.sendMessage(jid, { text })
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Send image
app.post('/send-image', async (req, res) => {
  const { to, url, caption, sessionId: sid } = req.body
  const sessionId = sid || 'default'
  const s = sessions.get(sessionId)
  if (!s?.sock || s.status !== 'open') return res.status(503).json({ error: 'Sesión no conectada: ' + sessionId })
  if (!to || !url) return res.status(400).json({ error: 'Faltan parámetros' })
  try {
    const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`
    await s.sock.sendMessage(jid, { image: { url }, caption: caption || '' })
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Send location
app.post('/send-location', async (req, res) => {
  const { to, lat, lng, name, sessionId: sid } = req.body
  const sessionId = sid || 'default'
  const s = sessions.get(sessionId)
  if (!s?.sock || s.status !== 'open') return res.status(503).json({ error: 'Sesión no conectada: ' + sessionId })
  if (!to || lat == null || lng == null) return res.status(400).json({ error: 'Faltan parámetros' })
  try {
    const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`
    await s.sock.sendMessage(jid, {
      location: { degreesLatitude: parseFloat(lat), degreesLongitude: parseFloat(lng), name: name || '' },
    })
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Voice call — Baileys does not support outgoing calls, return info
app.post('/call', async (_req, res) => {
  res.status(501).json({ error: 'Llamadas salientes no soportadas por Baileys. Usa wa.me en su lugar.' })
})

app.listen(PORT, () => {
  console.log(`\n🚀 Baileys server en http://localhost:${PORT}`)
  console.log(`📡 CRM: ${CRM_URL}`)
  if (!ORG_ID) console.warn('⚠️  ORG_ID no configurado')
  else console.log(`🏢 Org: ${ORG_ID}\n`)
})

// Start default session on boot
startSession('default')
