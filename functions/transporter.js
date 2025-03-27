import nodemailer from 'nodemailer';

// Configuración del transportador de nodemailer
const transporter = nodemailer.createTransport({
    host: 'smtp-relay.gmail.com',
    port: 587,
    secure: false, 
    tls: {
        rejectUnauthorized: false
    },
    logger: true,
    debug: true
});

// Función para enviar correo con reintentos y retraso exponencial
export const sendMailWithRetry = async (mailOptions, retries = 10, delay = 3000) => {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            let info = await transporter.sendMail(mailOptions);
            return { success: true, info };
        } catch (error) {
            console.error(`Attempt ${attempt} failed:`, error);
            if (attempt < retries) {
                await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, attempt - 1)));
            } else {
                return { success: false, error };
            }
        }
    }
};