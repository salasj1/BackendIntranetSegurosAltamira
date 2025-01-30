import nodemailer from 'nodemailer';

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

// Función para enviar correo con reintentos
export const sendMailWithRetry = async (mailOptions, retries = 3) => {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            await transporter.sendMail(mailOptions);
            return { success: true };
        } catch (error) {
            console.error(`Attempt ${attempt} failed:`, error);
            if (attempt === retries) {
                return { success: false, error };
            }
        }
    }
};