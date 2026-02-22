const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode');
const express = require('express');
const pino = require('pino');
const { procesarComando } = require('./tareas'); 

const app = express();
const port = process.env.PORT || 10000;
let qrActual = null;

// Ruta para Cron-job.org
app.get('/keep-alive', (req, res) => res.status(200).send('Bot Awake 🚀'));

app.get('/', async (req, res) => {
    if (qrActual) {
        const qrImagen = await qrcode.toDataURL(qrActual);
        res.send(`<html><body style="background:#000;color:white;text-align:center;padding-top:50px;font-family:sans-serif;">
            <h1>📱 VINCULACIÓN SATEX</h1>
            <img src="${qrImagen}" style="width:300px;background:white;padding:10px;border-radius:10px;"/>
            <p>Escanea para activar la sesión permanente.</p>
        </body></html>`);
    } else {
        res.send('<html><body style="background:#000;color:white;text-align:center;padding-top:100px;font-family:sans-serif;"><h2>✅ BOT CONECTADO</h2></body></html>');
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log('🚀 SERVIDOR SATEX INICIADO');
    iniciarWhatsApp();
});

async function iniciarWhatsApp() {
    // Carpeta 'sesion_satex' donde se guardarán tus credenciales
    const { state, saveCreds } = await useMultiFileAuthState('./sesion_satex');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ['Satex System', 'Chrome', '1.0.0']
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (u) => {
        if (u.qr) qrActual = u.qr;
        if (u.connection === 'open') { qrActual = null; console.log('✅ BOT CONECTADO'); }
        if (u.connection === 'close') setTimeout(() => iniciarWhatsApp(), 5000);
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;
        const texto = (msg.message.conversation || msg.message.extendedTextMessage?.text || "");
        const jid = msg.key.remoteJid;

        // Llama a la lógica de tareas.js
        try { await procesarComando(texto, jid, sock); } catch (e) { console.log(e); }
    });
}
