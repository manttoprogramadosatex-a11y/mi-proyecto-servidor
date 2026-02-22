const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode');
const express = require('express');
const pino = require('pino');

const app = express();
const port = process.env.PORT || 10000;
let ultimoQR = null;

// RUTA PARA VER EL QR EN EL NAVEGADOR
app.get('/', async (req, res) => {
    if (ultimoQR) {
        const qrImagen = await qrcode.toDataURL(ultimoQR);
        res.send(`<html><body style="background:#121212; color:white; display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; font-family:sans-serif;">
            <h1 style="color:#25D366;">📱 ESCANEA EL QR AHORA</h1>
            <div style="background:white; padding:20px; border-radius:15px; box-shadow: 0 0 20px rgba(37,211,102,0.5);">
                <img src="${qrImagen}" style="width:300px; height:300px;"/>
            </div>
            <p style="margin-top:20px; color:#888;">Si el código no carga, refresca (F5).</p>
        </body></html>`);
    } else {
        res.send('<html><body style="background:#121212; color:white; display:flex; align-items:center; justify-content:center; height:100vh; font-family:sans-serif;"><h2>🔄 Generando QR limpio... Espera 10 segundos y refresca la página (F5).</h2></body></html>');
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log('--- SERVIDOR WEB SATEX ACTIVO ---');
    iniciarWhatsApp();
});

async function iniciarWhatsApp() {
    // CAMBIO DE NOMBRE DE SESIÓN: Esto borra el bucle de reconexión
    const { state, saveCreds } = await useMultiFileAuthState('sesion_limpia_total_v2');
    
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ['Satex System', 'Chrome', '1.0.0']
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            ultimoQR = qr;
            console.log('✅ CÓDIGO QR GENERADO');
        }

        if (connection === 'close') {
            ultimoQR = null;
            const error = lastDisconnect?.error?.output?.statusCode;
            if (error !== DisconnectReason.loggedOut) {
                console.log('🔄 Reintentando conexión...');
                setTimeout(() => iniciarWhatsApp(), 3000);
            }
        } else if (connection === 'open') {
            ultimoQR = null;
            console.log('✅ BOT CONECTADO EXITOSAMENTE');
        }
    });
}
