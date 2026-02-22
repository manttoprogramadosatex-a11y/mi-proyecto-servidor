const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode');
const express = require('express');
const pino = require('pino');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 10000;
let qrActual = null;

// URL DE TU SCRIPT DE GOOGLE (PEGA LA TUYA AQUÍ)
const URL_SHEETS = 'TU_URL_DE_GOOGLE_SHEETS_AQUI';

app.get('/', async (req, res) => {
    if (qrActual) {
        const qrImagen = await qrcode.toDataURL(qrActual);
        res.send(`<html><body style="background:#000;color:white;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;text-align:center;">
            <h1 style="color:#25D366;font-size:30px;">📱 BOT SATEX: LISTO PARA ESCANEAR</h1>
            <div style="background:white;padding:20px;border-radius:15px;box-shadow: 0 0 20px #25D366;">
                <img src="${qrImagen}" style="width:300px;height:300px;"/>
            </div>
            <p style="margin-top:20px;color:#888;">Si ya vinculaste y no responde, cierra sesión en el móvil y escanea de nuevo.</p>
        </body></html>`);
    } else {
        res.send('<html><body style="background:#000;color:white;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;"><h2>🔄 Verificando sesión... Refresca en 10 segundos.</h2></body></html>');
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log('🚀 SERVIDOR WEB SATEX ONLINE');
    iniciarWhatsApp();
});

async function iniciarWhatsApp() {
    // Usamos una carpeta de sesión específica para Render
    const { state, saveCreds } = await useMultiFileAuthState('sesion_estable_satex');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ['Satex System', 'Chrome', '1.0.0']
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            qrActual = qr;
            console.log('✅ QR GENERADO');
        }

        if (connection === 'close') {
            qrActual = null;
            const codigoError = lastDisconnect?.error?.output?.statusCode;
            console.log(`🔄 Conexión cerrada (${codigoError}). Reconectando en 15s...`);
            
            // Si la sesión fue cerrada manualmente desde el móvil
            if (codigoError === DisconnectReason.loggedOut) {
                console.log('❌ Sesión cerrada en el móvil. Generando nuevo QR...');
            }
            
            setTimeout(() => iniciarWhatsApp(), 15000);
        } else if (connection === 'open') {
            qrActual = null;
            console.log('✅✅ BOT CONECTADO EXITOSAMENTE ✅✅');
        }
    });

    // ESCUCHAR MENSAJES PARA PRUEBAS
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const texto = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").toLowerCase();
        const jid = msg.key.remoteJid;

        if (texto.startsWith('abrir.')) {
            const partes = texto.split('.');
            const idOT = "OT-" + Math.floor(1000 + Math.random() * 9000);
            
            try {
                // Enviar a Google Sheets
                await axios.post(URL_SHEETS, {
                    idOT,
                    maquina: partes[1] || 'N/A',
                    noMq: partes[2] || 'N/A',
                    falla: partes[3] || 'N/A',
                    telefono: jid.split('@')[0]
                });
                
                await sock.sendMessage(jid, { text: `🛠️ *OT GENERADA:* ${idOT}\n✅ Datos guardados en Satex System.` });
            } catch (e) {
                await sock.sendMessage(jid, { text: `❌ Error al guardar en Sheets. Revisa la URL.` });
            }
        }
    });
}
