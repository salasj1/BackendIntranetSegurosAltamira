import express from 'express';
import { getConnection, sql } from '../database/connection.js';
const router = express.Router();

//Obtener las cantidad total de vacaciones y permisos aprobados
router.get('/TotalVacacionesYPermisos', async (req, res) => {
    console.log('Solicitud recibida para /TotalVacacionesYPermisos');
    try {
        const pool = await getConnection();
        const result = await pool.request()
        .execute('spTotalCantidadSolicitudesVacacionesYPermisos');
        const totalVacaciones = result.recordsets[0][0].total_vacaciones;
        const totalPermisos = result.recordsets[1][0].total_permisos;
        console.log('Estadísticas obtenidas:', { totalVacaciones, totalPermisos });
        res.json({ totalVacaciones, totalPermisos });
    } catch (error) {
        console.error('Error al obtener las estadísticas:', error);
        res.status(500).json({ error: 'Error al obtener las estadísticas' });
    }
});

export default router;