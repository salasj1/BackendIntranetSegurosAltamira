import express from 'express';
import { getConnection, sql } from '../database/connection.js';

const router = express.Router();

router.get('/empleados', async (req, res) => {
  try {
    const pool = await getConnection();
    const result = await pool.request().query(`
      SELECT DISTINCT
        V.cod_emp,
        V.nombres,
        V.apellidos,
        V.des_depart,
        V.des_cargo,
        V.correo_e,
        V.nombre_completo,
        A.tlf_oficina
        FROM VSNEMPLE V
        LEFT JOIN SNEMPLE_AUX A ON V.cod_emp COLLATE Modern_Spanish_CI_AS = A.cod_emp COLLATE Modern_Spanish_CI_AS
    `);
    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching empleados:', error);
    res.status(500).json({ error: 'Error fetching empleados' });
  }
});

router.get('/empleados/control', async (req, res) => {
  try {
    const pool = await getConnection();
    const result = await pool.request().query(`
        SELECT DISTINCT
        E.cod_emp,
        E.ci as cedula_empleado,
        E.nombres AS nombres_empleado,
        E.apellidos AS apellidos_empleado,
        S.cod_emp AS cod_supervisor,
        S.ci AS cedula_supervisor,
        S.nombres AS nombres_supervisor,
        S.apellidos AS apellidos_supervisor,
        A.Tipo as Tipo,
        E.Nomina
      FROM VSNEMPLE E INNER JOIN SUPERVISION A ON E.cod_emp COLLATE Modern_Spanish_CI_AS =A.Cod_emp COLLATE Modern_Spanish_CI_AS INNER JOIN VSNEMPLE S ON S.cod_emp COLLATE Modern_Spanish_CI_AS=A.Cod_supervisor COLLATE Modern_Spanish_CI_AS
    `);
    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching empleados detalles:', error);
    res.status(500).json({ error: 'Error fetching empleados detalles' });
  }
});

router.put('/empleados/:cod_emp/telefono', async (req, res) => {
  const { cod_emp } = req.params;
  const { tlf_oficina } = req.body;

  try {
    const pool = await getConnection();
    
    // Verificar si el número de teléfono ya existe
    const checkResult = await pool.request()
      .input('cod_emp', sql.VarChar, cod_emp)
      .query(`
        SELECT tlf_oficina
        FROM SNEMPLE_AUX
        WHERE cod_emp = @cod_emp
      `);

    if (checkResult.recordset.length > 0) {
      // Si el número de teléfono ya existe, actualizarlo
      await pool.request()
        .input('cod_emp', sql.VarChar, cod_emp)
        .input('tlf_oficina', sql.VarChar, tlf_oficina)
        .query(`
          UPDATE SNEMPLE_AUX
          SET tlf_oficina = @tlf_oficina
          WHERE cod_emp = @cod_emp
        `);
      res.json({ message: 'Número de teléfono actualizado correctamente' });
    } else {
      // Si el número de teléfono no existe, insertarlo
      await pool.request()
        .input('cod_emp', sql.VarChar, cod_emp)
        .input('tlf_oficina', sql.VarChar, tlf_oficina)
        .query(`
          INSERT INTO SNEMPLE_AUX (cod_emp, tlf_oficina)
          VALUES (@cod_emp, @tlf_oficina)
        `);
      res.json({ message: 'Número de teléfono agregado correctamente' });
    }
  } catch (error) {
    console.error('Error actualizando/agregando el número de teléfono:', error);
    res.status(500).json({ error: 'Error actualizando/agregando el número de teléfono' });
  }
});

router.delete('/empleados/:cod_emp/telefono', async (req, res) => {
  const { cod_emp } = req.params;

  try {
    const pool = await getConnection();
    await pool.request()
      .input('cod_emp', sql.VarChar, cod_emp)
      .query(`
        UPDATE SNEMPLE_AUX
        SET tlf_oficina = NULL
        WHERE cod_emp = @cod_emp
      `);
    res.json({ message: 'Número de teléfono eliminado correctamente' });
  } catch (error) {
    console.error('Error eliminando el número de teléfono:', error);
    res.status(500).json({ error: 'Error eliminando el número de teléfono' });
  }
});

router.post('/empleados/supervision', async (req, res) => {
  const { supervisor, supervisados, tipo } = req.body;

  try {
    const pool = await getConnection();
    const supervisadosXml = `<Supervisados>${supervisados.map(s => `<supervisado>${s}</supervisado>`).join('')}</Supervisados>`;

    await pool.request()
      .input('supervisor', sql.Char(17), supervisor)
      .input('supervisados', sql.NVarChar, supervisadosXml)
      .input('tipo', sql.VarChar(50), tipo)
      .execute('spAgregarSupervision');

    res.json({ message: 'Supervisión agregada correctamente' });
  } catch (error) {
    console.error('Error agregando supervisión:', error);
    res.status(500).json({ error: 'Error agregando supervisión' });
  }
});



export default router;