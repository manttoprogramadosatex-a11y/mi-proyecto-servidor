const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcodeImage = require('qrcode');
const express = require('express');
const pino = require('pino');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 10000;
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwO-g-OjU2-cpYkXEHFDoX1Mvp4omaFysqvQaK2p01BGcmdio4Ihya8TNqNBrO2XH65/exec';

let qrActual = null;

// RUTA PARA VER EL QR EN EL NAVEGADOR
app.get('/', async (req, res) => {
    if (qrActual) {
        const imagenData = await qrcodeImage.toDataURL(qrActual);
        res.send(`
            <html>
            <body style="background:#121212; color:white; display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; font-family:sans-serif;">
                <h1 style="color:#25D366;">📱 ESCANEA EL QR AHORA</h1>
                <div style="background:white; padding:15px; border-radius:10px;">
                    <img src="${imagenData}" style="width:300px; height:300px;"/>
                </div>
                <p style="margin-top:20px; color:#aaa;">Refresca la página (F5) si el código no carga.</p>
            </body>
            </html>
        `);
    } else {
        res.send('<html><body style="background:#121212; color:white; display:flex; align-items:center; justify-content:center; height:100vh; font-family:sans-serif;"><h2>🔄 Generando QR... espera 5 segundos y refresca.</h2></body></html>');
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log('--- SERVIDOR INICIADO ---');
    iniciarBot();
});

async function iniciarBot() {
    // Usamos un nombre de sesión nuevo para evitar conflictos
    const { state, saveCreds } = await useMultiFileAuthState('sesion_satex_final');
    
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ['Satex Bot', 'Chrome', '1.0.0']
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            qrActual = qr;
            console.log('✅ QR listo para escanear en tu URL.');
        }

        if (connection === 'close') {
            qrActual = null;
            const reintentar = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (reintentar) setTimeout(() => iniciarBot(), 5000);
        } else if (connection === 'open') {
            qrActual = null;
            console.log('✅ ¡BOT CONECTADO EXITOSAMENTE!');
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;
        const texto = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
        
        if (texto.toLowerCase().startsWith('abrir.')) {
            const partes = texto.split('.');
            const idOT = "OT-" + Math.floor(1000 + Math.random() * 9000);
            try {
                await axios.post(SCRIPT_URL, {
                    idOT, maquina: partes[1], noMq: partes[2], falla: partes[3], 
                    telefono: msg.key.remoteJid.split('@')[0]
                });
                await sock.sendMessage(msg.key.remoteJid, { text: `🛠️ *OT GENERADA:* ${idOT}` });
            } catch (e) { console.log('Error Sheets:', e.message); }
        }
    });
}
