import express from 'express';
import { getConnection } from '../database/connection.js';
import jwt from 'jsonwebtoken';
import { ejecutarEnvioCumpleanos } from '../jobs/enviarCumpleanos.js';

const router = express.Router();

router.get('/usuarios', async (req, res) => {
    try {
        // Conexión a la base de datos
        const pool = await getConnection();

        // Consulta para obtener los usuarios de la tabla snusuarios
        const result = await pool.request().query(`
            SELECT username as correo_e
            FROM snusuarios
            
        `);

        // Verificar si hay resultados
        if (result.recordset.length === 0) {
            return res.status(404).json({ success: false, message: 'No se encontraron usuarios' });
        }

        // Devolver los usuarios
        res.json({ success: true, usuarios: result.recordset });
    } catch (error) {
        console.error('Error al obtener usuarios:', error);
        res.status(500).json({ success: false, message: 'Error al obtener usuarios' });
    }
});

// Endpoint para impersonar a otro usuario
router.post('/impersonate', async (req, res) => {
    const { username } = req.body;

    try {
        // Buscar al usuario en la base de datos
        const pool = await getConnection();
        const result = await pool.request()
            .input('username', username)
            .query(`SELECT u.*, e.nombre_completo nombre_completo,e.nombres nombres,e.apellidos apellidos, e.des_cargo, e.fecha_ing, e.fecha_nac, e.des_depart, e.tipo, e.RRHH, e.correo_e email, e.sexo sexo
                FROM snusuarios u
                JOIN VSNEMPLE e ON u.cod_emp COLLATE Modern_Spanish_CI_AS = e.cod_emp COLLATE Modern_Spanish_CI_AS
                WHERE u.username = @username COLLATE Modern_Spanish_CI_AS`);

        if (result.recordset.length === 0) {
            return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
        }

        const user = result.recordset[0];
        console.log('sexo admin:', user.sexo);
        // Generar un nuevo token para el usuario seleccionado
        const token = jwt.sign(
            {
                cod_emp: user.cod_emp,
                nombres: user.nombres,
                apellidos: user.apellidos,
                nombre_completo: user.nombre_completo,
                email: user.correo_e,
                isAdmin: true, // El usuario impersonado no es administrador
            },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );
        console.log("nombres usuario impersonado:", user.nombres);


        res.json({
            success: true,
            message: 'Authenticated successfully',
            token: token,
            cod_emp: user.cod_emp,
            nombres: user.nombres,
            apellidos: user.apellidos,
            nombre_completo: user.nombre_completo,
            des_cargo: user.des_cargo,
            fecha_ing: user.fecha_ing,
            fecha_nac: user.fecha_nac,
            des_depart: user.des_depart,
            tipo: user.tipo,
            RRHH: user.RRHH,
            email: user.email,
            sexo: user.sexo,
            isAdmin: false, // No es administrador
        });
    } catch (error) {
        console.error('Error al impersonar usuario:', error);
        res.status(500).json({ success: false, message: 'Error al impersonar usuario' });
    }
});

router.post('/cumpleanos/enviar', async (req, res) => {
    try {
        await ejecutarEnvioCumpleanos();
        res.json({ success: true, message: 'Envío de correos de cumpleaños ejecutado' });
    } catch (error) {
        console.error('Error al ejecutar envío de cumpleaños:', error);
        res.status(500).json({ success: false, message: 'Error al ejecutar el envío de cumpleaños' });
    }
});

export default router;