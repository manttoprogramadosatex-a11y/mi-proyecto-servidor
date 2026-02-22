const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode');
const express = require('express');
const pino = require('pino');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 10000;
let qrLink = null;

// RUTA PARA VER EL QR EN EL NAVEGADOR
app.get('/', async (req, res) => {
    if (qrLink) {
        try {
            const img = await qrcode.toDataURL(qrLink);
            res.send(`<html><body style="background:#121212;color:white;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;">
                <h1 style="color:#25D366;">📱 ESCANEA EL QR DE SATEX</h1>
                <div style="background:white;padding:20px;border-radius:10px;"><img src="${img}" style="width:300px;"/></div>
                <p style="margin-top:20px;color:#888;">Si el código expira, refresca la página (F5).</p>
            </body></html>`);
        } catch (e) { res.send("Error generando imagen"); }
    } else {
        res.send('<html><body style="background:#121212;color:white;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;"><h2>🔄 Generando código... Refresca en 10 segundos.</h2></body></html>');
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log("🚀 Servidor Web Activo");
    iniciarWhatsApp();
});

async function iniciarWhatsApp() {
    // Usamos un nombre de sesión nuevo para limpiar el bucle de reconexión
    const { state, saveCreds } = await useMultiFileAuthState('sesion_limpia_definitiva');
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ['Satex System', 'Chrome', '1.0.0']
    });

    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('connection.update', (u) => {
        const { connection, qr } = u;
        if (qr) {
            qrLink = qr;
            console.log("📢 QR Generado. Míralo en tu link de Render.");
        }
        if (connection === 'open') {
            qrLink = null;
            console.log("✅ ¡CONECTADO EXITOSAMENTE!");
        }
        if (connection === 'close') {
            console.log("🔄 Reiniciando bot...");
            iniciarWhatsApp();
        }
    });
}
