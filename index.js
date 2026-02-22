const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode');
const express = require('express');
const pino = require('pino');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 10000;
const URL_SHEETS = 'https://script.google.com/macros/s/AKfycbwO-g-OjU2-cpYkXEHFDoX1Mvp4omaFysqvQaK2p01BGcmdio4Ihya8TNqNBrO2XH65/exec';

let qrActual = null;

// PAGINA WEB PARA VER EL QR
app.get('/', async (req, res) => {
    if (qrActual) {
        const imagenData = await qrcode.toDataURL(qrActual);
        res.send(`
            <html>
            <body style="background:#121212; color:white; display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; font-family:sans-serif;">
                <h1 style="color:#25D366;">📱 ESCANEA EL QR DE SATEX</h1>
                <div style="background:white; padding:20px; border-radius:15px; box-shadow: 0 0 20px rgba(0,0,0,0.5);">
                    <img src="${imagenData}" style="width:300px; height:300px;"/>
                </div>
                <p style="margin-top:20px; color:#888;">Si el código no carga, refresca la página (F5).</p>
            </body>
            </html>
        `);
    } else {
        res.send('<html><body style="background:#121212; color:white; display:flex; align-items:center; justify-content:center; height:100vh; font-family:sans-serif;"><h2>🔄 Iniciando motor... Espera 10 segundos y refresca la página.</h2></body></html>');
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log('🚀 SERVIDOR ONLINE EN PUERTO ' + port);
    iniciarBot();
});

async function iniciarBot() {
    // CAMBIAMOS EL NOMBRE DE LA SESION PARA LIMPIAR ERRORES
    const { state, saveCreds } = await useMultiFileAuthState('sesion_limpia_v1');
    
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ['Satex System', 'Chrome', '1.0.0']
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            qrActual = qr;
            console.log('📢 NUEVO QR GENERADO');
        }

        if (connection === 'close') {
            qrActual = null;
            const debeReconectar = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (debeReconectar) {
                console.log('🔄 Reconectando...');
                setTimeout(() => iniciarBot(), 5000);
            }
        } else if (connection === 'open') {
            qrActual = null;
            console.log('✅ CONECTADO A WHATSAPP');
        }
    });

    // Lógica de las OTs
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
