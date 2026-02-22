const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcodeTerminal = require('qrcode-terminal');
const qrcodeImage = require('qrcode'); // Necesitamos esta para la web
const axios = require('axios');
const express = require('express');
const pino = require('pino');

const app = express();
const port = process.env.PORT || 10000;
const URL_SHEETS = 'https://script.google.com/macros/s/AKfycbwO-g-OjU2-cpYkXEHFDoX1Mvp4omaFysqvQaK2p01BGcmdio4Ihya8TNqNBrO2XH65/exec';

let qrActual = null;

// --- INTERFAZ WEB PARA VER EL QR ---
app.get('/', async (req, res) => {
    if (qrActual) {
        const qrImagen = await qrcodeImage.toDataURL(qrActual);
        res.send(`
            <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:#121212;color:white;font-family:sans-serif;">
                <h1 style="margin-bottom:20px;">📱 Escanea el QR de Satex</h1>
                <img src="${qrImagen}" style="border:10px solid white; border-radius:10px; width:300px;"/>
                <p style="margin-top:20px;color:#aaa;">Actualiza la página si el código expira.</p>
            </div>
        `);
    } else {
        res.send(`
            <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:#121212;color:white;font-family:sans-serif;">
                <h1>✅ Bot Conectado o Esperando...</h1>
                <p>Si el bot ya está activo, no verás el QR. Revisa los logs de Render.</p>
            </div>
        `);
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log(`🚀 SERVIDOR WEB EN PUERTO ${port}`);
    iniciarBot();
});

async function iniciarBot() {
    const { state, saveCreds } = await useMultiFileAuthState('sesion_final_v5');
    
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ['Ubuntu', 'Chrome', '20.0.04']
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            qrActual = qr; 
            console.log('📢 CÓDIGO QR GENERADO. Míralo en tu link de Render.');
            qrcodeTerminal.generate(qr, { small: true });
        }

        if (connection === 'close') {
            qrActual = null;
            const reintentar = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (reintentar) {
                console.log('🔄 Reintentando conexión...');
                setTimeout(() => iniciarBot(), 5000);
            }
        } else if (connection === 'open') {
            qrActual = null;
            console.log('✅ ¡WHATSAPP CONECTADO EXITOSAMENTE!');
        }
    });

    // Lógica de mensajes (OT)
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
                await sock.sendMessage(msg.key.remoteJid, { text: `🛠️ *OT GENERADA:* ${idOT}` });
            } catch (e) { console.log('Error:', e.message); }
        }
    });
}
