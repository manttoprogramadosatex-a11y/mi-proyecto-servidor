const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode');
const express = require('express');
const pino = require('pino');

const app = express();
const port = process.env.PORT || 10000;
let qrActual = null;

app.get('/', async (req, res) => {
    if (qrActual) {
        const qrImagen = await qrcode.toDataURL(qrActual);
        res.send(`<html><body style="background:#000;color:white;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;">
            <h1 style="color:#25D366;">📱 ESCANEA EL QR AHORA</h1>
            <div style="background:white;padding:20px;border-radius:15px;"><img src="${qrImagen}" style="width:300px;height:300px;"/></div>
            <p style="margin-top:20px;color:#888;">Si no carga, refresca (F5).</p>
        </body></html>`);
    } else {
        res.send('<html><body style="background:#000;color:white;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;text-align:center;"><h2>🔄 Sincronizando motor...<br>Refresca en 10 segundos.</h2></body></html>');
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log('--- SERVIDOR SATEX ACTIVO ---');
    iniciarWhatsApp();
});

async function iniciarWhatsApp() {
    // Usamos un nombre de sesión único para forzar la salida del bucle
    const { state, saveCreds } = await useMultiFileAuthState('sesion_final_satex_v3');
    
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ['Satex System', 'Chrome', '1.0.0']
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (u) => {
        const { connection, lastDisconnect, qr } = u;
        if (qr) {
            qrActual = qr;
            console.log('✅ NUEVO QR GENERADO');
        }
        if (connection === 'open') {
            qrActual = null;
            console.log('✅ BOT CONECTADO');
        }
        if (connection === 'close') {
            qrActual = null;
            const reintentar = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (reintentar) {
                console.log('🔄 Reintentando en 10 segundos para evitar choque...');
                setTimeout(() => iniciarWhatsApp(), 10000); // Espera más larga para estabilizar
            }
        }
    });
}
