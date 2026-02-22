// index.js
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode');
const express = require('express');
const pino = require('pino');
const { procesarComando } = require('./tareas');

const app = express();
const port = process.env.PORT || 10000;
let qrActual = null;

app.get('/keep-alive', (req, res) => res.status(200).send('Bot Satex Vivo 🚀'));

app.get('/', async (req, res) => {
    if (qrActual) {
        const qrImagen = await qrcode.toDataURL(qrActual);
        res.send(`<html><body style="background:#000;color:white;text-align:center;padding-top:50px;font-family:sans-serif;">
            <h1>📱 VINCULACIÓN SATEX</h1>
            <div style="background:white; display:inline-block; padding:20px; border-radius:15px;"><img src="${qrImagen}" style="width:300px;"/></div>
            <p>Escanea una vez. Luego sube la carpeta 'sesion_gratis' a GitHub para que no se borre.</p>
        </body></html>`);
    } else {
        res.send('<html><body style="background:#000;color:white;text-align:center;padding-top:100px;font-family:sans-serif;"><h2>✅ CONEXIÓN ACTIVA</h2></body></html>');
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log('🚀 SERVIDOR ONLINE');
    iniciarWhatsApp();
});

async function iniciarWhatsApp() {
    // 
    const { state, saveCreds } = await useMultiFileAuthState('./sesion_gratis');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ['Satex System', 'Chrome', '1.0.0'],
        // Estos ajustes ayudan a que no se desconecte 
        keepAliveIntervalMs: 30000,
        printQRInTerminal: true
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (u) => {
        const { connection, lastDisconnect, qr } = u;
        if (qr) qrActual = qr;
        if (connection === 'open') { qrActual = null; console.log('✅ BOT CONECTADO'); }
        if (connection === 'close') {
            const status = lastDisconnect?.error?.output?.statusCode;
            if (status !== DisconnectReason.loggedOut) {
                console.log('🔄 Reconectando...');
                setTimeout(() => iniciarWhatsApp(), 5000);
            }
        }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;
        const texto = (msg.message.conversation || msg.message.extendedTextMessage?.text || "");
        const jid = msg.key.remoteJid;
        await procesarComando(texto, jid, sock);
    });
}
