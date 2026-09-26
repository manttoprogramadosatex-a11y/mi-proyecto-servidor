const {
    default: makeWASocket,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    DisconnectReason
} = require('@whiskeysockets/baileys');

const qrcode = require('qrcode');
const express = require('express');
const pino = require('pino');
const { procesarComando } = require('./tareas');

const app = express();
const port = process.env.PORT || 10000;

let qrActual = null;
let sockActual = null;

let conectado = false;

// ==========================================
// CONTROL DE PRESENCIA
// ==========================================
let intervaloPresencia = null;

// ==========================================
// CONTROL DE RECONEXIÓN
// ==========================================
let iniciando = false;
let reconexionProgramada = false;

// Identifica la conexión actualmente válida.
let generacionSocket = 0;

// ==========================================
// KEEP-ALIVE DE PRESENCIA
// ==========================================
function iniciarPresenciaOnline(
    miSocket,
    miGeneracion
) {

    if (intervaloPresencia) {
        clearInterval(intervaloPresencia);
        intervaloPresencia = null;
    }

    const publicarPresencia = async () => {

        try {

            // Comprobar que seguimos utilizando
            // exactamente el socket actual.
            if (
                sockActual !== miSocket ||
                generacionSocket !== miGeneracion ||
                !conectado ||
                !miSocket?.user
            ) {
                return;
            }

            await miSocket.sendPresenceUpdate(
                'available'
            );

        } catch (err) {

            console.log(
                '⚠️ Error actualizando presencia:',
                err.message
            );
        }
    };

    // Publicar inmediatamente.
    void publicarPresencia();

    // Renovar antes de que expire.
    intervaloPresencia = setInterval(
        publicarPresencia,
        5000
    );
}

// ==========================================
// DETENER PRESENCIA
// ==========================================
function detenerPresencia() {

    if (intervaloPresencia) {

        clearInterval(
            intervaloPresencia
        );

        intervaloPresencia = null;
    }
}

// ==========================================
// RECONEXIÓN CONTROLADA
// ==========================================
function programarReconexion() {

    if (reconexionProgramada) {
        return;
    }

    reconexionProgramada = true;

    console.log(
        '🔄 Reconexión programada en 5 segundos...'
    );

    setTimeout(
        async () => {

            reconexionProgramada = false;

            try {

                await iniciarWhatsApp();

            } catch (err) {

                console.log(
                    '❌ Error durante reconexión:',
                    err.message
                );
            }

        },
        5000
    );
}

// ==========================================
// INICIALIZACIÓN DE WHATSAPP
// ==========================================
async function iniciarWhatsApp() {

    if (iniciando) {
        return;
    }

    iniciando = true;

    const miGeneracion =
        ++generacionSocket;

    try {

        conectado = false;

        detenerPresencia();

        // ==========================================
        // CERRAR SOCKET ANTERIOR
        // ==========================================
        if (sockActual) {

            try {
                sockActual.ev.removeAllListeners();
            } catch {}

            try {
                sockActual.ws?.close();
            } catch {}

            sockActual = null;
        }

        // ==========================================
        // VERSIÓN DE WHATSAPP
        // ==========================================
        const {
            version
        } =
            await fetchLatestBaileysVersion();

        // ==========================================
        // SESIÓN
        // ==========================================
        const {
            state,
            saveCreds
        } =
            await useMultiFileAuthState(
                './sesion_satex'
            );

        // ==========================================
        // CREAR SOCKET
        // ==========================================
        const nuevoSocket =
            makeWASocket({

                version,

                auth: {
                    creds:
                        state.creds,

                    keys:
                        makeCacheableSignalKeyStore(
                            state.keys,
                            pino({
                                level: 'silent'
                            })
                        )
                },

                logger:
                    pino({
                        level: 'silent'
                    }),

                browser: [
                    'Satex System',
                    'Chrome',
                    '1.0.0'
                ],

                // ==================================
                // MARCAR COMO EN LÍNEA AL CONECTAR
                // ==================================
                markOnlineOnConnect:
                    true,

                // ==================================
                // KEEP-ALIVE DEL WEBSOCKET
                // ==================================
                keepAliveIntervalMs:
                    10000,

                // ==================================
                // MAYOR TOLERANCIA DE CONEXIÓN
                // ==================================
                connectTimeoutMs:
                    120000
            });

        sockActual =
            nuevoSocket;

        // ==========================================
        // GUARDAR CREDENCIALES
        // ==========================================
        nuevoSocket.ev.on(
            'creds.update',
            saveCreds
        );

        // ==========================================
        // ESTADO DE CONEXIÓN
        // ==========================================
        nuevoSocket.ev.on(
            'connection.update',
            (u) => {

                // Ignorar eventos pertenecientes
                // a una conexión vieja.
                if (
                    nuevoSocket !== sockActual ||
                    miGeneracion !== generacionSocket
                ) {
                    return;
                }

                const {
                    connection,
                    lastDisconnect,
                    qr
                } = u;

                // ==================================
                // QR
                // ==================================
                if (qr) {

                    qrActual =
                        qr;

                    console.log(
                        '📲 QR disponible'
                    );
                }

                // ==================================
                // CONECTADO
                // ==================================
                if (
                    connection === 'open'
                ) {

                    conectado =
                        true;

                    qrActual =
                        null;

                    console.log(
                        '✅ BOT CONECTADO'
                    );

                    // Mantener presencia online.
                    iniciarPresenciaOnline(
                        nuevoSocket,
                        miGeneracion
                    );
                }

                // ==================================
                // DESCONECTADO
                // ==================================
                if (
                    connection === 'close'
                ) {

                    conectado =
                        false;

                    detenerPresencia();

                    if (
                        nuevoSocket === sockActual &&
                        miGeneracion === generacionSocket
                    ) {

                        sockActual =
                            null;
                    }

                    const status =
                        lastDisconnect
                            ?.error
                            ?.output
                            ?.statusCode;

                    console.log(
                        '❌ Conexión cerrada'
                    );

                    if (status) {

                        console.log(
                            '📌 Código de desconexión:',
                            status
                        );
                    }

                    // Mantener comportamiento original:
                    // reconectar salvo que WhatsApp
                    // haya cerrado la sesión definitivamente.
                    if (
                        status !==
                        DisconnectReason.loggedOut
                    ) {

                        programarReconexion();

                    } else {

                        console.log(
                            '🔒 La sesión fue cerrada por WhatsApp. Se requiere nueva vinculación.'
                        );
                    }
                }
            }
        );

        // ==========================================
        // RECEPCIÓN DE MENSAJES
        // ==========================================
        nuevoSocket.ev.on(
            'messages.upsert',
            async ({
                messages,
                type
            }) => {

                // Conservamos exactamente la
                // condición original.
                if (
                    type !== 'notify'
                ) {
                    return;
                }

                // Conservamos la lógica original:
                // trabajar con el primer mensaje.
                const msg =
                    messages[0];

                if (
                    !msg?.message ||
                    msg.key.fromMe
                ) {
                    return;
                }

                const texto =
                    (
                        msg.message.conversation ||
                        msg.message.extendedTextMessage?.text ||
                        ""
                    );

                await procesarComando(
                    texto,
                    msg.key.remoteJid,
                    nuevoSocket
                );
            }
        );

    } catch (err) {

        conectado =
            false;

        detenerPresencia();

        console.log(
            '❌ Error conexión:',
            err.message
        );

        programarReconexion();

    } finally {

        iniciando =
            false;
    }
}

// ==========================================
// RUTA KEEP-ALIVE
// ==========================================
app.get(
    '/keep-alive',
    (req, res) =>
        res.status(200).send(
            'Bot Awake 🚀'
        )
);

// ==========================================
// RUTA PRINCIPAL
// ==========================================
app.get(
    '/',
    async (req, res) => {

        if (qrActual) {

            const qrImagen =
                await qrcode.toDataURL(
                    qrActual
                );

            res.send(`
                <html>
                <body style="background:#000;color:white;text-align:center;padding-top:50px;">
                    <h1>VINCULACIÓN SATEX</h1>
                    <img src="${qrImagen}" style="width:300px;background:white;padding:10px;border-radius:10px;"/>
                </body>
                </html>
            `);

        } else {

            res.send(`
                <html>
                <body style="background:#000;color:white;text-align:center;padding-top:100px;">
                    <h2>✅ BOT CONECTADO</h2>
                </body>
                </html>
            `);
        }
    }
);

// ==========================================
// CIERRE LIMPIO
// ==========================================
async function cierreLimpio(
    signal
) {

    console.log(
        `🛑 ${signal} recibido. Cerrando conexión de WhatsApp...`
    );

    conectado =
        false;

    detenerPresencia();

    try {

        if (sockActual) {

            try {
                sockActual.ev.removeAllListeners();
            } catch {}

            try {
                sockActual.ws?.close();
            } catch {}
        }

    } catch {}

    sockActual =
        null;

    // Permitir un pequeño margen para
    // cerrar correctamente la conexión.
    setTimeout(
        () => {
            process.exit(0);
        },
        500
    );
}

process.once(
    'SIGTERM',
    () => cierreLimpio('SIGTERM')
);

process.once(
    'SIGINT',
    () => cierreLimpio('SIGINT')
);

// ==========================================
// START
// ==========================================
app.listen(
    port,
    '0.0.0.0',
    () => {

        console.log(
            '🚀 SERVIDOR SATEX INICIADO'
        );

        console.log(
            `🌐 Puerto: ${port}`
        );

        iniciarWhatsApp();
    }
);
