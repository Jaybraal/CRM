"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initWhatsApp = initWhatsApp;
exports.sendMessage = sendMessage;
const baileys_1 = __importStar(require("@whiskeysockets/baileys"));
const qrcode_terminal_1 = __importDefault(require("qrcode-terminal"));
let client = null;
async function initWhatsApp() {
    const { state, saveCreds } = await (0, baileys_1.useMultiFileAuthState)('baileys_auth');
    client = (0, baileys_1.default)({
        auth: state,
        printQRInTerminal: true,
    });
    client.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) {
            console.log('[WhatsApp] Escanea QR:');
            qrcode_terminal_1.default.generate(qr, { small: true });
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
    client.ev.on('messages.upsert', async (m) => {
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
async function sendMessage(number, text) {
    if (!client)
        throw new Error('WhatsApp no conectado');
    await client.sendMessage(`${number}@s.whatsapp.net`, { text });
}
//# sourceMappingURL=whatsapp.js.map