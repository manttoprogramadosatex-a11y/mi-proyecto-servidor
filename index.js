const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
const express = require('express');
const pino = require('pino');

const app = express();
const port = process.env.PORT || 10000;
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwO-g-OjU2-cpYkXEHFDoX1Mvp4omaFysqvQaK2p01BGcmdio4Ihya8TNqNBrO2XH65/exec';

// 1. RESPUESTA INSTANTÁNEA: Esto detiene los reinicios de Render
app.get('/', (req, res) => res.send('Servidor Satex Listo'));
app.listen(port, '0.0.0.0', () => {
    console.log(`🚀 Servidor en puerto ${port}. Generando QR...`);
    iniciarBot(); // Arrancamos WhatsApp DESPUÉS de asegurar el puerto
});

async function iniciarBot() {
    // Usamos un nombre de sesión nuevo para limpiar errores previos
    const { state, saveCreds } = await useMultiFileAuthState('sesion_final_satex');
    
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ['Satex', 'Chrome', '1.0.0']
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        // 2. MOSTRAR EL QR SIN RODEOS
        if (qr) {
            console.log('\n\n👇 ESCANEA ESTO AHORA MISMO:');
            qrcode.generate(qr, { small: true });
            console.log('Mantén esta ventana abierta.\n\n');
        }

        if (connection === 'close') {
            const error = lastDisconnect.error?.output?.statusCode;
            if (error !== DisconnectReason.loggedOut) {
                console.log('🔄 Reconectando motor...');
                setTimeout(() => iniciarBot(), 5000);
            }
        } else if (connection === 'open') {
            console.log('✅ ¡SISTEMA VINCULADO Y ACTIVO!');
        }
    });

    // Tu lógica de mensajes (se mantiene igual)
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
                    idOT, maquina: partes[1], noMq: partes[2], falla: partes[3], 
                    telefono: msg.key.remoteJid.split('@')[0]
                });
                await sock.sendMessage(msg.key.remoteJid, { text: `🛠️ *OT CREADA:* ${idOT}` });
            } catch (e) { console.log('Error:', e.message); }
        }
    });
}
