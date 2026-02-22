const axios = require('axios');
const URL_SHEETS = 'TU_URL_DE_APPS_SCRIPT'; // Asegúrate de actualizarla con la última implementación

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
            // Generamos el ID de WhatsApp para la notificación silenciosa
            const jidTecnico = res.telefonoTecnico + "@s.whatsapp.net";

            // MENSAJE FINAL: Solo con el Nombre del Mecánico
            const mensajeRespuesta = 
`🛠️ *OS GENERADA:* ${res.idOS}

📌 *Máquina:* ${capitalizar(partes[1])}
🔢 *No. Mq:* ${partes[2]}
⚠️ *Falla:* ${capitalizar(partes[3])}
#️⃣ *De falla actual en máquina:* ${partes[4]}
👤 *Nombre asignado:* ${res.nombreTecnico}

✅ *Satex System:* Reporte guardado con éxito.`;

            // Enviamos el mensaje. El técnico recibe notificación por 'mentions', 
            // pero su número ya no aparece escrito en el texto.
            await sock.sendMessage(jid, { 
                text: mensajeRespuesta, 
                mentions: [jidTecnico] 
            });

        } catch (e) {
            console.log("Error de conexión:", e.message);
        }
    }
}

module.exports = { procesarComando };
