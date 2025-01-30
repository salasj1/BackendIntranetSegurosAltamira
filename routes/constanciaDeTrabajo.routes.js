import express from 'express';
import multer from 'multer';
import nodemailer from 'nodemailer';
import { getConnection, sql } from '../database/connection.js'; 
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import numeroPalabra from 'numero-palabra';  
import { PDFDocument } from 'pdf-lib';
import archiver from 'archiver';
import sharp from 'sharp';
import { sendMailWithRetry } from '../functions/transporter.js';

const router = express.Router();
const upload = multer();



// Obtener el directorio actual utilizando import.meta.url
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ruta para obtener datos del ARC de un empleado específico
router.get('/constancia/:cod_emp', async (req, res) => {
    let { cod_emp } = req.params;
    const {  mostrarsueldo } = req.query;
    console.log(`Request GET received for constancia data: cod_emp=${cod_emp}, mostrarsueldo=${mostrarsueldo}`);

    try {
      const pool = await getConnection();
      const result = await pool.request()
        .input('cod_emp', sql.Char, cod_emp)
        .input('mostrarsueldo', sql.Char, mostrarsueldo)
        .execute('spSARepConstanciaDeTrabajo');
        console.log(result.recordset[0].sueldoBase);

    
      if (result.recordset[0].sueldoBase!==null) {
        const [entero, decimal] = result.recordset[0].sueldoBase.toString().split('.');
        const enteroEnPalabras = numeroPalabra(entero);
        let decimalEnPalabras = '';
        if (decimal) {
          decimalEnPalabras = `con ${decimal}/100 `;
          const sueldoBaseEnPalabras = `${enteroEnPalabras.toUpperCase()} ${decimalEnPalabras.toUpperCase()}`;
          result.recordset[0].sueldoBase = sueldoBaseEnPalabras+` (Bs. ${result.recordset[0].sueldoBase})`;
        }
      }
      
      res.json(result.recordset);
    } catch (error) {
      console.error('Error fetching constancia data:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch data', error });
    }
});

const compressPdf = async (pdfBuffer) => {
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const pages = pdfDoc.getPages();

  for (const page of pages) {
    const { width, height } = page.getSize();
    const images = page.node.Resources.XObject;

    if (images) {
      for (const key in images) {
        const image = images[key];
        const imageBytes = await pdfDoc.embedPng(image);
        const compressedImageBytes = await sharp(imageBytes).resize({ width: Math.floor(width / 2), height: Math.floor(height / 2) }).toBuffer();
        page.drawImage(compressedImageBytes, { x: 0, y: 0, width, height });
      }
    }
  }

  const compressedPdfBytes = await pdfDoc.save({ useObjectStreams: false });
  return Buffer.from(compressedPdfBytes);
};

const createZip = async (pdfBuffer, filename) => {
  const zipBuffer = await new Promise((resolve, reject) => {
    const archive = archiver('zip', { zlib: { level: 9 } });
    const buffers = [];

    archive.on('data', (data) => buffers.push(data));
    archive.on('end', () => resolve(Buffer.concat(buffers)));
    archive.on('error', (err) => reject(err));

    archive.append(pdfBuffer, { name: filename });
    archive.finalize();
  });

  return zipBuffer;
};

// Ruta para enviar el ARC por correo electrónico a un correo 
router.post('/send-constancia-trabajo', upload.single('pdf'), async (req, res) => {
    const { cod_emp, correo, fecha } = req.body;
    const pdfBuffer = req.file.buffer;

    console.log(`Request received to send ARC email to secondary email: cod_emp=${cod_emp}, correo=${correo}, fecha=${fecha}`);
    
    try {
        const compressedPdfBuffer = await compressPdf(pdfBuffer);
        const sanitizedFecha = fecha.replace(/\//g, '-');
        const zipBuffer = await createZip(compressedPdfBuffer, `Constancia_de_Trabajo_${sanitizedFecha}.pdf`);

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

        // Leer el archivo correo_ARC.html
        const templatePath = path.join(__dirname, "../templates/correo_ConstanciaTrabajo.html");
        let htmlContent = fs.readFileSync(templatePath, 'utf8');

        // Reemplazar los placeholders en el contenido HTML
        htmlContent = htmlContent.replace('${nombre_empleado}', nombre_empleado);
        htmlContent = htmlContent.replace('${fecha}', fecha);

        const mailOptions = {
            from: 'IntranetSegurosAltamira@segurosaltamira.com',
            to: correo,
            subject: `Adjunto de Constancia de Trabajo ${fecha} ${nombre_empleado}`,
            html: htmlContent,
            attachments: [
                {
                    filename: `Constancia_de_Trabajo_${sanitizedFecha}.zip`,
                    content: zipBuffer,
                    contentType: 'application/zip'
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
        console.error('Error sending constancia email to email:', error);
        res.status(500).json({ success: false, message: 'Error sending email', error });
    }
});

export default router;