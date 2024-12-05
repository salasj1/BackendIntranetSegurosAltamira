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

// Ruta para obtener datos del ARC de un empleado específico
router.get('/arc/:cod_emp', async (req, res) => {
    let { cod_emp } = req.params;
    const { fecha } = req.query;

    console.log(`Request received for ARC data: cod_emp=${cod_emp}, fecha=${fecha}`);


    try {
      const pool = await getConnection();
      const result = await pool.request()
        .input('sCo_Emp', sql.Char, cod_emp)
        .input('iAnhio', sql.Int, fecha)
        .execute('spSARepComprobanteRetencionARC');
      res.json(result.recordset);
    } catch (error) {
      console.error('Error fetching ARC data:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch data', error });
    }
});

// Configuración del transportador de nodemailer
const transporter = nodemailer.createTransport({
    host: '192.168.0.206',
    port: 25,
    secure: false, 
    tls: {
        rejectUnauthorized: false
    },
    logger: false,
    debug: true
});

// Función para enviar correo con reintentos
const sendMailWithRetry = async (mailOptions, retries = 3) => {
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



// Ruta para enviar el ARC por correo electrónico al correo principal del empleado
router.post('/send-arc', upload.single('pdf'), async (req, res) => {
    const { cod_emp, fecha } = req.body;
    const pdfBuffer = req.file.buffer;

    console.log(`Request received to send ARC email: cod_emp=${cod_emp}, fecha=${fecha}`);

    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input('cod_emp', sql.NVarChar, cod_emp)
            .query(`
                SELECT correo_e, nombre_completo
                FROM VSNEMPLE
                WHERE cod_emp = @cod_emp;
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({ success: false, message: 'Employee not found' });
        }
        
        const { correo_e } = result.recordset[0];
        let nombre_empleado = result.recordset[0].nombre_completo.replace(/,/g, '');
        const mailOptions = {
            from: 'IntranetSegurosAltamira@segurosaltamira.com',
            to:  correo_e, 
            subject: `Adjunto de Comprobante de Agente de Retención (ARC) ${fecha} ${nombre_empleado}`,
            text: `Estimado(a) ${nombre_empleado},\n\n En el presente  se le anexa su Comprobante de Agente de Retención (ARC) correspondiente al año ${fecha}. Quedamos a sus ordenes.\n\n Departamento de Nómina`, 
            attachments: [
                {
                    filename: 'ARC.pdf',
                    content: pdfBuffer,
                    contentType: 'application/pdf'
                }
            ]
        };

        const resultMail = await sendMailWithRetry(mailOptions);

        if (resultMail.success) {
            res.json({ success: true, message: 'Email sent successfully' });
        } else {
            res.status(500).json({ success: false, message: 'Failed to send email', error: resultMail.error });
        }
    } catch (error) {
        console.error('Error sending ARC email:', error);
        res.status(500).json({ success: false, message: 'Error sending email', error });
    }
});

// Ruta para enviar el ARC por correo electrónico a un correo secundario
router.post('/send-arc-secundario', upload.single('pdf'), async (req, res) => {
    const { cod_emp, correo_secundario, fecha } = req.body;
    const pdfBuffer = req.file.buffer;

    console.log(`Request received to send ARC email to secondary email: cod_emp=${cod_emp}, correo_secundario=${correo_secundario}, fecha=${fecha}`);
    
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
            return res.status(404).json({ success: false, message: 'Employee not found' });
        }

        let nombre_empleado = result.recordset[0].nombre_completo.replace(/,/g, '');

        /* const cuerpo = await pool.request()
            .input('reci_num', sql.Int, reci_num)
            .input('cod_emp', sql.Char, cod_emp)
            .query('SELECT [dbo].[ftSACuerpoARC] (@reci_num, @cod_emp) AS cuerpo');
        
        cuerpo = cuerpo.recordset[0].cuerpo; */

        // Leer el archivo correo_ARC.html
        const templatePath = path.join(__dirname, "../templates/correo_ARC.html");
        let htmlContent = fs.readFileSync(templatePath, 'utf8');

        // Reemplazar los placeholders en el contenido HTML
        htmlContent = htmlContent.replace('${nombre_empleado}', nombre_empleado);
        htmlContent = htmlContent.replace('${fecha}', fecha);
/*         htmlContent = htmlContent.replace('${cuerpo}',cuerpo);
 */
        const mailOptions = {
            from: 'IntranetSegurosAltamira@segurosaltamira.com',
            to: correo_secundario,
            subject: `Adjunto de Comprobante de Agente de Retención (ARC) ${fecha} ${nombre_empleado}`,
            html: htmlContent,
            attachments: [
                {
                    filename: 'ARC.pdf',
                    content: pdfBuffer,
                    contentType: 'application/pdf'
                }
            ]
        };

        const resultMail = await sendMailWithRetry(mailOptions);

        if (resultMail.success) {
            res.json({ success: true, message: 'Email sent successfully' });
        } else {
            res.status(500).json({ success: false, message: 'Failed to send email', error: resultMail.error });
        }
    } catch (error) {
        console.error('Error sending ARC email to secondary email:', error);
        res.status(500).json({ success: false, message: 'Error sending email', error });
    }
});

export default router;