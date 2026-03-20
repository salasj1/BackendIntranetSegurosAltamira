import express from 'express';
import nodemailer from 'nodemailer';
import multer from 'multer';
import { buscarUsuario } from '../functions/usuario.js';
import { encryptPassword, comparePassword } from '../functions/password.js';
import { getConnection, sql } from '../database/connection.js';
import { sendMailWithRetry } from '../functions/transporter.js';
import { enviarReporteCorreo } from '../functions/reporteEnvioCorreo.js';
import bcrypt from 'bcrypt';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { format } from 'date-fns-tz';
const upload = multer();
const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
router.post('/verify/:username', async (req, res) => {
    let { username } = req.params;

    try {
        const usuario = await buscarUsuario(username);
        if (!usuario) {
            return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
        }
        res.json({ success: true, message: 'Usuario encontrado', usuario });
    } catch (error) {
        console.error('Error al buscar usuario:', error);
        res.status(500).json({ success: false, message: 'Error al buscar usuario' });
    }
});



router.put('/changepassword1/:cod_emp', async (req, res) => {
    let { cod_emp } = req.params;
    const { correo } = req.body;

    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    console.log(`Solicitud de cambio de contraseña desde la IP: ${ip}`);
    try {
        // Generar el código temporal
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        const codigoTemporal = Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');

        const codigoTemporalEncriptado = await encryptPassword(codigoTemporal);

        // Guardar el código temporal en la base de datos
        const pool = await getConnection();
        await pool.request()
            .input('cod_emp', sql.Char, cod_emp)
            .input('codigoTemporal', sql.VarChar, codigoTemporalEncriptado)
            .execute('spGuardarCodigoTemporal');

        // Leer la plantilla de correo
        const templatePath = path.join(__dirname, "../templates/correo_Codigo_Validacion.html");
        let htmlContent = fs.readFileSync(templatePath, 'utf8');
        htmlContent = htmlContent.replace('${codigoTemporal}', codigoTemporal);

        // Configurar las opciones del correo
        const mailOptions = {
            from: 'IntranetSegurosAltamira@segurosaltamira.com',
            to: correo,
            subject: 'Código de Validación para Cambio de Contraseña',
            html: htmlContent
        };

        // Enviar el correo
        const mailResult = await sendMailWithRetry(mailOptions);

        await enviarReporteCorreo(cod_emp, ip, 'Cambio de contraseña', mailResult.success, mailResult.fecha);

        if (mailResult.success) {
            res.json({ success: true, message: 'Se envió un correo con el código temporal para cambiar la contraseña' });
        } else {
            res.status(500).json({ success: false, message: 'Error al enviar el correo. Refresque la página e intentelo de nuevo', error: mailResult.error });
        }
    } catch (error) {
        console.error('Error del servidor:', error);
        res.status(500).json({ success: false, message: 'Error del servidor' });
    }
});

router.post('/verifycode/:username', async (req, res) => {
    let { username } = req.params;
    const { codigoTemporal } = req.body;
    try {
        console.log(codigoTemporal);
        const user = await buscarUsuario(username);
        if (!user) {
            return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
        }
        const hashedPassword = user.password; // Asegúrate de que estás obteniendo el código temporal correcto
        const isMatch = await bcrypt.compare(codigoTemporal, hashedPassword);
        if (isMatch) {
            res.json({ success: true, message: 'Código verificado correctamente' });
            console.log("Código verificado correctamente");
        } else {
            res.status(401).json({ success: false, message: 'El código escrito es incorrecto' }); // Cambiar a 401 Unauthorized
            console.log("El código escrito es incorrecto");
        }
    } catch (error) {
        console.error('Error al verificar el código:', error);
        res.status(500).json({ success: false, message: 'Error al verificar el código en el sistema' });
    }
});

router.put('/changepassword2/:cod_emp', async (req, res) => {
    let { cod_emp } = req.params;
    const { password, confirmpassword } = req.body;

    if (!password || !confirmpassword) {
        return res.status(400).json({ success: false, message: 'Todos los campos son obligatorios' });
    }
    if (password !== confirmpassword) {
        return res.status(400).json({ success: false, message: 'Las contraseñas no coinciden' });
    }

    try {
        const hashedPassword = await encryptPassword(password);
        console.log('El password encriptado es ' + hashedPassword);
        const pool = await getConnection();
        await pool.request()
            .input('cod_emp', sql.Char, cod_emp)
            .input('password', sql.VarChar, hashedPassword)
            .execute('spCambiarPassword');
        return res.json({ success: true, message: 'Contraseña cambiada correctamente' });
    } catch (error) {
        console.error('Error al cambiar la contraseña:', error);
        res.status(500).json({ success: false, message: 'Error al cambiar el contraseña en el sistema' });
    }
});

export default router;