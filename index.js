onst { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const axios = require('axios');

// Pega aquí la URL que obtuviste en el Paso 2 de Google Apps Script
const APPS_SCRIPT_URL = 'ESCRIBE_AQUI_TU_URL_DE_APPS_SCRIPT';

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

client.on('ready', () => {
    console.log('✅ Bot Satex vinculado correctamente');
});

client.on('message', async msg => {
    if (!msg.body.includes('.')) return;
    const partes = msg.body.split('.');
    const comando = partes[0].trim().toLowerCase();

    if (comando === 'abrir') {
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
            msg.reply(`🛠️ *ORDEN REGISTRADA*\nID: *${idOT}*\nEstatus: Abierta`);
        } catch (error) {
            console.error('Error al enviar a Google:', error);
        }
    }
});

client.initialize();
