const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
const express = require('express');
const pino = require('pino');

const app = express();
const port = process.env.PORT || 10000;
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwO-g-OjU2-cpYkXEHFDoX1Mvp4omaFysqvQaK2p01BGcmdio4Ihya8TNqNBrO2XH65/exec';

app.get('/', (req, res) => res.send('Bot Satex Vivo'));
app.listen(port, '0.0.0.0', () => console.log(`🚀 Servidor activo en puerto ${port}`));

async function iniciarBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_satex');
    
    const sock = makeWASocket({
        auth: state,
        // Eliminamos la opción obsoleta y gestionamos el QR manualmente abajo
        logger: pino({ level: 'silent' })
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        // ESTO MOSTRARÁ EL QR EN LOS TRONCOS DE RENDER
        if (qr) {
            console.log('--------------------------------------------------');
            console.log('👉 ESCANEA ESTE CÓDIGO QR CON TU WHATSAPP:');
            console.log('--------------------------------------------------');
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const error = lastDisconnect.error?.output?.statusCode;
            if (error !== DisconnectReason.loggedOut) iniciarBot();
        } else if (connection === 'open') {
            console.log('✅ CONEXIÓN EXITOSA: El Bot Satex está trabajando.');
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const texto = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
        if (!texto.includes('.')) return;

        const partes = texto.split('.');
        if (partes[0].trim().toLowerCase() === 'abrir') {
            const idOT = "OT-" + Math.floor(1000 + Math.random() * 9000);
            const datos = {
                idOT: idOT,
                fecha: new Date().toLocaleDateString('es-MX'),
                horaIso: new Date().toISOString(),
                maquina: partes[1]?.trim(),
                noMq: partes[2]?.trim(),
                falla: partes[3]?.trim(),
                telefono: msg.key.remoteJid.split('@')[0]
            };

            try {
                await axios.post(APPS_SCRIPT_URL, datos);
                await sock.sendMessage(msg.key.remoteJid, { text: `🛠️ *REGISTRO EXITOSO*\nID: *${idOT}*` });
            } catch (e) { console.log('Error:', e.message); }
        }
    });
}

iniciarBot();
