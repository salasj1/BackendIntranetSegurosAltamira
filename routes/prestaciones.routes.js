import express from 'express';
import multer from 'multer';
import nodemailer from 'nodemailer';
import { getConnection, sql } from '../database/connection.js'; 
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const router = express.Router();
const upload = multer();

// Obtener el directorio actual utilizando import.meta.url
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

router.get('/prestaciones/:cod_emp', async (req, res) => {
    let { cod_emp } = req.params;

    
    if (cod_emp === 'undefined') {
        cod_emp = '0';
    }
    console.log(`Request GET received for prestaciones: cod_emp=${cod_emp}`);
    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input('cod_emp', sql.VarChar, cod_emp) 
            .query(`
                SELECT *
                FROM [INTRANET_SEGALTA].[dbo].[VSAPrestacionesIntereses]
                WHERE cod_emp = @cod_emp;
            `);
        /* [cod_emp], [AÑO], [MES], [sueldo_mensual], [porcion_utilidad], 
        [porcion_vacacion], [sueldo_integral], [dias_antiguiedad], [antiguedad_mensual], 
        [Adelantos], [neto_prestaciones], [porc_interes], [interes]
        ,[nombre_completo],[fecha_ing] ,[des_depart] */
        res.json(result.recordset);
    } catch (error) {
        console.error('Error fetching prestaciones:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch data', error });
    }
});

// Configuración del transporte de nodemailer
const transporter = nodemailer.createTransport({
    host: '192.168.0.206',
    port: 25,
    secure: false, 
    tls: {
        rejectUnauthorized: false
    },
    logger: true,
    debug: true
});

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

router.post('/send-prestaciones', upload.single('pdf'), async (req, res) => {
    const { cod_emp } = req.body;
    const pdfBuffer = req.file.buffer;

    console.log(`Request received to send prestaciones email: cod_emp=${cod_emp}`);
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
        //const compressedPdfBuffer = zlib.gzipSync(pdfBuffer);
        const mailOptions = {
            from: 'IntranetSegurosAltamira@segurosaltamira.com',
            to:  correo_e, 
            subject: 'Movimientos de Prestaciones Sociales',
            text: `Adjunto encontrarás el PDF con los movimientos de prestaciones sociales del empleado con código ${cod_emp}.`,
            attachments: [
                {
                    filename: 'prestaciones.pdf',
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

router.post('/send-prestaciones-secundario', upload.single('pdf'), async (req, res) => {
    const { cod_emp, correo_secundario } = req.body;
    const pdfBuffer = req.file.buffer;
    if (!cod_emp){
        return res.status(400).json({ success: false, message: 'Código de empleado no proporcionado' });
    }
    console.log(`Request received to send prestaciones email to secondary email: cod_emp=${cod_emp}, correo_secundario=${correo_secundario}`);
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
        
        /* const cuerpo = await pool.request()
            .input('reci_num', sql.Int, reci_num)
            .input('cod_emp', sql.Char, cod_emp)
            .query('SELECT [dbo].[ftSACuerpoARC] (@reci_num, @cod_emp) AS cuerpo');
        
        cuerpo = cuerpo.recordset[0].cuerpo; */

        // Leer el archivo correo_ARC.html
        const templatePath = path.join(__dirname, "../templates/correo_Prestaciones.html");
        let htmlContent = fs.readFileSync(templatePath, 'utf8');

        // Reemplazar los placeholders en el contenido HTML
        htmlContent = htmlContent.replace('${nombre_empleado}', nombre_empleado);
/*         htmlContent = htmlContent.replace('${cuerpo}',cuerpo);
 */
        const mailOptions = {
            from: 'IntranetSegurosAltamira@segurosaltamira.com',
            to: correo_secundario,
            subject: `Adjunto de Movimientos de Prestaciones Sociales ${nombre_empleado}`,
            text: `Estimado(a) ${nombre_empleado},\n\nEn el presente se le anexa su movimiento de prestaciones sociales. Quedamos a sus ordenes.\n\nDepartamento de Nómina.`,
            html: htmlContent,
            attachments: [
                {
                    filename: 'prestaciones.pdf',
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