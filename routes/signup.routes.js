import express from 'express';
import bcrypt from 'bcrypt';
import { getConnection, sql } from '../database/connection.js';

const router = express.Router();

router.post('/signup', async (req, res) => {

    const { email, username, password, confirmPassword } = req.body;
    console.log("Entrando a signup");
    if (!email || !username || !password || !confirmPassword) {
      
      return res.status(400).json({ success: false, message: 'Todos los campos son obligatorios' });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Las contraseñas no coinciden' });
    }

    try {
        console.log("Request POST received for /signup");
        const pool = await getConnection();
            
        // Verificar si el usuario ya existe
        const userCheck = await pool.request()
            .input('username', sql.NVarChar, username)
            .query('SELECT * FROM snusuarios WHERE username = @username');

        if (userCheck.recordset.length > 0) {
            return res.status(400).json({ success: false, message: 'El nombre de usuario ya existe' });
        }

        // Verificar si el correo electrónico existe en VSNEMPLE
        const emailCheck = await pool.request()
            .input('correo_e', sql.NVarChar, email)
            .query('SELECT cod_emp, nombre_completo, des_cargo FROM VSNEMPLE WHERE correo_e = @correo_e');

        if (emailCheck.recordset.length === 0) {
            return res.status(400).json({ success: false, message: 'El correo electrónico no está registrado' });
        }

        const { cod_emp, nombre_completo, des_cargo } = emailCheck.recordset[0];

        // Verificar si el correo electrónico ya está registrado en snusuarios
        const emailUserCheck = await pool.request()
            .input('cod_emp', sql.NVarChar, cod_emp) // Corregir aquí
            .query('SELECT * FROM snusuarios WHERE cod_emp = @cod_emp');

        if (emailUserCheck.recordset.length > 0) {
            return res.status(400).json({ success: false, message: 'Este correo ya esta asociado con un usuario registrado' });
        }

        // Cifrar la contraseña
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insertar el nuevo usuario en la base de datos
        await pool.request()
            .input('username', sql.NVarChar, username)
            .input('password', sql.NVarChar, hashedPassword)
            .input('cod_emp', sql.NVarChar, cod_emp)
            .query('INSERT INTO snusuarios (username, password, cod_emp) VALUES (@username, @password, @cod_emp)');

        // Generar un token (puedes usar cualquier método para generar el token)
        const token = 'generated-jwt-token';

        res.json({ 
            success: true, 
            message: 'Usuario registrado exitosamente', 
            token, 
            nombre_completo, 
            des_cargo, 
            cod_emp 
        });
    } catch (error) {
        console.error('ERROR: ' + JSON.stringify(error));
        res.status(500).json({ success: false, message: 'Error en el registro', error: error });
    }
});

export default router;