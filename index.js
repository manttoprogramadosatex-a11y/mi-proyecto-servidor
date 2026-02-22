const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
const express = require('express');
const pino = require('pino');

const app = express();
const port = process.env.PORT || 10000;
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwO-g-OjU2-cpYkXEHFDoX1Mvp4omaFysqvQaK2p01BGcmdio4Ihya8TNqNBrO2XH65/exec';

app.get('/', (req, res) => res.send('Bot Satex Activo'));
app.listen(port, '0.0.0.0', () => console.log(`🚀 Servidor en puerto ${port}`));

async function iniciarBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_satex');
    
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ['MacOS', 'Chrome', '10.15.7'],
        connectTimeoutMs: 60000, // Aumentamos tiempo de espera
        defaultQueryTimeoutMs: 0,
        keepAliveIntervalMs: 10000
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            console.log('==================================================');
            console.log('✅ CÓDIGO QR LISTO - ESCANEA AHORA:');
            console.log('==================================================');
            qrcode.generate(qr, { small: true });
            console.log('==================================================');
        }

        if (connection === 'close') {
            const errorCod = lastDisconnect.error?.output?.statusCode;
            // Solo reconectar si no fue un cierre voluntario
            if (errorCod !== DisconnectReason.loggedOut) {
                console.log('🔄 Sincronizando sesión... espere un momento');
                setTimeout(() => iniciarBot(), 5000); // Espera 5 segundos para no saturar
            }
        } else if (connection === 'open') {
            console.log('🎉 ¡EXITO! BOT SATEX VINCULADO Y TRABAJANDO');
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
                await sock.sendMessage(msg.key.remoteJid, { text: `🛠️ *REGISTRO SATEX*\nID: *${idOT}*\nEstado: Guardado en Bitácora` });
            } catch (e) {
                console.log('Error al enviar datos:', e.message);
            }
        }
    });
}

iniciarBot();
