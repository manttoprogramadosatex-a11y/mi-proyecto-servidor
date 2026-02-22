const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode');
const express = require('express');
const pino = require('pino');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 10000;
let qrActual = null;

// URL
const URL_SHEETS = 'https://script.google.com/macros/s/AKfycbzV4y8eeTI4U7CUjKveRJy8B6eNuRqr3vHyavywTOAj4GKV3OClQ348EQfTUR5fnCnb/exec';

// Función para poner Mayúscula Inicial en cada palabra
const capitalizar = (texto) => {
    if (!texto) return "N/A";
    return texto.trim().toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase());
};

app.get('/', async (req, res) => {
    if (qrActual) {
        const qrImagen = await qrcode.toDataURL(qrActual);
        res.send(`<html><body style="background:#000;color:white;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;text-align:center;">
            <h1 style="color:#25D366;font-size:30px;">📱 BOT SATEX: PANEL DE CONTROL</h1>
            <div style="background:white;padding:20px;border-radius:15px;box-shadow: 0 0 20px #25D366;">
                <img src="${qrImagen}" style="width:300px;height:300px;"/>
            </div>
            <p style="margin-top:20px;color:#888;">Escanea el código para activar el sistema.</p>
        </body></html>`);
    } else {
        res.send('<html><body style="background:#000;color:white;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;text-align:center;"><h2>🔄 Verificando sesión...<br>Si no aparece el QR, refresca en 10 segundos (F5).</h2></body></html>');
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log('🚀 SERVIDOR WEB SATEX ONLINE');
    iniciarWhatsApp();
});

async function iniciarWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('sesion_satex_final');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ['Satex System', 'Chrome', '1.0.0']
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            qrActual = qr;
            console.log('✅ NUEVO QR GENERADO');
        }

        if (connection === 'close') {
            qrActual = null;
            const error = lastDisconnect?.error?.output?.statusCode;
            console.log(`🔄 Conexión cerrada (${error}). Reconectando en 15s...`);
            setTimeout(() => iniciarWhatsApp(), 15000);
        } else if (connection === 'open') {
            qrActual = null;
            console.log('✅✅ BOT CONECTADO Y OPERATIVO ✅✅');
        }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        // Procesa el texto sin importar mayúsculas/minúsculas
        const textoOriginal = (msg.message.conversation || msg.message.extendedTextMessage?.text || "");
        const textoParaProcesar = textoOriginal.toLowerCase().trim();
        const jid = msg.key.remoteJid;

        if (textoParaProcesar.startsWith('abrir.')) {
            const partes = textoOriginal.split('.');
            
            if (partes.length < 4) {
                return await sock.sendMessage(jid, { text: "⚠️ *Formato incompleto*\nUsa: abrir.maquina.numero.falla" });
            }

            const idOT = "OT-" + Math.floor(1000 + Math.random() * 9000);
            
            // Datos formateados: Primera letra Mayúscula para la hoja
            const datosParaEnviar = {
                idOT: idOT,
                maquina: capitalizar(partes[1]),
                noMq: partes[2].toUpperCase().trim(),
                falla: capitalizar(partes[3]),
                telefono: jid.split('@')[0]
            };

            try {
                await axios.post(URL_SHEETS, datosParaEnviar);
                
                await sock.sendMessage(jid, { 
                    text: `🛠️ *OT GENERADA:* ${idOT}\n\n` +
                          `📌 *Máquina:* ${datosParaEnviar.maquina}\n` +
                          `🔢 *No. Mq:* ${datosParaEnviar.noMq}\n` +
                          `⚠️ *Falla:* ${datosParaEnviar.falla}\n\n` +
                          `✅ *Satex System:* Reporte guardado con éxito.`
                });
                console.log(`✅ Reporte enviado a Google: ${idOT}`);
            } catch (e) {
                console.log("❌ Error en Sheets:", e.message);
                await sock.sendMessage(jid, { text: "❌ *Error:* No se pudo conectar con Google Sheets. Revisa la implementación del Script." });
            }
        }
    });
}
