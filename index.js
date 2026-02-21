const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
const express = require('express');

const app = express();
const port = process.env.PORT || 3000;

// Aquí debes pegar la URL que obtuviste de Google Apps Script (el paso gratuito)
const APPS_SCRIPT_URL = 'TU_URL_DE_APPS_SCRIPT_AQUI';

app.get('/', (req, res) => res.send('Bot Satex Vivo'));
app.listen(port, () => console.log(`Servidor escuchando en puerto ${port}`));

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { 
        executablePath: '/usr/bin/google-chrome-stable',
        args: ['--no-sandbox', '--disable-setuid-sandbox'] 
    }
});

client.on('qr', qr => {
    qrcode.generate(qr, {small: true});
    console.log('ESCANEA EL QR QUE APARECE ABAJO:');
});

client.on('ready', () => console.log('✅ ¡Bot Satex Vinculado y Listo!'));

client.on('message', async msg => {
    if (!msg.body.includes('.')) return;
    const partes = msg.body.split('.');
    if (partes[0].trim().toLowerCase() === 'abrir') {
        const idOT = "OT-" + Math.floor(1000 + Math.random() * 9000);
        const datos = {
            idOT: idOT,
            fecha: new Date().toLocaleDateString('es-MX'),
            horaIso: new Date().toISOString(),
            maquina: partes[1]?.trim(),
            noMq: partes[2]?.trim(),
            falla: partes[3]?.trim(),
            telefono: msg.from.split('@')[0]
        };
        try {
            await axios.post(APPS_SCRIPT_URL, datos);
            msg.reply(`🛠️ *REGISTRO EXITOSO*\nID: *${idOT}*`);
        } catch (e) { console.error('Error al enviar datos:', e); }
    }
});

client.initialize();
