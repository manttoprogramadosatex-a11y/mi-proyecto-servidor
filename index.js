const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode');
const express = require('express');
const pino = require('pino');

const app = express();
const port = process.env.PORT || 10000;
let qrLink = null;

// RUTA PARA VER EL QR EN EL NAVEGADOR
app.get('/', async (req, res) => {
    if (qrLink) {
        const imagen = await qrcode.toDataURL(qrLink);
        res.send(`<html><body style="background:#121212;color:white;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;">
            <h1 style="color:#25D366;">📱 ESCANEA AHORA</h1>
            <div style="background:white;padding:20px;border-radius:10px;"><img src="${imagen}"/></div>
            <p>Refresca si el código no funciona.</p>
        </body></html>`);
    } else {
        res.send('<html><body style="background:#121212;color:white;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;"><h2>🔄 Generando QR... Refresca en 5 segundos.</h2></body></html>');
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log("Servidor iniciado");
    iniciarWhatsApp();
});

async function iniciarWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('sesion_final_satex');
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ['Satex Bot', 'Chrome', '1.0.0']
    });

    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('connection.update', (update) => {
        const { connection, qr } = update;
        if (qr) qrLink = qr;
        if (connection === 'open') {
            qrLink = null;
            console.log("CONECTADO");
        }
        if (connection === 'close') iniciarWhatsApp();
    });
}
