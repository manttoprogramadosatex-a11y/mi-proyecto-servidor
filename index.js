const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode');
const express = require('express');
const pino = require('pino');
const { procesarComando } = require('./tareas'); // Importamos la lógica externa

const app = express();
const port = process.env.PORT || 10000;
let qrActual = null;

// Ruta especial para Cron-job.org
app.get('/keep-alive', (req, res) => res.status(200).send('Bot Satex está en línea 🚀'));

app.get('/', async (req, res) => {
    if (qrActual) {
        const qrImagen = await qrcode.toDataURL(qrActual);
        res.send(`<html><body style="background:#000;color:white;text-align:center;padding-top:50px;font-family:sans-serif;">
            <h1>📱 VINCULACIÓN SATEX SYSTEM</h1>
            <div style="background:white; display:inline-block; padding:20px; border-radius:15px;">
                <img src="${qrImagen}" style="width:300px;"/>
            </div>
            <p style="color:#888;">Escanea una vez. La sesión es persistente.</p>
        </body></html>`);
    } else {
        res.send('<html><body style="background:#000;color:white;text-align:center;padding-top:100px;font-family:sans-serif;"><h2>✅ CONEXIÓN WHATSAPP ACTIVA</h2><p>El sistema está operando normalmente.</p></body></html>');
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log('🚀 SERVIDOR SATEX INICIADO');
    iniciarWhatsApp();
});

async function iniciarWhatsApp() {
    // Carpeta de sesión v3 para asegurar limpieza
    const { state, saveCreds } = await useMultiFileAuthState('session_satex_v3');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ['Satex System', 'Chrome', '1.0.0'],
        keepAliveIntervalMs: 60000 // Mantiene el socket activo
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (u) => {
        const { connection, lastDisconnect, qr } = u;
        if (qr) qrActual = qr;
        if (connection === 'open') { 
            qrActual = null; 
            console.log('✅ BOT CONECTADO EXITOSAMENTE'); 
        }
        if (connection === 'close') {
            const debeReconectar = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            if (debeReconectar) {
                console.log('🔄 Reconectando de forma automática...');
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

        // EJECUTAR TAREAS DESDE EL ARCHIVO EXTERNO
        await procesarComando(texto, jid, sock);
    });
}
