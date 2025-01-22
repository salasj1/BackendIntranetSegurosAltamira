import express from 'express';
import { getConnection, sql } from '../connection.js';

const router = express.Router();

// Obtener notificaciones de un empleado con estatus 1 y 2
router.get('/notificaciones/:cod_emp', async (req, res) => {
    const { cod_emp } = req.params;
    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input('cod_emp', sql.Char, cod_emp)
            .execute('sp_ObtenerNotificacionesporStatus');
        res.json(result.recordset);
    } catch (error) {
        res.status(500).send(error.message);
    }
});

// Crear una nueva notificación
router.post('/notificaciones', async (req, res) => {
    const { titulo, descripcion, us_emite, us_recibe } = req.body;
    try {
        const pool = await getConnection();
        await pool.request()
            .input('titulo', sql.NVarChar(50), titulo)
            .input('descripcion', sql.NVarChar, descripcion)
            .input('us_emite', sql.Char(17), us_emite)
            .input('us_recibe', sql.Char(17), us_recibe)
            .input('fecha', sql.DateTime, new Date())
            .input('status', sql.Int, 1)
            .execute('sp_CrearNotificacion');
        res.sendStatus(201);
    } catch (error) {
        res.status(500).send(error.message);
    }
});

// Actualizar el estatus de una notificación
router.put('/notificaciones/:id', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    try {
        const pool = await getConnection();
        await pool.request()
            .input('id', sql.Int, id)
            .input('status', sql.Int, status)
            .execute('sp_ActualizarStatusNotificacion');
        res.sendStatus(204);
    } catch (error) {
        res.status(500).send(error.message);
    }
});

// Eliminar (lógicamente) una notificación
router.delete('/notificaciones/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const pool = await getConnection();
        await pool.request()
            .input('id', sql.Int, id)
            .execute('sp_DeleteNotificacion');
        res.sendStatus(204);
    } catch (error) {
        res.status(500).send(error.message);
    }
});

export default router;