const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode');
const express = require('express');
const pino = require('pino');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 10000;
const URL_SHEETS = 'https://script.google.com/macros/s/AKfycbwO-g-OjU2-cpYkXEHFDoX1Mvp4omaFysqvQaK2p01BGcmdio4Ihya8TNqNBrO2XH65/exec';

let qrActual = null;

// RUTA PARA VER EL QR EN EL NAVEGADOR
app.get('/', async (req, res) => {
    if (qrActual) {
        try {
            const qrImagen = await qrcode.toDataURL(qrActual);
            res.send(`
                <html>
                <body style="background:#121212; color:white; display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; font-family:sans-serif; text-align:center;">
                    <h1 style="color:#25D366; font-size:40px; margin-bottom:10px;">📱 ESCANEA EL QR</h1>
                    <p style="margin-bottom:20px; font-size:18px;">Abre WhatsApp > Dispositivos vinculados > Vincular dispositivo</p>
                    <div style="background:white; padding:20px; border-radius:20px; box-shadow: 0 0 30px rgba(37,211,102,0.4);">
                        <img src="${qrImagen}" style="width:300px; height:300px;"/>
                    </div>
                    <p style="margin-top:20px; color:#888;">Si el código no carga, refresca la página (F5).</p>
                </body>
                </html>
            `);
        } catch (e) { res.send("Error al generar imagen QR"); }
    } else {
        res.send('<html><body style="background:#121212; color:white; display:flex; align-items:center; justify-content:center; height:100vh; font-family:sans-serif;"><h2>🔄 Sincronizando motor... Espera 10 segundos y refresca la página (F5).</h2></body></html>');
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log('--- SERVIDOR SATEX ONLINE ---');
    iniciarWhatsApp();
});

async function iniciarWhatsApp() {
    // Usamos un nombre de sesión nuevo para evitar el bucle de "Reconectando"
    const { state, saveCreds } = await useMultiFileAuthState('sesion_reset_total');
    
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ['Satex System', 'Chrome', '1.0.0']
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            qrActual = qr;
            console.log('✅ QR listo para escanear.');
        }

        if (connection === 'close') {
            qrActual = null;
            const debeReconectar = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (debeReconectar) {
                console.log('🔄 Reconexión en curso...');
                setTimeout(() => iniciarWhatsApp(), 5000);
            }
        } else if (connection === 'open') {
            qrActual = null;
            console.log('✅ BOT SATEX CONECTADO EXITOSAMENTE');
        }
    });

    // Lógica para procesar las OTs
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;
        const texto = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
        
        if (texto.toLowerCase().startsWith('abrir.')) {
            const partes = texto.split('.');
            const idOT = "OT-" + Math.floor(1000 + Math.random() * 9000);
            try {
                await axios.post(URL_SHEETS, {
                    idOT, maquina: partes[1], noMq: partes[2], falla: partes[3], 
                    telefono: msg.key.remoteJid.split('@')[0]
                });
                await sock.sendMessage(msg.key.remoteJid, { text: `🛠️ *OT GENERADA:* ${idOT}\n\nGracias por reportar.` });
            } catch (e) { console.log('Error en Sheets:', e.message); }
        }
    });
}
