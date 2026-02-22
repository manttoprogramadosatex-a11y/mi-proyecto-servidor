const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
const express = require('express');

const app = express();
// Render usa el puerto 10000 por defecto
const port = process.env.PORT || 10000;

// 1. TU URL DE GOOGLE APPS SCRIPT
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwO-g-OjU2-cpYkXEHFDox1Mvp4omaFysqvQaK2p01BGcmdio4IHya8TNqNBrO2XH65/exec';

// 2. RESPUESTA INMEDIATA PARA RENDER (Evita el reinicio)
app.get('/', (req, res) => res.send('Bot Satex Activo'));
app.listen(port, '0.0.0.0', () => {
    console.log(`🚀 Servidor listo en puerto ${port}. Iniciando WhatsApp...`);
});

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { 
        headless: true,
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
    console.log('--- ¡ATENCIÓN! ESCANEA ESTE QR AHORA ---');
    qrcode.generate(qr, {small: true});
});

client.on('ready', () => {
    console.log('✅ BOT CONECTADO EXITOSAMENTE');
});

client.on('message', async msg => {
    // 3. FILTRO DE GRUPO ÚNICO
    // Solo responderá si el mensaje viene del grupo que tú decidas
    // O si contiene el comando exacto.
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
            console.log('Error:', e.message);
        }
    }
});

client.initialize();
