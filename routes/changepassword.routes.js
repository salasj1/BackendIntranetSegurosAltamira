import express from 'express';
import nodemailer from 'nodemailer';
import multer from 'multer';
import { buscarUsuario } from '../functions/usuario.js';
import { encryptPassword, comparePassword } from '../functions/password.js';
import { getConnection, sql } from '../database/connection.js';
import { sendMailWithRetry } from '../functions/transporter.js';
import bcrypt from 'bcrypt';

const upload = multer();
const router = express.Router();

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
    console.log("Modificando contraseña en el sistema con el endpoint changepassword1");
    try {
        let codigoTemporal = Array(10).fill(0).map(() => {
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+[]{}<>?';
            return chars.charAt(Math.floor(Math.random() * chars.length));
        }).join('');
        console.log("El codigo temporal es " + codigoTemporal);
        const passwordEnviar = codigoTemporal;
        const codigoTemporalEncriptado = await encryptPassword(codigoTemporal); // Usar await para resolver la promesa
        console.log("El codigo temporal encriptado es " + codigoTemporalEncriptado);
        
        const pool = await getConnection();
        await pool.request()
            .input('cod_emp', sql.Char, cod_emp)
            .input('codigoTemporal', sql.VarChar, codigoTemporalEncriptado)
            .execute('spGuardarCodigoTemporal'); 

        const mailOptions = {
            from: 'IntranetSegurosAltamira@segurosaltamira.com',
            to: correo,
            subject: 'Codigo de Validación',
            text: `Estimado,\n\n El código de validación es: ${passwordEnviar}\n\n Cabe aclarar que su contraseña pasada ya no existe en el sistema. \n\n Por favor no lo comparta con nadie.\n\n Saludos.`
        };

        const mailResult = await sendMailWithRetry(mailOptions);
        if (mailResult.success) {
            res.json({ success: true, message: 'Se envió un correo con el código temporal para cambiar la contraseña' });
        } else {
            res.status(500).json({ success: false, message: 'Error al enviar el correo', error: mailResult.error });
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
    const {  password, confirmpassword } = req.body;

    if ( !password || !confirmpassword) {
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