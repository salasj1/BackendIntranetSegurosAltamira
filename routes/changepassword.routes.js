import express from 'express';
import nodemailer from 'nodemailer';
import { getConnection, sql } from '../database/connection.js'; 

import encript from  '../functions/encript.js';
const router = express.Router();


const upload = multer();

import express from 'express';
import nodemailer from 'nodemailer';
import { getConnection, sql } from '../database/connection.js'; 

const router = express.Router();

router.put('/changepassword/:cod_emp', async (req, res) => {
    let { cod_emp } = req.params;
    const { oldpassword, password,confirmpassword } = req.body;

    if(!oldpassword || !password || !confirmpassword){
        return res.status(400).json({ success: false, message: 'Todos los campos son obligatorios' });
    }
    if(password !== confirmpassword){
        return res.status(400).json({ success: false, message: 'Las contraseñas no coinciden' });
    }
    
    if (encript.comparePassword(oldpassword, password)) {
    const passwordencriptado= encript.encryptPassword(password);

    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input('sCo_Emp', sql.Char, cod_emp)
            .input('password', sql.VarChar, passwordencriptado)
            .execute('spCambiarContrasena'); 
        res.json(result.recordset);
    } catch (error) {
        console.error('Error al cambiar la contraseña:', error);
        res.status(400).json({
            code: error.code,
            message: error.originalError.message,
            serverName: error.originalError.serverName,
            procName: error.originalError.procName,
            lineNumber: error.originalError.lineNumber
        });
    }
});

export default router;