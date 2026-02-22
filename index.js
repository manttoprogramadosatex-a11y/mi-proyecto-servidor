const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
const express = require('express');
const pino = require('pino');

const app = express();
const port = process.env.PORT || 10000;
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwO-g-OjU2-cpYkXEHFDoX1Mvp4omaFysqvQaK2p01BGcmdio4Ihya8TNqNBrO2XH65/exec';

// 1. RESPUESTA INMEDIATA PARA RENDER (Evita el reinicio temprano)
app.get('/', (req, res) => res.send('Bot Satex Activo'));
app.listen(port, '0.0.0.0', () => {
    console.log(`🚀 Servidor listo en puerto ${port}. Iniciando motor de WhatsApp...`);
});

async function iniciarBot() {
    // Usamos una carpeta de sesión limpia para forzar un nuevo QR
    const { state, saveCreds } = await useMultiFileAuthState('sesion_activa_satex');
    
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }), // Silencia las advertencias amarillas
        browser: ['Satex Bot', 'Chrome', '1.0.0'],
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 0
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        // 2. FORZAR LA IMPRESIÓN DEL QR
        if (qr) {
            console.log('\n\n\n📢 ¡ATENCIÓN! ESCANEA ESTE CÓDIGO AHORA:');
            qrcode.generate(qr, { small: true });
            console.log('Si el código se ve mal, aleja el zoom del navegador (Ctrl y -)\n\n');
        }

        if (connection === 'close') {
            const codigoError = lastDisconnect.error?.output?.statusCode;
            if (codigoError !== DisconnectReason.loggedOut) {
                // Si se cierra sin escaneo, reintentamos rápido
                console.log('🔄 Sincronizando motor... el QR aparecerá en breve.');
                setTimeout(() => iniciarBot(), 3000); 
            }
        } else if (connection === 'open') {
            console.log('✅ ¡ÉXITO! Bot vinculado correctamente.');
        }
    });

    // Evento de mensajes (Tu lógica de OT)
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;
        const texto = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
        if (!texto.includes('.')) return;
        const partes = texto.split('.');
        if (partes[0].trim().toLowerCase() === 'abrir') {
            const idOT = "OT-" + Math.floor(1000 + Math.random() * 9999);
            const datos = {
                idOT, 
                fecha: new Date().toLocaleDateString('es-MX'),
                maquina: partes[1], 
                noMq: partes[2], 
                falla: partes[3], 
                telefono: msg.key.remoteJid.split('@')[0]
            };
            try {
                await axios.post(APPS_SCRIPT_URL, datos);
                await sock.sendMessage(msg.key.remoteJid, { text: `🛠️ *OT REGISTRADA:* ${idOT}` });
            } catch (e) { console.log('Error en Sheets:', e.message); }
        }
    });
}

// Arrancar el proceso con un pequeño retraso para asegurar que Express esté vivo
setTimeout(() => iniciarBot(), 2000);
