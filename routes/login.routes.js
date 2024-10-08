import express from 'express';
import bcrypt from 'bcrypt';
import { getConnection, sql } from '../database/connection.js';

const router = express.Router();

router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input('username', sql.NVarChar, username)
            .query(`
                SELECT u.*, e.nombre_completo, e.des_cargo, e.fecha_ing, e.des_depart, e.tipo, e.RRHH
                FROM snusuarios u
                JOIN VSNEMPLE e ON u.cod_emp COLLATE Modern_Spanish_CI_AS = e.cod_emp COLLATE Modern_Spanish_CI_AS
                WHERE u.username = @username COLLATE Modern_Spanish_CI_AS;
            `);
            console.log(`Query result: ${JSON.stringify(result.recordset)}`);
        if (result.recordset.length > 0) {
            const user = result.recordset[0];
            const passwordMatch = await bcrypt.compare(password, user.password);
            
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
                    RRHH: user.RRHH
                });
            } else {
                res.status(401).json({ success: false, message: 'Authentication failed' });
            }
        } else {
            res.status(401).json({ success: false, message: 'Authentication failed' });
        }
    } catch (error) {
        console.error('ERROR: ' + JSON.stringify(error));
        res.status(500).json({ success: false, message: 'Error de conexion' });
    }
});

export default router;