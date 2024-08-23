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

    try {
        console.log(`Received request for cod_emp: ${cod_emp}`); 

        const pool = await getConnection();
        const result = await pool.request()
            .input('cod_emp', sql.Int, parseInt(cod_emp, 10))
            .query(`
                SELECT *
                FROM [INTRANET_SEGALTA].[dbo].[VRECIBOS_LISTA]
                WHERE cod_emp = @cod_emp;
            `);
                // [reci_num], [cod_emp], [AÑIO], [Mes], [Contrato]
        console.log(`Query result: ${JSON.stringify(result.recordset)}`);

        
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
router.get('/recibo/:reci_num', async (req, res) => {
    const { reci_num } = req.params;

    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input('Reci_Num', sql.Int, parseInt(reci_num, 10))
            .execute('RepReciboPago');

        const data = result.recordset;
        console.log(`Query result: ${JSON.stringify(data)}`);
        res.json(data);
    } catch (error) {
        console.error('ERROR: ' + JSON.stringify(error));
        res.status(500).json({ success: false, message: 'Failed to fetch data', error: error });
    }
});



// Configuración del transporte de nodemailer
const transporter = nodemailer.createTransport({
    host: 'smtp-relay.gmail.com',
    port: 587,
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

        // Comprimir el archivo PDF
        const compressedPdfBuffer = zlib.gzipSync(pdfBuffer);
        console.log(`Correo del empleado: ${correo_e}`);
        // Configuración del correo
        const mailOptions = {
            from: 'IntranetSegurosAltamira@proseguros.com.ve',
            to: "assalas.19@est.ucab.edu.ve",/* correo_e, */
            subject: `RECIBO DE PAGO ${reci_num}`,
            text: 'Recibo de Pago',
            attachments: [
                {
                    filename: `Recibo_de_Pago_${reci_num}.pdf.gz`,
                    content: compressedPdfBuffer,
                    contentType: 'application/gzip'
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

        // Comprimir el archivo PDF
        const compressedPdfBuffer = zlib.gzipSync(pdfBuffer);

        // Configuración del correo
        const mailOptions = {
            from: 'IntranetSegurosAltamira@proseguros.com.ve',
            to: correo_secundario,
            subject: `RECIBO DE PAGO ${reci_num}`,
            text: 'Recibo de Pago',
            attachments: [
                {
                    filename: `Recibo_de_Pago_${reci_num}.pdf.gz`,
                    content: compressedPdfBuffer,
                    contentType: 'application/gzip'
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

// Ruta para enviar un correo de prueba
router.post('/send-test-email', async (req, res) => {
    // Configuración del correo
    const mailOptions = {
        from: 'IntranetSegurosAltamira@proseguros.com.ve',
        to: 'assalas.19@est.ucab.edu.ve',
        subject: 'Correo de Prueba',
        text: 'Este es un correo de prueba para verificar la configuración de nodemailer.'
    };

    // Enviar el correo con reintentos
    const resultMail = await sendMailWithRetry(mailOptions);

    if (resultMail.success) {
        res.json({ success: true, message: 'Correo enviado', info: resultMail.info });
    } else {
        res.status(500).json({ success: false, message: 'Error enviando el correo', error: resultMail.error });
    }
});


export default router;