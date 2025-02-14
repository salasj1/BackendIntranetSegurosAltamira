import express from 'express';
import { getConnection, sql } from '../database/connection.js';

const router = express.Router();

// Ruta para obtener los datos personales de un expediente
router.get('/getDatosPersonales/:cod_emp', async (req, res) => {
    const { cod_emp } = req.params;
    console.log(`Request GET received for /getDatosPersonales/${cod_emp}`);
    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input('cod_emp', sql.NVarChar, cod_emp)
            .execute('spObtenerDatosExpediente');

        if (result.recordset.length > 0) {
            const expediente = result.recordset[0];
            res.json({ 
                success: true, 
                expediente
            });
        } else {
            res.status(404).json({ success: false, message: 'No se encuentra el expediente' });
        }
    } catch (error) {
        console.error('ERROR: ' + JSON.stringify(error));
        res.status(500).json({ success: false, message: 'Error de conexion' });
    }
});

// Ruta para obtener los datos del expediente de una ruta
router.get('/getDatosRutas/Ida/:cod_emp', async (req, res) => {
    const { cod_emp } = req.params;
    console.log(`Request GET received for /getDatosRuta/${cod_emp}`);
    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input('cod_emp', sql.NVarChar, cod_emp)
            .execute('spObtenerDatosRutasIda');

        if (result.recordset.length > 0) {
            const ruta = result.recordset[0];
            res.json({ 
                success: true, 
                ruta
            });
        } else {
            res.status(404).json({ success: false, message: 'No se encuentra la ruta' });
        }
    } catch (error) {
        console.error('ERROR: ' + JSON.stringify(error));
        res.status(500).json({ success: false, message: 'Error de conexion' });
    }
});

// Ruta para obtener los datos del expediente de una ruta
router.get('/getDatosRutas/Regreso/:cod_emp', async (req, res) => {
    const { cod_emp } = req.params;
    console.log(`Request GET received for /getDatosRuta/${cod_emp}`);
    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input('cod_emp', sql.NVarChar, cod_emp)
            .execute('spObtenerDatosRutaRegreso');

        if (result.recordset.length > 0) {
            const ruta = result.recordset[0];
            res.json({ 
                success: true, 
                ruta
            });
        } else {
            res.status(404).json({ success: false, message: 'No se encuentra la ruta' });
        }
    } catch (error) {
        console.error('ERROR: ' + JSON.stringify(error));
        res.status(500).json({ success: false, message: 'Error de conexion' });
    }
});
export default router;