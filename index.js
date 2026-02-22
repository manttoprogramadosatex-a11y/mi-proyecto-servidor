const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
const express = require('express');

const app = express();
const port = process.env.PORT || 10000;

// URL de tu Google Apps Script (Gratis)
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwO-g-OjU2-cpYkXEHFDox1Mvp4omaFysqvQaK2p01BGcmdio4IHya8TNqNBrO2XH65/exec';

// Respuesta para que Render no apague el bot
app.get('/', (req, res) => res.send('Bot Satex Operativo'));
app.listen(port, '0.0.0.0', () => {
    console.log(`🚀 Servidor en puerto ${port}. Cargando WhatsApp...`);
});

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { 
        headless: "new",
        args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--single-process',
            '--no-zygote'
        ] 
    }
});

client.on('qr', qr => {
    console.log('--- NUEVO CÓDIGO QR ---');
    qrcode.generate(qr, {small: true});
    console.log('Escanea este código ahora en tu celular.');
});

client.on('ready', () => {
    console.log('✅ BOT VINCULADO Y LISTO');
});

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
            msg.reply(`🛠️ *ORDEN REGISTRADA:* ${idOT}`);
        } catch (e) {
            console.log('Error al enviar datos:', e.message);
        }
    }
});

client.initialize();
