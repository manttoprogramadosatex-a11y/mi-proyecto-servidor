const axios = require('axios');
const URL_SHEETS = 'TU_URL_DE_APPS_SCRIPT'; // Asegúrate de actualizarla

const capitalizar = (texto) => {
    if (!texto) return "N/A";
    return texto.trim().toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase());
};

async function procesarComando(textoOriginal, jid, sock) {
    const textoLwr = textoOriginal.toLowerCase().trim();

    if (textoLwr.startsWith('abrir.')) {
        const partes = textoOriginal.split('.');
        if (partes.length < 5) return;

        try {
            const respuesta = await axios.post(URL_SHEETS, {
                maquina: capitalizar(partes[1]),
                noMq: partes[2].trim(),
                falla: capitalizar(partes[3]),
                cantidad: partes[4].trim(),
                telefono: jid.split('@')[0]
            });

            const res = respuesta.data;
            const jidTecnico = res.telefonoTecnico + "@s.whatsapp.net";

            // MENSAJE CON NOMBRE EXTRAÍDO DE EXCEL
            const mensajeRespuesta = 
`🛠️ *OS GENERADA:* ${res.idOS}

📌 *Máquina:* ${capitalizar(partes[1])}
🔢 *No. Mq:* ${partes[2]}
⚠️ *Falla:* ${capitalizar(partes[3])}
#️⃣ *De falla actual en máquina:* ${partes[4]}
👤 *Asignado a:* ${res.nombreTecnico} (@${res.telefonoTecnico})

✅ *Satex System:* Reporte guardado con éxito.`;

            await sock.sendMessage(jid, { 
                text: mensajeRespuesta, 
                mentions: [jidTecnico] 
            });

        } catch (e) {
            console.log("Error:", e.message);
        }
    }
}

module.exports = { procesarComando };
