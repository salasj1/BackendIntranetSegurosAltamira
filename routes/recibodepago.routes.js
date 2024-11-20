import express from 'express';
import { getConnection, sql } from '../database/connection.js';
import nodemailer from 'nodemailer';
import multer from 'multer'; 
import zlib from 'zlib';
const router = express.Router();
const upload = multer(); // Middleware para manejar archivos

//Se obtienen la lista de recibos de pago de un empleado
router.get('/recibos/:cod_emp', async (req, res) => {
    const { cod_emp } = req.params;
    
    console.log(`Request GET received for recibos: cod_emp=${cod_emp}`);
    try {
        
        const pool = await getConnection();
        const result = await pool.request()
            .input('cod_emp', sql.VarChar, cod_emp)
            .query(`
            SELECT *
            FROM [INTRANET_SEGALTA].[dbo].[VRECIBOS_LISTA]
            WHERE cod_emp = @cod_emp;
            `);
                // [reci_num], [cod_emp], [AÑIO], [Mes], [Contrato]

        
        const normalizedData = result.recordset.map(record => ({
            reci_num: record.reci_num,
            cod_emp: record.cod_emp.trim(),
            AÑIO: record.AÑIO,
            Mes: record.Mes.trim(),
            Contrato: record.Contrato
        }));

        res.json(normalizedData);
    } catch (error) {
        console.error('ERROR: ' + JSON.stringify(error));
        res.status(500).json({ success: false, message: 'Failed to fetch data', error: error });
    }
});

//Se obtiene el detalle de un recibo de pago
router.get('/recibo/:reci_num/:cod_emp', async (req, res) => {
    const { reci_num , cod_emp} = req.params;
    

    console.log(`Request GET received for recibo: reci_num=${reci_num}, cod_emp=${cod_emp}`);
    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input('Reci_Num', sql.Int, parseInt(reci_num, 10))
            .input('cod_emp', sql.VarChar, cod_emp)
            .execute('RepReciboPago');

        const data = result.recordset;
        
        res.json(data);
    } catch (error) {
        console.error('ERROR: ' + JSON.stringify(error));
        res.status(500).json({ success: false, message: 'Failed to fetch data', error: error });
    }
});



// Configuración del transporte de nodemailer
const transporter = nodemailer.createTransport({
    host: '192.168.0.206',
    port: 25,
    secure: false, // true para 465, false para otros puertos
    tls: {
        rejectUnauthorized: false
    },
    logger: true,
    debug: true
});

// Función para enviar correo con reintentos
const sendMailWithRetry = async (mailOptions, retries = 3) => {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const info = await transporter.sendMail(mailOptions);
            return { success: true, info };
        } catch (error) {
            console.error(`Error enviando el correo (intento ${attempt}):`, error);
            if (attempt === retries) {
                return { success: false, error };
            }
        }
    }
};

// Ruta para enviar el recibo de pago por correo
router.post('/send-recibo', upload.single('pdf'), async (req, res) => {
    const { reci_num, cod_emp } = req.body;
    const pdfBuffer = req.file.buffer;

    console.log(`Request POST received to send recibo: reci_num=${reci_num}, cod_emp=${cod_emp}`);
    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input('cod_emp', sql.NVarChar, cod_emp)
            .query(`
                SELECT correo_e
                FROM VSNEMPLE
                WHERE cod_emp = @cod_emp;
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({ success: false, message: 'Empleado no encontrado' });
        }

        const { correo_e } = result.recordset[0];

        // Configuración del correo
        const mailOptions = {
            from: 'IntranetSegurosAltamira@proseguros.com.ve',
            to: correo_e ,
            subject: `RECIBO DE PAGO ${reci_num}`,
            text: `Estimado,\nAdjunto encontrarás el PDF del recibo Nº${reci_num} del empleado con código ${cod_emp}.\nSaludos.`,
            attachments: [
                {
                    filename: `Recibo_de_Pago_${reci_num}.pdf`,
                    content: pdfBuffer,
                    contentType: 'application/pdf'
                }
            ]
        };

        // Enviar el correo con reintentos
        const resultMail = await sendMailWithRetry(mailOptions);

        if (resultMail.success) {
            res.json({ success: true, message: 'Correo enviado', info: resultMail.info });
        } else {
            res.status(500).json({ success: false, message: 'Error enviando el correo', error: resultMail.error });
        }
    } catch (error) {
        console.error('ERROR: ' + JSON.stringify(error));
        res.status(500).json({ success: false, message: 'Error enviando el correo', error });
    }
});

// Ruta para enviar el recibo de pago a un correo secundario
router.post('/send-recibo-secundario', upload.single('pdf'), async (req, res) => {
    const { reci_num, cod_emp, correo_secundario } = req.body;
    const pdfBuffer = req.file.buffer;

    console.log(`Request POST received to send recibo to secondary email: reci_num=${reci_num}, cod_emp=${cod_emp}, correo_secundario=${correo_secundario}`);
    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input('cod_emp', sql.NVarChar, cod_emp)
            .query(`
                SELECT correo_e
                FROM VSNEMPLE
                WHERE cod_emp = @cod_emp;
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({ success: false, message: 'Empleado no encontrado' });
        }

        // Configuración del correo
        const mailOptions = {
            from: 'IntranetSegurosAltamira@proseguros.com.ve',
            to: correo_secundario,
            subject: `RECIBO DE PAGO ${reci_num}`,
            text: `Estimado,\n\nAdjunto encontrarás el PDF del recibo Nº${reci_num} del empleado con código ${cod_emp}.\n\nSaludos.`,
            attachments: [
            {
                filename: `Recibo_de_Pago_${reci_num}.pdf`,
                content: pdfBuffer,
                contentType: 'application/pdf'
            }
            ]
        };

        // Enviar el correo con reintentos
        const resultMail = await sendMailWithRetry(mailOptions);

        if (resultMail.success) {
            res.json({ success: true, message: 'Correo enviado', info: resultMail.info });
        } else {
            res.status(500).json({ success: false, message: 'Error enviando el correo', error: resultMail.error });
        }
    } catch (error) {
        console.error('ERROR: ' + JSON.stringify(error));
        res.status(500).json({ success: false, message: 'Error enviando el correo', error });
    }
});




export default router;