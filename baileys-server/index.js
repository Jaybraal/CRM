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
const ORG_ID  = process.env.ORG_ID  || ''
const PORT    = process.env.PORT    || 3001

const logger = pino({ level: 'silent' })

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

async function startSession(sessionId) {
  if (sessions.has(sessionId)) {
    const existing = sessions.get(sessionId)
    if (existing.status === 'open') return existing
  }

  const { state, saveCreds } = await useFirestoreAuthState(sessionId)
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
      console.log(`Sesion [${sessionId}] conectada`)
      await db.collection('whatsapp_sessions').doc(sessionId).set(
        { status: 'connected', connectedAt: FieldValue.serverTimestamp() },
        { merge: true }
      )
      if (ORG_ID) {
        fetch(`${CRM_URL}/api/whatsapp/sessions/status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orgId: ORG_ID, sessionId, status: 'connected' }),
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

      console.log(`[${sessionId}] ${fromName}: ${text || `[${msgType}]`}`)
      if (!ORG_ID) continue

      fetch(`${CRM_URL}/api/whatsapp/baileys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId: ORG_ID, from, fromName, text, type: msgType, jid, location: locationData, sessionId }),
      }).catch(e => console.error('Error reenvio al CRM:', e.message))
    }
  })

  sock.ev.on('call', async (calls) => {
    for (const call of calls) {
      if (call.status === 'offer') {
        const from = call.from.replace('@s.whatsapp.net', '')
        console.log(`Llamada de ${from} en sesion [${sessionId}]`)
        if (ORG_ID) {
          fetch(`${CRM_URL}/api/whatsapp/baileys`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orgId: ORG_ID, from, fromName: from, text: '[Llamada entrante]', type: 'call', jid: call.from, callDuration: -1, sessionId }),
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
    list.push({ sessionId: id, status: s.status, hasQr: !!s.qr })
  }
  res.json(list)
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
  try {
    const s = sessions.get(sessionId)
    if (s?.status === 'open') return res.json({ status: 'open', message: 'Ya conectado' })
    startSession(sessionId)
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
  const { to, text, sessionId: sid } = req.body
  const sessionId = sid || 'default'
  const s = sessions.get(sessionId)
  if (!s?.sock || s.status !== 'open') return res.status(503).json({ error: 'Sesion no conectada: ' + sessionId })
  if (!to || !text) return res.status(400).json({ error: 'Faltan parametros' })
  try {
    const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`
    await s.sock.sendMessage(jid, { text })
    res.json({ ok: true })
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
    await s.sock.sendMessage(jid, { image: { url }, caption: caption || '' })
    res.json({ ok: true })
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
    await s.sock.sendMessage(jid, {
      location: { degreesLatitude: parseFloat(lat), degreesLongitude: parseFloat(lng), name: name || '' },
    })
    res.json({ ok: true })
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
  if (!ORG_ID) console.warn('ORG_ID no configurado')
  else console.log(`Org: ${ORG_ID}`)
})

restoreActiveSessions()
