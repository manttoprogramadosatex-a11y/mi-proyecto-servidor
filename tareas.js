const axios = require('axios');

// URL de tu Script de Google (La que termina en /exec)
const URL_SHEETS = 'https://script.google.com/macros/s/AKfycbx6HOaHWXJCg6vISRLgPOeTnhy4YOz2atQr-jFMpEb9rX0earo1w3kLCeGaWaX6UJE/exec';

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

        const numId = Math.floor(1000 + Math.random() * 9000); 
        const numeroTel = jid.split('@')[0];
        const maquinaNom = capitalizar(partes[1]);
        const noMq = partes[2].trim();
        const fallaDesc = capitalizar(partes[3]);

        const datos = {
            idOS: numId,
            maquina: maquinaNom,
            noMq: noMq,
            falla: fallaDesc,
            telefono: numeroTel
        };

        try {
            // Enviar a Google Sheets
            await axios.post(URL_SHEETS, datos);

            // PRESENTACIÓN DEL DESPLIEGUE (Formato solicitado)
            const mensajeRespuesta = 
`🛠️ *OS GENERADA:* ${numId}

📌 *Máquina:* ${maquinaNom}
🔢 *No. Mq:* ${noMq}
⚠️ *Falla:* ${fallaDesc}
#️⃣ *De falla actual en máquina:* ${fallaDesc}

✅ *Satex System:* Reporte guardado con éxito.`;

            await sock.sendMessage(jid, { text: mensajeRespuesta });

        } catch (e) {
            console.log("Error en Sheets:", e.message);
            await sock.sendMessage(jid, { text: "❌ Error al guardar en Sheets.\nRevisa la URL." });
        }
    }
}

module.exports = { procesarComando };
