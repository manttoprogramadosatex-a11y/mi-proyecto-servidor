const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcodeTerminal = require('qrcode-terminal');
const qrcodeImage = require('qrcode');
const axios = require('axios');
const express = require('express');
const pino = require('pino');

const app = express();
const port = process.env.PORT || 10000;
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwO-g-OjU2-cpYkXEHFDoX1Mvp4omaFysqvQaK2p01BGcmdio4Ihya8TNqNBrO2XH65/exec';

let ultimoQR = null;

// ESTA ES LA PÁGINA QUE ABRISTE (Ahora mostrará el QR)
app.get('/', async (req, res) => {
    if (ultimoQR) {
        try {
            const qrImagen = await qrcodeImage.toDataURL(ultimoQR);
            res.send(`
                <html>
                    <body style="background:#1c1c1c; color:white; display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; font-family:sans-serif;">
                        <h1 style="color:#25D366;">📱 ESCANEA EL QR DE SATEX</h1>
                        <div style="background:white; padding:20px; border-radius:15px; box-shadow: 0 0 20px rgba(0,0,0,0.5);">
                            <img src="${qrImagen}" style="width:300px; height:300px;" />
                        </div>
                        <p style="margin-top:20px; color:#888;">Si el código expira, solo refresca esta página (F5).</p>
                    </body>
                </html>
            `);
        } catch (err) {
            res.status(500).send('Error generando imagen QR');
        }
    } else {
        res.send(`
            <html>
                <body style="background:#1c1c1c; color:white; display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; font-family:sans-serif;">
                    <h2>🔄 Generando código...</h2>
                    <p>Espera 10 segundos y refresca la página.</p>
                </body>
            </html>
        `);
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log(`🚀 Servidor Web en puerto ${port}`);
    iniciarBot();
});

async function iniciarBot() {
    const { state, saveCreds } = await useMultiFileAuthState('sesion_satex_v5');
    
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ['Satex System', 'Chrome', '1.0.0']
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            ultimoQR = qr; // Guardamos el QR para mostrarlo en la web
            console.log('📢 Nuevo QR generado. Refresca tu página web para verlo.');
            qrcodeTerminal.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const reintentar = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (reintentar) {
                console.log('🔄 Reconectando...');
                iniciarBot();
            }
        } else if (connection === 'open') {
            ultimoQR = null; // Ya no necesitamos mostrar el QR
            console.log('✅ ¡CONECTADO EXITOSAMENTE!');
        }
    });

    // Lógica para recibir mensajes y enviar a Google Sheets
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const texto = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
        if (!texto.includes('.')) return;

        const partes = texto.split('.');
        if (partes[0].trim().toLowerCase() === 'abrir') {
            const idOT = "OT-" + Math.floor(1000 + Math.random() * 9000);
            try {
                await axios.post(APPS_SCRIPT_URL, {
                    idOT, fecha: new Date().toLocaleDateString('es-MX'),
                    maquina: partes[1], noMq: partes[2], falla: partes[3],
                    telefono: msg.key.remoteJid.split('@')[0]
                });
                await sock.sendMessage(msg.key.remoteJid, { text: `🛠️ *REGISTRO EXITOSO*\nID: *${idOT}*` });
            } catch (e) { console.log('Error Sheets:', e.message); }
        }
    });
}
