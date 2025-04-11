import nodemailer from 'nodemailer';
import { format } from 'date-fns-tz';
// Configuración del transportador de nodemailer
const transporter = nodemailer.createTransport({
    host: 'smtp-relay.gmail.com',
    port: 587,
    secure: false, 
    tls: {
        rejectUnauthorized: false
    },
    logger: false,
    debug: false
});

// Función para enviar correo con reintentos y retraso exponencial
export const sendMailWithRetry = async (mailOptions, retries = 5, delay = 3000) => {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            let info = await transporter.sendMail(mailOptions);

            // Obtener la fecha en la zona horaria de Venezuela
            const fechaVenezuela = format(new Date(), "yyyy-MM-dd'T'HH:mm:ss", { timeZone: 'America/Caracas' });

            return { success: true, info, fecha: fechaVenezuela };
        } catch (error) {
            const fechaVenezuela = format(new Date(), "yyyy-MM-dd'T'HH:mm:ss", { timeZone: 'America/Caracas' });
            console.error(`Attempt ${attempt} failed:`, error);
            if (attempt < retries) {
                await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, attempt - 1)));
            } else {
                return { success: false, error, fecha: fechaVenezuela };
            }
        }
    }
};