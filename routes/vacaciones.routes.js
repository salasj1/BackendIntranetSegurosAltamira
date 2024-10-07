import express from 'express';
import { getConnection, sql } from '../database/connection.js';

const router = express.Router();

router.get('/vacaciones/:cod_emp', async (req, res) => {
  const { cod_emp } = req.params;

  try {
    const pool = await getConnection();
    pool.requestTimeout = 30000; // Aumenta el tiempo de espera a 30 segundos
    const result = await pool.request()
      .input('cod_emp', sql.Char, cod_emp)
      .query(`
        SELECT 
          VacacionID,
          FechaInicio,
          FechaFin,
          Estado
        FROM db_accessadmin.VACACIONES
        WHERE cod_emp = @cod_emp
      `);
    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching vacaciones:', error);
    res.status(500).json({ error: 'Error fetching vacaciones' });
  }
});

router.get('/vacacionesaprobadas', async (req, res) => {
  try {
    const pool = await getConnection();
    const result = await pool.request()
      .query(`SELECT DISTINCT
        V.VacacionID,
        V.FechaInicio,
        V.FechaFin,
        V.Estado,
        V.cod_emp,
        E.nombre_completo AS nombre_empleado,
        E.nombres AS nombres_empleado,
        E.apellidos AS apellidos_empleado,
        S.nombre_completo AS nombre_supervisor,
        S.nombres AS nombres_supervisor,
        S.apellidos AS apellidos_supervisor,
        E.ci,
        V.cod_supervisor
      FROM db_accessadmin.VACACIONES V
      JOIN dbo.VSNEMPLE E ON V.cod_emp COLLATE SQL_Latin1_General_CP1_CI_AS = E.cod_emp
      JOIN dbo.VSNEMPLE S ON V.cod_supervisor COLLATE SQL_Latin1_General_CP1_CI_AS = S.cod_emp
      WHERE V.Estado IN ('aprobada','Procesada')`);
    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching vacaciones:', error);
    res.status(500).json({ error: 'Error fetching vacaciones' });
  }
});

router.post('/vacaciones', async (req, res) => {
  const { cod_emp, FechaInicio, FechaFin, Estado, cod_supervisor, cod_RRHH } = req.body;

  try {
    const pool = await getConnection();
    await pool.request()
      .input('cod_emp', sql.Char, cod_emp)
      .input('FechaInicio', sql.Date, FechaInicio)
      .input('FechaFin', sql.Date, FechaFin)
      .input('Estado', sql.VarChar, Estado)
      .input('cod_supervisor', sql.Char, cod_supervisor)
      .input('cod_RRHH', sql.Char, cod_RRHH)
      .query(`
        INSERT INTO db_accessadmin.VACACIONES (cod_emp, FechaInicio, FechaFin, Estado, cod_supervisor, cod_RRHH)
        VALUES (@cod_emp, @FechaInicio, @FechaFin, @Estado, @cod_supervisor, @cod_RRHH)
      `);
    res.status(201).json({ message: 'Vacaciones registradas exitosamente' });
  } catch (error) {
    console.error('Error registrando vacaciones:', error);
    res.status(500).json({ error: 'Error registrando vacaciones' });
  }
});

router.get('/vacacionesAprobadas', async (req, res) => {
  const { cod_emp, FechaInicio, FechaFin, Estado } = req.body;
  try {
    const pool = await getConnection();
    await pool.request()
      .input('cod_emp', sql.Char, cod_emp)
      .input('FechaInicio', sql.Date, FechaInicio)
      .input('FechaFin', sql.Date, FechaFin)
      .input('Estado', sql.VarChar, Estado)
      .query(`
        SELECT 
          V.VacacionID,
          V.FechaInicio,
          V.FechaFin,
          V.Estado,
          V.cod_emp,
          E.nombre_completo,
          E.nombres,
          E.apellidos,
          E.nombre_completo,
          V.cod_supervisor
        FROM db_accessadmin.VACACIONES V
        JOIN dbo.VSNEMPLE E ON V.cod_emp COLLATE SQL_Latin1_General_CP1_CI_AS = E.cod_emp
        where V.Estado IN ('aprobada')
      `);
    res.status(201).json({ message: 'Vacaciones registradas exitosamente' });
  } catch (error) {
    console.error('Error registrando vacaciones:', error);
    res.status(500).json({ error: 'Error registrando vacaciones' });
  }
});

router.get('/vacaciones/supervisor/:cod_supervisor', async (req, res) => {
  const { cod_supervisor } = req.params;

  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input('cod_supervisor', sql.Char, cod_supervisor)
      .query(`
        SELECT DISTINCT
          V.VacacionID,
          V.FechaInicio,
          V.FechaFin,
          V.Estado,
          V.cod_emp,
          E.nombres,
          E.apellidos,
          E.nombre_completo,
          E.ci
        FROM db_accessadmin.VACACIONES V
        JOIN dbo.VSNEMPLE E ON V.cod_emp COLLATE SQL_Latin1_General_CP1_CI_AS = E.cod_emp COLLATE SQL_Latin1_General_CP1_CI_AS
        JOIN db_accessadmin.SUPERVISION S ON V.cod_emp COLLATE SQL_Latin1_General_CP1_CI_AS = S.Cod_emp COLLATE SQL_Latin1_General_CP1_CI_AS
        WHERE S.Cod_supervisor COLLATE SQL_Latin1_General_CP1_CI_AS = @cod_supervisor
        AND V.Estado IN ('solicitada', 'aprobada')
      `);
    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching supervisor vacaciones:', error);
    res.status(500).json({ error: 'Error fetching supervisor vacaciones' });
  }
});

router.put('/vacaciones/:id', async (req, res) => {
  const { id } = req.params;
  const { FechaInicio, FechaFin } = req.body;

  try {
    const pool = await getConnection();
    await pool.request()
      .input('id', sql.Int, id)
      .input('FechaInicio', sql.Date, FechaInicio)
      .input('FechaFin', sql.Date, FechaFin)
      .query(`
        UPDATE db_accessadmin.VACACIONES
        SET FechaInicio = @FechaInicio, FechaFin = @FechaFin
        WHERE VacacionID = @id
      `);
    res.json({ message: 'Vacaciones actualizadas exitosamente' });
  } catch (error) {
    console.error('Error actualizando vacaciones:', error);
    res.status(500).json({ error: 'Error actualizando vacaciones' });
  }
});

router.put('/vacaciones/:id/approve', async (req, res) => {
  const { id } = req.params;
  const { cod_supervisor } = req.body;

  try {
    const pool = await getConnection();
    await pool.request()
      .input('id', sql.Int, id)
      .input('cod_supervisor', sql.Char, cod_supervisor)
      .query(`
        UPDATE db_accessadmin.VACACIONES
        SET Estado = 'Aprobada', cod_supervisor = @cod_supervisor
        WHERE VacacionID = @id
      `);
    res.json({ message: 'Vacaciones aprobadas exitosamente' });
  } catch (error) {
    console.error('Error aprobando vacaciones:', error);
    res.status(500).json({ error: 'Error aprobando vacaciones' });
  }
});

router.put('/vacaciones/:id/process', async (req, res) => {
  const { id } = req.params;
  const { cod_RRHH, sCod_emp, sdDesde, sdHasta } = req.body;

  // Calcular el número de días de vacaciones
  const fechaInicio = new Date(sdDesde);
  const fechaFin = new Date(sdHasta);
  const iDias = Math.ceil((fechaFin - fechaInicio) / (1000 * 60 * 60 * 24)) + 1;

  try {
    const pool = await getConnection();
    await pool.request()
      .input('sCod_emp', sql.Char(17), sCod_emp)
      .input('sCo_Us_In', sql.Char(250), cod_RRHH)
      .input('sdDesde', sql.SmallDateTime, sdDesde)
      .input('sdHasta', sql.SmallDateTime, sdHasta)
      .input('iDias', sql.Int, iDias)
      .input('VACACIONID', sql.Int, id)
      .execute('dbo.pInsertarVacacion');
    
    res.json({ message: 'Vacaciones procesada exitosamente' });
  } catch (error) {
    console.error('Error procesando vacaciones:', error);
    res.status(500).json({ error: 'Error procesando vacaciones' });
  }
});

router.put('/vacaciones/:id/reject', async (req, res) => {
  const { id } = req.params;

  try {
    const pool = await getConnection();
    await pool.request()
      .input('id', sql.Int, id)
      .query(`
        UPDATE db_accessadmin.VACACIONES
        SET Estado = 'emitida'
        WHERE VacacionID = @id
      `);
    res.json({ message: 'Vacaciones devueltas exitosamente' });
  } catch (error) {
    console.error('Error devolviendo vacaciones:', error);
    res.status(500).json({ error: 'Error devolviendo vacaciones' });
  }
});

router.put('/vacaciones/:id/delete', async (req, res) => {
  const { id } = req.params;

  try {
    const pool = await getConnection();
    await pool.request()
      .input('id', sql.Int, id)
      .query(`
        UPDATE db_accessadmin.VACACIONES
        SET Estado = 'borrado'
        WHERE VacacionID = @id
      `);
    res.json({ message: 'Vacaciones devueltas exitosamente' });
  } catch (error) {
    console.error('Error devolviendo vacaciones:', error);
    res.status(500).json({ error: 'Error devolviendo vacaciones' });
  }
});

router.get('/vacaciones/dias/:cod_emp', async (req, res) => {
  const { cod_emp } = req.params;

  try {
    const pool = await getConnection();
    const causadosResult = await pool.request()
      .input('cod_emp', sql.Char, cod_emp)
      .input('fecha', sql.DateTime, new Date())
      .query(`SELECT dbo.ftSAFindDiasVacaCausadas(@cod_emp, @fecha) AS causados`);

    const disfrutadosResult = await pool.request()
      .input('cod_emp', sql.Char, cod_emp)
      .query(`SELECT dbo.ftSAFindDiasVacaDisfrutados(@cod_emp) AS disfrutados`);

    res.json({
      causados: causadosResult.recordset[0].causados,
      disfrutados: disfrutadosResult.recordset[0].disfrutados
    });
  } catch (error) {
    console.error('Error fetching vacation days:', error);
    res.status(500).json({ error: 'Error fetching vacation days' });
  }
});

router.put('/vacaciones/:id/solicitar', async (req, res) => {
  const { id } = req.params;

  try {
    const pool = await getConnection();
    await pool.request()
      .input('id', sql.Int, id)
      .query(`
        UPDATE db_accessadmin.VACACIONES
        SET Estado = 'solicitada'
        WHERE VacacionID = @id
      `);
    res.json({ message: 'Vacaciones solicitadas exitosamente' });
  } catch (error) {
    console.error('Error solicitando vacaciones:', error);
    res.status(500).json({ error: 'Error solicitando vacaciones' });
  }
});

router.get('/vacaciones/estados', async (req, res) => {
  try {
    const pool = await getConnection();
    const result = await pool.request()
      .query(`
        SELECT DISTINCT Estado
        FROM db_accessadmin.VACACIONES
      `);
    res.json(result.recordset.map(record => record.Estado));
  } catch (error) {
    console.error('Error fetching estados:', error);
    res.status(500).json({ error: 'Error fetching estados' });
  }
});

export default router;