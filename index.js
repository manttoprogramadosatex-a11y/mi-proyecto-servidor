const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode');
const express = require('express');
const pino = require('pino');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 10000;
let qrActual = null;

//
const URL_SHEETS = 'https://script.google.com/macros/s/AKfycbxXwwRb1VGyMrk0x_pKvRqf5xY7MjF-C2-CK4yGWm7R6F84TbvrqmfPzu0CiepulCe7/exec';

const capitalizar = (texto) => {
    if (!texto) return "N/A";
    return texto.trim().toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase());
};

app.get('/', async (req, res) => {
    if (qrActual) {
        const qrImagen = await qrcode.toDataURL(qrActual);
        res.send(`<html><body style="background:#000;color:white;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;text-align:center;">
            <h1 style="color:#25D366;font-size:30px;">📱 BOT SATEX: PANEL DE CONTROL</h1>
            <div style="background:white;padding:20px;border-radius:15px;"><img src="${qrImagen}" style="width:300px;height:300px;"/></div>
            <p style="margin-top:20px;color:#888;">Escanea para activar el sistema.</p>
        </body></html>`);
    } else {
        res.send('<html><body style="background:#000;color:white;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;"><h2>🔄 Verificando sesión...</h2></body></html>');
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log('🚀 SERVIDOR ONLINE');
    iniciarWhatsApp();
});

async function iniciarWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('sesion_final_satex');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ['Satex System', 'Chrome', '1.0.0']
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (u) => {
        if (u.qr) qrActual = u.qr;
        if (u.connection === 'open') { qrActual = null; console.log('✅✅ CONECTADO ✅✅'); }
        if (u.connection === 'close') setTimeout(() => iniciarWhatsApp(), 15000);
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const textoOriginal = (msg.message.conversation || msg.message.extendedTextMessage?.text || "");
        const textoParaProcesar = textoOriginal.toLowerCase().trim();
        const jid = msg.key.remoteJid;

        if (textoParaProcesar.startsWith('abrir.')) {
            const partes = textoOriginal.split('.');
            
            if (partes.length < 4) {
                return await sock.sendMessage(jid, { text: "⚠️ Formato incompleto: abrir.maquina.numero.falla" });
            }

            const idOT = "OT-" + Math.floor(1000 + Math.random() * 9000);
            const numeroTelefono = jid.split('@')[0]; // Extrae el número del que manda el mensaje

            const datos = {
                idOT: idOT,
                maquina: capitalizar(partes[1]),
                noMq: partes[2].trim(), // El "05"
                falla: capitalizar(partes[3]),
                telefono: numeroTelefono
            };

            try {
                await axios.post(URL_SHEETS, datos);
                await sock.sendMessage(jid, { 
                    text: `🛠️ *OT GENERADA:* ${idOT}\n\n✅ Datos guardados para: *${datos.maquina}*` 
                });
            } catch (e) {
                await sock.sendMessage(jid, { text: "❌ Error al conectar con Sheets." });
            }
        }
    });
}
