import express from 'express';
import { getConnection, sql } from '../database/connection.js';
import nodemailer from 'nodemailer';
import multer from 'multer'; 
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const router = express.Router();
const upload = multer(); // Middleware para manejar archivos


// Obtener el directorio actual utilizando import.meta.url
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
            WHERE cod_emp = @cod_emp
            ORDER BY AÑIO DESC, 
                 CASE 
                 WHEN Mes = 'Enero' THEN 1
                 WHEN Mes = 'Febrero' THEN 2
                 WHEN Mes = 'Marzo' THEN 3
                 WHEN Mes = 'Abril' THEN 4
                 WHEN Mes = 'Mayo' THEN 5
                 WHEN Mes = 'Junio' THEN 6
                 WHEN Mes = 'Julio' THEN 7
                 WHEN Mes = 'Agosto' THEN 8
                 WHEN Mes = 'Septiembre' THEN 9
                 WHEN Mes = 'Octubre' THEN 10
                 WHEN Mes = 'Noviembre' THEN 11
                 WHEN Mes = 'Diciembre' THEN 12
                 END DESC;
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
    logger: false,
    debug: false
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
            from: 'IntranetSegurosAltamira@segurosaltamira.com',
            to: correo_e ,
            subject: `RECIBO DE PAGO ${reci_num}`,
            text: `Estimado(a),\nAdjunto encontrarás el PDF del recibo Nº${reci_num} del empleado con código ${cod_emp}.\nSaludos.`,
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
    const { reci_num, cod_emp, correo_secundario, fecha } = req.body;
    const pdfBuffer = req.file.buffer;

    console.log(`Request POST received to send recibo to secondary email: reci_num=${reci_num}, cod_emp=${cod_emp}, correo_secundario=${correo_secundario}`);
    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input('cod_emp', sql.NVarChar, cod_emp)
            .query(`
                SELECT nombre_completo
                FROM VSNEMPLE
                WHERE cod_emp = @cod_emp;
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({ success: false, message: 'Empleado no encontrado' });
        }

        let nombre_empleado = result.recordset[0].nombre_completo.replace(/,/g, '');

        const cuerpo = await pool.request()
            .input('reci_num', sql.Int, reci_num)
            .input('cod_emp', sql.Char, cod_emp)
            .query('SELECT [dbo].[ftSACuerpoCorreoRecibo] (@reci_num, @cod_emp) AS cuerpo');
        
        cuerpo = cuerpo.recordset[0].cuerpo;
        
        // Leer el archivo correo_recibo.html
        const templatePath = path.join(__dirname, "../templates/correo_Recibo.html");
        let htmlContent = fs.readFileSync(templatePath, 'utf8');

        // Reemplazar los placeholders en el contenido HTML
        htmlContent = htmlContent.replace('${nombre_empleado}', nombre_empleado);
        htmlContent = htmlContent.replace('${cuerpo}',cuerpo);

        const mailOptions = {
            from: 'IntranetSegurosAltamira@segurosaltamira.com',
            to: correo_secundario,
            subject: `Adjunto de Recibo de Nomina ${fecha} ${nombre_empleado}`,
            html: htmlContent,
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