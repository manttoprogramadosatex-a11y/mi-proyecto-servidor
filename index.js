const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcodeTerminal = require('qrcode-terminal');
const qrcodeImage = require('qrcode');
const axios = require('axios');
const express = require('express');
const pino = require('pino');

const app = express();
const port = process.env.PORT || 10000;
const URL_SHEETS = 'https://script.google.com/macros/s/AKfycbwO-g-OjU2-cpYkXEHFDoX1Mvp4omaFysqvQaK2p01BGcmdio4Ihya8TNqNBrO2XH65/exec';

let ultimoQR = null;

// PAGINA WEB PARA VER EL QR SI FALLA LA CONSOLA
app.get('/', async (req, res) => {
    if (ultimoQR) {
        // Genera el QR como una imagen para que lo escanees desde el navegador
        const urlImagen = await qrcodeImage.toDataURL(ultimoQR);
        res.send(`
            <html>
                <body style="display:flex;flex-direction:column;align-items:center;justify-content:center;background:#121212;color:white;font-family:sans-serif;">
                    <h1>🤖 ESCANEA EL QR DE SATEX</h1>
                    <img src="${urlImagen}" style="border:10px solid white; border-radius:10px;" />
                    <p>Actualiza la página si el código expira.</p>
                </body>
            </html>
        `);
    } else {
        res.send('<h1>Esperando código QR...</h1><p>Si el bot ya está conectado, verás este mensaje.</p>');
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log(`🚀 SERVIDOR WEB ACTIVO EN PUERTO ${port}`);
    iniciarBot();
});

async function iniciarBot() {
    const { state, saveCreds } = await useMultiFileAuthState('sesion_emergencia');
    
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ['Chrome (Render)', 'MacOS', '3.0.0']
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            ultimoQR = qr; // Guardamos el QR para la página web
            console.log('📢 ¡NUEVO QR GENERADO! Míralo en tu URL de Render.');
            qrcodeTerminal.generate(qr, { small: true });
        }

        if (connection === 'close') {
            ultimoQR = null;
            const reintentar = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (reintentar) setTimeout(() => iniciarBot(), 5000);
        } else if (connection === 'open') {
            ultimoQR = null;
            console.log('✅ ¡WHATSAPP CONECTADO!');
        }
    });

    // Lógica de las OTs (Tu código de siempre)
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;
        const texto = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
        if (texto.toLowerCase().startsWith('abrir.')) {
            const partes = texto.split('.');
            const idOT = "OT-" + Math.floor(1000 + Math.random() * 9000);
            try {
                await axios.post(URL_SHEETS, {
                    idOT, maquina: partes[1], noMq: partes[2], falla: partes[3], 
                    telefono: msg.key.remoteJid.split('@')[0]
                });
                await sock.sendMessage(msg.key.remoteJid, { text: `🛠️ *OT REGISTRADA:* ${idOT}` });
            } catch (e) { console.log('Error:', e.message); }
        }
    });
}
