const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode');
const express = require('express');
const pino = require('pino');

const app = express();
const port = process.env.PORT || 10000;
let qrActual = null;

app.get('/', async (req, res) => {
    if (qrActual) {
        const qrImagen = await qrcode.toDataURL(qrActual);
        res.send(`<html><body style="background:#000;color:white;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;text-align:center;">
            <h1 style="color:#25D366;font-size:30px;">📱 ESCANEA EL QR SATEX</h1>
            <div style="background:white;padding:20px;border-radius:15px;box-shadow: 0 0 20px #25D366;">
                <img src="${qrImagen}" style="width:300px;height:300px;"/>
            </div>
            <p style="margin-top:20px;color:#888;">Si el código no cambia en 30 segundos, presiona F5.</p>
        </body></html>`);
    } else {
        res.send('<html><body style="background:#000;color:white;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;"><h2>🔄 Generando QR... Espera 10 segundos y refresca la página.</h2></body></html>');
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log('🚀 SERVIDOR WEB SATEX LISTO');
    iniciarWhatsApp();
});

async function iniciarWhatsApp() {
    // Usamos una carpeta de sesión nueva para evitar choques
    const { state, saveCreds } = await useMultiFileAuthState('sesion_emergencia_satex');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ['Satex System', 'Chrome', '1.0.0'],
        printQRInTerminal: false
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            qrActual = qr;
            console.log('✅ QR GENERADO EXITOSAMENTE');
        }

        if (connection === 'close') {
            qrActual = null;
            const codigoError = lastDisconnect?.error?.output?.statusCode;
            const reintentar = codigoError !== DisconnectReason.loggedOut;
            
            console.log(`🔄 Conexión cerrada (Motivo: ${codigoError}). Reintentando...`);
            if (reintentar) {
                // Espera de 5 segundos para que Render mate instancias viejas
                setTimeout(() => iniciarWhatsApp(), 5000);
            }
        } else if (connection === 'open') {
            qrActual = null;
            console.log('✅ BOT SATEX CONECTADO Y ONLINE');
        }
    });
}
