const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode');
const express = require('express');
const pino = require('pino');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 10000;
let qrActual = null;

const URL_SHEETS = 'https://script.google.com/macros/s/AKfycbwmAYI54dUZsj71qxpsuBUBZhXkgu0vDhRge0HI4QvjkAOpVAk9qxo-bRkKF0r0EXMl/exec';

const capitalizar = (texto) => {
    if (!texto) return "N/A";
    return texto.trim().toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase());
};

app.get('/', async (req, res) => {
    if (qrActual) {
        const qrImagen = await qrcode.toDataURL(qrActual);
        res.send(`<html><body style="background:#000;color:white;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;text-align:center;">
            <h1 style="color:#25D366;font-size:30px;">📱 BOT SATEX: VINCULACIÓN</h1>
            <div style="background:white;padding:20px;border-radius:15px;"><img src="${qrImagen}" style="width:300px;height:300px;"/></div>
            <p style="margin-top:20px;color:#888;">Escanea una vez. La sesión se mantendrá activa automáticamente.</p>
        </body></html>`);
    } else {
        res.send('<html><body style="background:#000;color:white;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;"><h2>🔄 Sesión activa o verificando...</h2></body></html>');
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log('🚀 SERVIDOR SATEX ONLINE');
    iniciarWhatsApp();
});

async function iniciarWhatsApp() {
    // Carpeta de sesión única para evitar desvinculación
    const { state, saveCreds } = await useMultiFileAuthState('session_pro_satex');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        browser: ['Satex System', 'Chrome', '1.0.0'],
        // Configuraciones para que no se desconecte
        keepAliveIntervalMs: 30000,
        defaultQueryTimeoutMs: undefined, 
        connectTimeoutMs: 60000
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (u) => {
        const { connection, lastDisconnect, qr } = u;
        if (qr) qrActual = qr;
        if (connection === 'open') { 
            qrActual = null; 
            console.log('✅✅ CONEXIÓN ESTABLECIDA CON ÉXITO ✅✅'); 
        }
        if (connection === 'close') {
            const debeReconectar = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            if (debeReconectar) {
                console.log('🔄 Reconexión automática en curso...');
                setTimeout(() => iniciarWhatsApp(), 5000);
            }
        }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const textoOriginal = (msg.message.conversation || msg.message.extendedTextMessage?.text || "");
        const textoLwr = textoOriginal.toLowerCase().trim();
        const jid = msg.key.remoteJid;

        if (textoLwr.startsWith('abrir.')) {
            const partes = textoOriginal.split('.');
            if (partes.length < 4) return;

            const numId = Math.floor(1000 + Math.random() * 9000); // Solo el número
            const numeroTel = jid.split('@')[0];

            const datos = {
                idOS: numId, // Sin prefijo OT
                maquina: capitalizar(partes[1]),
                noMq: partes[2].trim(),
                falla: capitalizar(partes[3]),
                telefono: numeroTel
            };

            try {
                await axios.post(URL_SHEETS, datos);
                await sock.sendMessage(jid, { 
                    text: `🛠️ *OS GENERADA:* ${numId}\n\n✅ Reporte de servicio guardado correctamente.` 
                });
            } catch (e) {
                await sock.sendMessage(jid, { text: "❌ Error al reportar a la central." });
            }
        }
    });
}
