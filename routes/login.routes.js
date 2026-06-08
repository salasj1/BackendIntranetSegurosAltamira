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

        // Verificar si es el administrador
        const adminUsername = process.env.ADMIN_USERNAME; // Usuario del administrador
        const adminPassword = process.env.ADMIN_PASSWORD; // Contraseña del administrador

        if (username === adminUsername) {
            if (password === adminPassword) {
            return res.json({
                success: true,
                message: 'Authenticated as admin',
                isAdmin: true,
            });
            } else {
            return res.status(401).json({ success: false, message: 'Contraseña Invalida' });
            }
        }

        // Verificar usuarios normales
        const pool = await getConnection();
        const result = await pool.request()
            .input('username', sql.NVarChar, username)
            .query(`
                SELECT u.*, e.nombre_completo nombre_completo,e.nombres nombres,e.apellidos apellidos, e.des_cargo, e.fecha_ing, e.fecha_nac, e.des_depart, e.tipo, e.RRHH, e.correo_e email, e.sexo sexo
                FROM snusuarios u
                JOIN VSNEMPLE e ON u.cod_emp COLLATE Modern_Spanish_CI_AS = e.cod_emp COLLATE Modern_Spanish_CI_AS
                WHERE u.username = @username COLLATE Modern_Spanish_CI_AS;
            `);

        if (result.recordset.length > 0) {
            const user = result.recordset[0];
            if (user.status === 'Nuevo' || user.status === null) {
                console.log('El usuario es nuevo');
                res.status(401).json({ success: false, message: 'El usuario ingresado es un usuario nuevo, por favor cambiar su contraseña' });
            }
            const passwordMatch = await bcrypt.compare(password, user.password);

            if (passwordMatch) {
                res.json({
                    success: true,
                    message: 'Authenticated successfully',
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
                    isAdmin: false, 
                });
            } else {
                console.log('Invalid password');
                res.status(401).json({ success: false, message: 'Contraseña Invalida' });
            }
        } else {
            console.log('User not found');
            res.status(401).json({ success: false, message: 'Correo no encontrado' });
        }
    } catch (error) {
        console.error('ERROR: ' + JSON.stringify(error));
        res.status(500).json({ success: false, message: 'Error de conexion' });
    }
});

// ... código existente del router ...

// Nuevo endpoint para verificar el estado actual del usuario en tiempo real
router.get('/check-status/:cod_emp', async (req, res) => {
    const { cod_emp } = req.params;
    if (!cod_emp) {
        return res.status(400).json({ success: false, message: 'Código de empleado requerido' });
    }

    try {
        const pool = await getConnection();

        // 1. Obtener el estado de RRHH y los tipos de supervisión del empleado
        const result = await pool.request()
            .input('cod_emp', sql.VarChar, cod_emp)
            .execute('spRevisarTipoSupervisor');

        if (result.recordset.length > 0) {
            const userStatus = result.recordset[0];
            // Si es de RRHH, tiene todos los permisos de aprobación
            const isRRHH = userStatus.RRHH === true;

            res.json({
                success: true,
                RRHH: userStatus.RRHH,
                tipo: userStatus.tipo,
                canApproveVacations: isRRHH || userStatus.CanApproveVacations,
                canApprovePermits: isRRHH || userStatus.CanApprovePermits
            });
        } else {
            res.status(404).json({ success: false, message: 'Usuario no encontrado' });
        }
    } catch (error) {
        console.error('Error checking user status:', error);
        res.status(500).json({ success: false, message: 'Error del servidor' });
    }
});

export default router;