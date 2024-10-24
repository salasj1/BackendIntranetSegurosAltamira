import express from 'express';
import { getConnection, sql } from '../database/connection.js';

const router = express.Router();

router.get('/empleados', async (req, res) => {
  try {
    const pool = await getConnection();
    const result = await pool.request().query(`
      SELECT DISTINCT
        cod_emp,
        nombres,
        apellidos,
        des_depart,
        des_cargo,
        correo_e,
        nombre_completo
      FROM VSNEMPLE
    `);
    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching empleados:', error);
    res.status(500).json({ error: 'Error fetching empleados' });
  }
});


export default router;