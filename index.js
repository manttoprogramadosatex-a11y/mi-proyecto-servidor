const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
const express = require('express');
const pino = require('pino');

const app = express();
const port = process.env.PORT || 10000;
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwO-g-OjU2-cpYkXEHFDoX1Mvp4omaFysqvQaK2p01BGcmdio4Ihya8TNqNBrO2XH65/exec';

app.get('/', (req, res) => res.send('Servidor Satex Listo'));
app.listen(port, '0.0.0.0', () => console.log(`🚀 Servidor en puerto ${port}`));

async function iniciarBot() {
    // Usamos una carpeta diferente para limpiar intentos fallidos anteriores
    const { state, saveCreds } = await useMultiFileAuthState('sesion_satex');
    
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }), // Silencia los mensajes amarillos
        browser: ['SatexBot', 'Chrome', '1.0.0']
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        // DIBUJAR EL QR MANUALMENTE
        if (qr) {
            console.log('--------------------------------------------------');
            console.log('📢 ESCANEA EL SIGUIENTE QR CON TU CELULAR:');
            console.log('--------------------------------------------------');
            qrcode.generate(qr, { small: true }); // small: true ayuda a que no se deforme
            console.log('--------------------------------------------------');
        }

        if (connection === 'close') {
            const debeReconectar = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (debeReconectar) {
                console.log('🔄 Sincronizando... El QR aparecerá en unos segundos.');
                setTimeout(() => iniciarBot(), 5000); // Espera 5 segundos antes de reintentar
            }
        } else if (connection === 'open') {
            console.log('✅ ¡CONECTADO! Ya puedes usar el bot.');
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
            } catch (e) {
                console.log('Error al enviar:', e.message);
            }
        }
    });
}

iniciarBot();
