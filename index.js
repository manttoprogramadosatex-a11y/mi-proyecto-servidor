const { default: makeWASocket, useMemoryAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode');
const express = require('express');
const pino = require('pino');

const app = express();
const port = process.env.PORT || 10000;
let qrActual = null;

app.get('/', async (req, res) => {
    if (qrActual) {
        const qrImagen = await qrcode.toDataURL(qrActual);
        res.send(`
            <html>
            <body style="background:#000; color:white; display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; font-family:sans-serif;">
                <h1 style="color:#25D366;">¡ESCANEAME AHORA!</h1>
                <div style="background:white; padding:20px; border-radius:15px;">
                    <img src="${qrImagen}" style="width:300px; height:300px;"/>
                </div>
                <p style="margin-top:20px;">Refresca (F5) si el código no carga.</p>
            </body>
            </html>
        `);
    } else {
        res.send('<html><body style="background:#000; color:white; display:flex; align-items:center; justify-content:center; height:100vh;"><h2>🔄 Generando código... Refresca en 5 segundos.</h2></body></html>');
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log('SERVIDOR ONLINE');
    iniciarWhatsApp();
});

async function iniciarWhatsApp() {
    // Cambiamos a memoria para evitar bloqueos de archivos en Render
    const { state, saveCreds } = useMemoryAuthState();
    
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ['Satex System', 'Chrome', '1.0.0']
    });

    sock.ev.on('connection.update', (u) => {
        if (u.qr) {
            qrActual = u.qr;
            console.log('✅ QR LISTO');
        }
        if (u.connection === 'open') {
            qrActual = null;
            console.log('✅ CONECTADO');
        }
        if (u.connection === 'close') {
            console.log('🔄 Reintentando...');
            iniciarWhatsApp();
        }
    });
    
    sock.ev.on('creds.update', saveCreds);
}
