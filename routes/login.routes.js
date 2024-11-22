import express from 'express';
import bcrypt from 'bcrypt';
import { getConnection, sql } from '../database/connection.js';

const router = express.Router();

// Ruta para el inicio de sesión
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    console.log(`Login attempt for username: ${username}`);
    try {
        console.log('Request POST received for /login');
        const pool = await getConnection();
        const result = await pool.request()
            .input('username', sql.NVarChar, username)
            .query(`
                SELECT u.*, e.nombre_completo, e.des_cargo, e.fecha_ing, e.des_depart, e.tipo, e.RRHH, e.correo_e email
                FROM snusuarios u
                JOIN VSNEMPLE e ON u.cod_emp COLLATE Modern_Spanish_CI_AS = e.cod_emp COLLATE Modern_Spanish_CI_AS
                WHERE u.username = @username COLLATE Modern_Spanish_CI_AS;
            `);     

        if (result.recordset.length > 0) {
            const user = result.recordset[0];
            console.log('User found:', user);
            console.log('Password from request:', password);
            console.log('Password from database:', user.password);
            const passwordMatch = await bcrypt.compare(password, user.password);
            console.log('Password match:', passwordMatch);
            
            if (passwordMatch) {
                res.json({ 
                    success: true, 
                    message: 'Authenticated successfully', 
                    cod_emp: user.cod_emp, 
                    nombre_completo: user.nombre_completo, 
                    des_cargo: user.des_cargo,
                    fecha_ing: user.fecha_ing,
                    des_depart: user.des_depart,
                    tipo: user.tipo,
                    RRHH: user.RRHH,
                    email: user.email
                });
            } else {
                console.log('Invalid password');
                res.status(401).json({ success: false, message: 'Contraseña Invalida' });
            }
        } else {
            console.log('User not found');
            res.status(401).json({ success: false, message: 'No se encuentra el usuario' });
        }
    } catch (error) {
        console.error('ERROR: ' + JSON.stringify(error));
        res.status(500).json({ success: false, message: 'Error de conexion' });
    }
});

export default router;