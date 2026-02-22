const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode');
const express = require('express');
const pino = require('pino');

const app = express();
const port = process.env.PORT || 10000;
let qrActual = null;

app.get('/', async (req, res) => {
    if (qrActual) {
        const img = await qrcode.toDataURL(qrActual);
        res.send(`<html><body style="background:#000;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;">
            <h1>ESCANEAME AHORA</h1>
            <img src="${img}" style="border:10px solid white; width:300px;"/>
            <p>Si no funciona, refresca la página (F5)</p>
        </body></html>`);
    } else {
        res.send('<html><body style="background:#000;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;"><h2>Cargando motor... Refresca en 5 segundos</h2></body></html>');
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log("SERVIDOR LISTO");
    iniciar();
});

async function iniciar() {
    // CAMBIO DE NOMBRE DE SESION PARA BORRAR EL BUCLE
    const { state, saveCreds } = await useMultiFileAuthState('sesion_final_total');
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ['Satex', 'Chrome', '1.0.0']
    });

    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('connection.update', (u) => {
        if (u.qr) qrActual = u.qr;
        if (u.connection === 'open') qrActual = null;
        if (u.connection === 'close') {
            const motive = u.lastDisconnect?.error?.output?.statusCode;
            if (motive !== DisconnectReason.loggedOut) iniciar();
        }
    });
}
