const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode');
const express = require('express');
const pino = require('pino');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 10000;
let qrActual = null;

// TU URL DE GOOGLE SHEETS
const URL_SHEETS = 'https://script.google.com/macros/s/AKfycbzV4y8eeTI4U7CUjKveRJy8B6eNuRqr3vHyavywTOAj4GKV3OClQ348EQfTUR5fnCnb/exec';

// Función para poner la primera letra en mayúscula (Capitalize)
const capitalizar = (texto) => {
    if (!texto) return "N/A";
    return texto.trim().toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase());
};

app.get('/', async (req, res) => {
    if (qrActual) {
        const qrImagen = await qrcode.toDataURL(qrActual);
        res.send(`<html><body style="background:#000;color:white;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;text-align:center;">
            <h1 style="color:#25D366;font-size:30px;">📱 BOT SATEX: LISTO</h1>
            <div style="background:white;padding:20px;border-radius:15px;"><img src="${qrImagen}" style="width:300px;height:300px;"/></div>
            <p style="margin-top:20px;color:#888;">Escanea para activar el sistema.</p>
        </body></html>`);
    } else {
        res.send('<html><body style="background:#000;color:white;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;"><h2>🔄 Verificando sesión...</h2></body></html>');
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log('🚀 SERVIDOR ONLINE');
    iniciarWhatsApp();
});

async function iniciarWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('sesion_estable_satex');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ['Satex System', 'Chrome', '1.0.0']
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (u) => {
        if (u.qr) qrActual = u.qr;
        if (u.connection === 'open') { qrActual = null; console.log('✅✅ CONECTADO ✅✅'); }
        if (u.connection === 'close') setTimeout(() => iniciarWhatsApp(), 15000);
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        // .toLowerCase() hace que no importe si es mayúscula o minúscula
        const textoRecibido = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").toLowerCase();
        const jid = msg.key.remoteJid;

        if (textoRecibido.startsWith('abrir.')) {
            const partes = textoRecibido.split('.');
            const idOT = "OT-" + Math.floor(1000 + Math.random() * 9000);
            
            try {
                // Enviamos los datos capitalizados a la hoja
                await axios.post(URL_SHEETS, {
                    idOT: idOT,
                    maquina: capitalizar(partes[1]),
                    noMq: partes[2] ? partes[2].toUpperCase() : 'N/A', // El número lo dejamos en mayúsculas
                    falla: capitalizar(partes[3]),
                    telefono: jid.split('@')[0]
                });
                
                await sock.sendMessage(jid, { text: `🛠️ *OT GENERADA:* ${idOT}\n✅ Registrado: *${capitalizar(partes[1])}* - *${partes[2]}*` });
            } catch (e) {
                await sock.sendMessage(jid, { text: `❌ Error de conexión con Sheets.` });
            }
        }
    });
}
