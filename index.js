const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcodeTerminal = require('qrcode-terminal'); // Lo usaremos de respaldo
const qrcodeImage = require('qrcode');
const express = require('express');
const pino = require('pino');

const app = express();
const port = process.env.PORT || 10000;
let qrLink = null;

app.get('/', async (req, res) => {
    if (qrLink) {
        const img = await qrcodeImage.toDataURL(qrLink);
        res.send(`<html><body style="background:#000;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;">
            <h1 style="color:#25D366;">ESCANEAME RÁPIDO</h1>
            <div style="background:#fff;padding:20px;border-radius:10px;"><img src="${img}"/></div>
            <p>Refresca (F5) si el código expira</p>
        </body></html>`);
    } else {
        res.send('<html><body style="background:#000;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;"><h2>Generando... Refresca en 10 segundos</h2></body></html>');
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log("🚀 Servidor en puerto " + port);
    iniciar();
});

async function iniciar() {
    // Usamos un nombre de carpeta único para empezar de cero
    const { state, saveCreds } = await useMultiFileAuthState('sesion_nueva_satex');
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
            console.log("--- NUEVO QR GENERADO ---");
            qrcodeTerminal.generate(qr, { small: true }); // Respaldo en logs
        }
        if (connection === 'open') {
            qrLink = null;
            console.log("✅ ¡CONECTADO EXITOSAMENTE!");
        }
        if (connection === 'close') iniciar();
    });
}
