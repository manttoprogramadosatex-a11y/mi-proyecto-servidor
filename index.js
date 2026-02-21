const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
const express = require('express'); 

const app = express();
const port = process.env.PORT || 3000;

// URL de tu implementación de Google Apps Script 
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwO-g-OjU2-cpYkXEHFDox1Mvp4omaFysqvQaK2p01BGcmdio4IHya8TNqNBrO2XH65/exec';

// Mantener el servidor vivo para Render
app.get('/', (req, res) => res.send('Bot Satex Vivo'));
app.listen(port, () => console.log(`Servidor en puerto ${port}`));

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { 
        executablePath: '/usr/bin/google-chrome-stable',
        args: ['--no-sandbox', '--disable-setuid-sandbox'] 
    }
});

client.on('qr', qr => {
    qrcode.generate(qr, {small: true});
    console.log('ESCANEA EL QR ABAJO:');
});

client.on('ready', () => console.log('✅ Bot Satex Vinculado!'));

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
        } catch (e) { console.error('Error:', e); }
    }
});

client.initialize();
