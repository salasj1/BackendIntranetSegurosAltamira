import express from 'express';
import multer from 'multer';
import nodemailer from 'nodemailer';
import { getConnection, sql } from '../database/connection.js'; 

const router = express.Router();
const upload = multer();

router.get('/arc/:cod_emp', async (req, res) => {
    let { cod_emp } = req.params;
    const { fecha } = req.query;
    cod_emp = cod_emp.trim().replace(/\D/g, '');

    if (isNaN(cod_emp) || isNaN(fecha)) {
        return res.status(400).json({ success: false, message: 'Invalid cod_emp or fecha value' });
    }

    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input('sCo_Emp', sql.Char(17), cod_emp)
            .input('iAnhio', sql.Int, fecha)
            .execute('spSARepComprobanteRetencionARC');
        res.json(result.recordset);
    } catch (error) {
        console.error('Error fetching ARC data:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch data', error });
    }
});

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

router.post('/send-arc', upload.single('pdf'), async (req, res) => {
    const { cod_emp, fecha } = req.body;
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
            return res.status(404).json({ success: false, message: 'Employee not found' });
        }

        const { correo_e } = result.recordset[0];
        const mailOptions = {
            from: 'IntranetSegurosAltamira@proseguros.com.ve',
            to: "assalas.19@est.ucab.edu.ve",/* correo_e, */
            subject: 'ARC Document',
            text: `Adjunto encontrarás el PDF con el ARC del empleado con código ${cod_emp} para el año ${fecha}.`,
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

router.post('/send-arc-secundario', upload.single('pdf'), async (req, res) => {
    const { cod_emp, correo_secundario, fecha } = req.body;
    const pdfBuffer = req.file.buffer;

    try {
        const mailOptions = {
            from: 'IntranetSegurosAltamira@proseguros.com.ve',
            to: correo_secundario,
            subject: 'ARC Document',
            text: `Adjunto encontrarás el PDF con el ARC del empleado con código ${cod_emp} para el año ${fecha}.`,
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