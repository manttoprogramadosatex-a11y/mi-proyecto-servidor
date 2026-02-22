onst { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode');
const express = require('express');
const pino = require('pino');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 10000;
let qrActual = null;

app.get('/', async (req, res) => {
    if (qrActual) {
        const qrImagen = await qrcode.toDataURL(qrActual);
        res.send(`
            <html>
            <body style="background:#000; color:white; display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; font-family:sans-serif;">
                <h1 style="color:#25D366;">📱 ESCANEA EL QR AHORA</h1>
                <div style="background:white; padding:20px; border-radius:15px;">
                    <img src="${qrImagen}" style="width:300px; height:300px;"/>
                </div>
                <p style="margin-top:20px; color:#888;">Si el código no cambia, refresca la página (F5).</p>
            </body>
            </html>
        `);
    } else {
        res.send('<html><body style="background:#000; color:white; display:flex; align-items:center; justify-content:center; height:100vh;"><h2>🔄 Generando QR limpio... Refresca en 10 segundos.</h2></body></html>');
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log('SERVIDOR SATEX INICIADO');
    iniciarBot();
});

async function iniciarBot() {
    // ESTA LINEA ES LA CLAVE: Cambiamos el nombre para resetear todo
    const { state, saveCreds } = await useMultiFileAuthState('sesion_limpia_total');
    
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ['Satex Bot', 'Chrome', '1.0.0']
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (u) => {
        if (u.qr) {
            qrActual = u.qr;
            console.log('✅ NUEVO QR LISTO');
        }
        if (u.connection === 'open') {
            qrActual = null;
            console.log('✅ CONECTADO');
        }
        if (u.connection === 'close') {
            const reintentar = u.lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (reintentar) setTimeout(() => iniciarBot(), 5000);
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;
        const texto = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
        if (texto.toLowerCase().startsWith('abrir.')) {
            const idOT = "OT-" + Math.floor(Math.random() * 10000);
            try {
                await axios.post('TU_URL_DE_SHEETS_AQUI', { idOT, texto }); // Reemplaza con tu URL real
                await sock.sendMessage(msg.key.remoteJid, { text: `🛠️ OT GENERADA: ${idOT}` });
            } catch (e) { console.log('Error Sheets'); }
        }
    });
}
