const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
const express = require('express');
const pino = require('pino');

const app = express();
const port = process.env.PORT || 10000;
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwO-g-OjU2-cpYkXEHFDoX1Mvp4omaFysqvQaK2p01BGcmdio4Ihya8TNqNBrO2XH65/exec';

// 1. ARRANCAR EL SERVIDOR DE INMEDIATO (Esto engaña a Render para que no reinicie)
app.get('/', (req, res) => res.send('Bot Satex Activo y Funcionando'));
app.listen(port, '0.0.0.0', () => {
    console.log(`\n🚀 SERVIDOR INICIADO EN PUERTO ${port}`);
    console.log(`⏳ Iniciando motor de WhatsApp, por favor espera...\n`);
    iniciarBot();
});

async function iniciarBot() {
    // Usamos una carpeta de sesión nueva para evitar conflictos de intentos fallidos
    const { state, saveCreds } = await useMultiFileAuthState('sesion_final_satex_v4');
    
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ['Chrome (Satex)', 'MacOS', '3.0.0'],
        connectTimeoutMs: 60000, // Tiempo extra para conexiones lentas
        defaultQueryTimeoutMs: 0
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        // 2. MOSTRAR EL QR SIN FILTROS
        if (qr) {
            console.log('\n=========================================');
            console.log('📢 ¡ESCANEAME AHORA CON TU WHATSAPP!');
            console.log('=========================================');
            qrcode.generate(qr, { small: true });
            console.log('=========================================\n');
        }

        if (connection === 'close') {
            const error = lastDisconnect.error?.output?.statusCode;
            if (error !== DisconnectReason.loggedOut) {
                console.log('🔄 Sincronizando motor... el QR aparecerá en breve.');
                setTimeout(() => iniciarBot(), 3000); 
            }
        } else if (connection === 'open') {
            console.log('\n✅ ¡CONEXIÓN EXITOSA! El bot ya está operando.\n');
        }
    });

    // Lógica de registro de OT
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
                maquina: partes[1]?.trim(),
                noMq: partes[2]?.trim(),
                falla: partes[3]?.trim(),
                telefono: msg.key.remoteJid.split('@')[0]
            };

            try {
                await axios.post(APPS_SCRIPT_URL, datos);
                await sock.sendMessage(msg.key.remoteJid, { text: `🛠️ *OT GENERADA CON ÉXITO*\nID: *${idOT}*` });
            } catch (e) {
                console.log('Error al enviar datos:', e.message);
            }
        }
    });
}
