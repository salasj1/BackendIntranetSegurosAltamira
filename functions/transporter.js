import nodemailer from 'nodemailer';
import { format } from 'date-fns-tz';
// Configuración del transportador de nodemailer
const transporter = nodemailer.createTransport({
    service: 'gmail',
    host: 'smtp-relay.gmail.com',
    port:  587 || 465,
    secure: true,
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASSWORD,
    },
    tls: {
        rejectUnauthorized: false
    },
    logger: false,
    debug: true
});

// Función para enviar correo con reintentos y retraso exponencial
export const sendMailWithRetry = async (mailOptions, retries = 5, delay = 5000) => {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            let info = await transporter.sendMail(mailOptions);

            // Obtener la fecha en la zona horaria de Venezuela
            const fechaVenezuela = format(new Date(), "yyyy-MM-dd'T'HH:mm:ss", { timeZone: 'America/Caracas' });

            return { success: true, info, fecha: fechaVenezuela };
        } catch (error) {
            const fechaVenezuela = format(new Date(), "yyyy-MM-dd'T'HH:mm:ss", { timeZone: 'America/Caracas' });
            console.error(`Intento ${attempt} fallido:`, error);

            console.error(`Intento ${attempt} fallido:`, error);

            // Registrar detalles del error
            console.error(`Código de error: ${error.code}`);
            console.error(`Respuesta del servidor: ${error.response}`);
            console.error(`Comando fallido: ${error.command}`);

            if (attempt < retries) {
                await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, attempt - 1)));
            } else {
                return { success: false, error, fecha: fechaVenezuela };
            }
        }
    }
};