const axios = require('axios');

// URL de tu Script de Google (La que termina en /exec)
const URL_SHEETS = 'https://script.google.com/macros/s/AKfycbzV4y8eeTI4U7CUjKveRJy8B6eNuRqr3vHyavywTOAj4GKV3OClQ348EQfTUR5fnCnb/exec';

const capitalizar = (texto) => {
    if (!texto) return "N/A";
    return texto.trim().toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase());
};

async function procesarComando(textoOriginal, jid, sock) {
    const textoLwr = textoOriginal.toLowerCase().trim();

    // Comando para abrir Orden de Servicio
    if (textoLwr.startsWith('abrir.')) {
        const partes = textoOriginal.split('.');
        if (partes.length < 4) return;

        const numId = Math.floor(1000 + Math.random() * 9000); // ID numérico sin letras
        const numeroTel = jid.split('@')[0];

        const datos = {
            idOS: numId,
            maquina: capitalizar(partes[1]),
            noMq: partes[2].trim(),
            falla: capitalizar(partes[3]),
            telefono: numeroTel
        };

        try {
            await axios.post(URL_SHEETS, datos);
            await sock.sendMessage(jid, { 
                text: `🛠️ *OS GENERADA:* ${numId}\n\n✅ Reporte de servicio guardado correctamente.` 
            });
        } catch (e) {
            console.log("Error en Sheets:", e.message);
        }
    }
    // Puedes agregar más comandos aquí abajo sin afectar la conexión de WhatsApp
}

module.exports = { procesarComando };
