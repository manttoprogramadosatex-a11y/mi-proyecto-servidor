const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
const express = require('express');
const pino = require('pino');

const app = express();
const port = process.env.PORT || 10000;
const URL_SCRIPT = 'https://script.google.com/macros/s/AKfycbwO-g-OjU2-cpYkXEHFDoX1Mvp4omaFysqvQaK2p01BGcmdio4Ihya8TNqNBrO2XH65/exec';

// Esto mantiene a Render feliz
app.get('/', (req, res) => res.send('BOT SATEX ONLINE'));
app.listen(port, '0.0.0.0', () => {
    console.log(`\n--- SERVIDOR LISTO EN PUERTO ${port} ---`);
    iniciar();
});

async function iniciar() {
    // Usamos un nombre de carpeta totalmente nuevo para forzar el QR
    const { state, saveCreds } = await useMultiFileAuthState('sesion_nueva_final');
    
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }), // Silencio total de errores amarillos
        browser: ['Ubuntu', 'Chrome', '20.0.04']
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            console.log('\n\n\n\n\n');
            console.log('#########################################');
            console.log('👇 ESCANEA ESTE CÓDIGO AHORA MISMO:');
            console.log('#########################################\n');
            qrcode.generate(qr, { small: true });
            console.log('\n#########################################');
            console.log('#########################################\n\n\n');
        }

        if (connection === 'close') {
            const code = lastDisconnect.error?.output?.statusCode;
            if (code !== DisconnectReason.loggedOut) {
                // Si falla, esperamos 10 segundos para no saturar los logs
                setTimeout(() => iniciar(), 10000);
            }
        } else if (connection === 'open') {
            console.log('\n✅ ¡CONECTADO EXITOSAMENTE!\n');
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
            try {
                await axios.post(URL_SCRIPT, {
                    idOT, maquina: partes[1], noMq: partes[2], falla: partes[3], 
                    telefono: msg.key.remoteJid.split('@')[0]
                });
                await sock.sendMessage(msg.key.remoteJid, { text: `🛠️ *OT REGISTRADA:* ${idOT}` });
            } catch (e) { console.log('Error Sheets:', e.message); }
        }
    });
}
