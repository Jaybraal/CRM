import Baileys, { useMultiFileAuthState } from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';

let client: any = null;

export async function initWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState('baileys_auth');

  client = Baileys({
    auth: state,
    printQRInTerminal: true,
  });

  client.ev.on('connection.update', async (update: any) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('[WhatsApp] Escanea QR:');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'open') {
      console.log('[WhatsApp] ✓ Conectado');
    }

    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== 401;
      if (shouldReconnect) {
        setTimeout(initWhatsApp, 3000);
      }
    }
  });

  client.ev.on('messages.upsert', async (m: any) => {
    const message = m.messages[0];
    if (!message.key.fromMe) {
      await fetch('http://localhost:4000/api/webhook/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: message.key.remoteJid,
          text: message.message?.conversation || message.message?.extendedTextMessage?.text,
          timestamp: message.messageTimestamp,
        }),
      });
    }
  });

  client.ev.on('creds.update', saveCreds);
  return client;
}

export async function sendMessage(number: string, text: string) {
  if (!client) throw new Error('WhatsApp no conectado');
  await client.sendMessage(`${number}@s.whatsapp.net`, { text });
}
