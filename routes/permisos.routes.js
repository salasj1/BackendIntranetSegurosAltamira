import express from 'express';
import { getConnection, sql } from '../database/connection.js'; 

const router = express.Router();

// Ruta para obtener permisos de un empleado específico
router.get('/permisos/id/:cod_emp', async (req, res) => {
  const { cod_emp } = req.params;
  console.log('Request GET received for /permisos/id/:cod_emp');
  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input('cod_emp', sql.Char, cod_emp)
      .query('SELECT * FROM [db_accessadmin].[PERMISOS] WHERE cod_emp = @cod_emp');
    res.json(result.recordset);
  } catch (error) {
    console.error('Error al obtener permisos:', error);
    res.status(500).send('Error al obtener permisos');
  }
});


// Ruta para obtener permisos de un empleado específico
router.get('/permisos/supervisor/:cod_supervisor', async (req, res) => {
  const { cod_supervisor } = req.params;
  console.log('Request GET received for /permisos/supervisor/:cod_supervisor');
  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input('cod_supervisor', sql.Char, cod_supervisor)
      .query(`
          SELECT DISTINCT
          P.PermisosID,
          P.Fecha_inicio,
          P.Fecha_Fin,
          P.Estado,
          P.Titulo,
          P.Motivo,
          P.descripcion,
          P.cod_emp,
          P.cod_supervisor,
          P.cod_RRHH,
          E.ci,
          E.nombres,
          E.apellidos,
          E.des_depart AS departamento,
          E.des_cargo AS cargo
          FROM db_accessadmin.PERMISOS P
          JOIN dbo.VSNEMPLE E ON P.cod_emp COLLATE SQL_Latin1_General_CP1_CI_AS = E.cod_emp COLLATE SQL_Latin1_General_CP1_CI_AS
          JOIN db_accessadmin.SUPERVISION S ON P.cod_emp COLLATE SQL_Latin1_General_CP1_CI_AS = S.Cod_emp COLLATE SQL_Latin1_General_CP1_CI_AS
          WHERE S.Cod_supervisor COLLATE SQL_Latin1_General_CP1_CI_AS = @cod_supervisor
          AND P.Estado IN ('Aprobada', 'Pendiente','Rechazada','Procesada') AND S.Tipo=2
      `);
    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching supervisor vacaciones:', error);
    res.status(500).json({ error: 'Error fetching supervisor vacaciones' });
  }
});

// Ruta para crear un nuevo permiso
router.post('/permisos', async (req, res) => {
  const { cod_emp, Fecha_inicio, Fecha_Fin, Titulo, Motivo, descripcion } = req.body;
  console.log('Request POST received for /permisos');
  try {
    const pool = await getConnection();
    await pool.request()
      .input('cod_emp', sql.Char, cod_emp)
      .input('Fecha_inicio', sql.Date, Fecha_inicio)
      .input('Fecha_Fin', sql.Date, Fecha_Fin)
      .input('Titulo', sql.VarChar, Titulo)
      .input('Motivo', sql.VarChar, Motivo)
      .input('descripcion', sql.VarChar, descripcion)
      .query(
        `INSERT INTO [db_accessadmin].[PERMISOS] (cod_emp, Fecha_inicio, Fecha_Fin, Titulo, Motivo, Estado, descripcion)
         VALUES (@cod_emp, @Fecha_inicio, @Fecha_Fin, @Titulo, @Motivo, 'Pendiente', @descripcion)`
      );
    res.status(201).send('Permiso creado exitosamente');
  } catch (error) {
    console.error('Error al crear permiso:', error);
    res.status(500).send('Error al crear permiso');
  }
});

router.get('/permisos/notificacion/Supervisor/:cod_supervisor', async (req, res) => {
  const { cod_supervisor } = req.params;
  console.log('Request GET received for /permisos/notificacion/Supervisor/:cod_supervisor');
  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input('cod_supervisor', sql.Char, cod_supervisor)
      .query(`
        SELECT 
            P.PermisosID,
            P.Estado,
            P.Titulo,
            P.cod_emp,
            E.ci,
            E.nombres,
            E.apellidos
        FROM 
            db_accessadmin.PERMISOS P
        JOIN 
            dbo.VSNEMPLE E ON P.cod_emp COLLATE SQL_Latin1_General_CP1_CI_AS = E.cod_emp COLLATE SQL_Latin1_General_CP1_CI_AS
        JOIN 
            db_accessadmin.SUPERVISION S ON P.cod_emp COLLATE SQL_Latin1_General_CP1_CI_AS = S.Cod_emp COLLATE SQL_Latin1_General_CP1_CI_AS
        WHERE 
            S.Cod_supervisor COLLATE SQL_Latin1_General_CP1_CI_AS = @cod_supervisor
            AND P.Estado IN ('Pendiente')
        UNION
        SELECT 
            P.PermisosID,
            P.Estado,
            P.Titulo,
            P.cod_emp,
            E.ci,
            E.nombres,
            E.apellidos
        FROM 
            db_accessadmin.PERMISOS P
        JOIN 
            dbo.VSNEMPLE E ON P.cod_emp COLLATE SQL_Latin1_General_CP1_CI_AS = E.cod_emp COLLATE SQL_Latin1_General_CP1_CI_AS
        WHERE 
            P.cod_emp = @cod_supervisor
            AND P.Estado IN ('Aprobada','Rechazada');
      `);
    res.json(result.recordset);
  } catch (error) {
    console.error('Error al obtener permisos nuevos:', error);
    res.status(500).send('Error al obtener permisos nuevos');
  }
});

// Ruta para obtener permisos pendientes de un supervisor específico y todos los permisos aprobados de todos los empleados
router.get('/permisos/nuevos/:cod_supervisor', async (req, res) => {
  const { cod_supervisor } = req.params
  console.log('Request GET received for /permisos/nuevos/:cod_supervisor');
  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input('cod_supervisor', sql.Char, cod_supervisor)
      .query(`
        SELECT 
          P.PermisosID,
          P.Fecha_inicio,
          P.Fecha_Fin,
          P.Estado,
          P.Titulo,
          P.Motivo,
          P.descripcion,
          P.cod_emp,
          P.cod_supervisor,
          P.cod_RRHH,
          E.ci,
          E.nombres,
          E.apellidos
        FROM db_accessadmin.PERMISOS P
        JOIN dbo.VSNEMPLE E ON P.cod_emp COLLATE SQL_Latin1_General_CP1_CI_AS = E.cod_emp COLLATE SQL_Latin1_General_CP1_CI_AS
        JOIN db_accessadmin.SUPERVISION S ON P.cod_emp COLLATE SQL_Latin1_General_CP1_CI_AS = S.Cod_emp COLLATE SQL_Latin1_General_CP1_CI_AS
        WHERE S.Cod_supervisor COLLATE SQL_Latin1_General_CP1_CI_AS = @cod_supervisor
        AND P.Estado IN ('Pendiente', 'Aprobada')
        UNION
        SELECT 
          P.PermisosID,
          P.Fecha_inicio,
          P.Fecha_Fin,
          P.Estado,
          P.Titulo,
          P.Motivo,
          P.descripcion,
          P.cod_emp,
          P.cod_supervisor,
          P.cod_RRHH,
          E.ci,
          E.nombres,
          E.apellidos
        FROM db_accessadmin.PERMISOS P
        JOIN dbo.VSNEMPLE E ON P.cod_emp COLLATE SQL_Latin1_General_CP1_CI_AS = E.cod_emp COLLATE SQL_Latin1_General_CP1_CI_AS
        WHERE P.Estado IN ('Aprobada','Rechazada') and P.cod_emp=@cod_supervisor
      `);
    res.json(result.recordset);
  } catch (error) {
    console.error('Error al obtener permisos nuevos:', error);
    res.status(500).send('Error al obtener permisos nuevos');
  }
});


// Ruta para aprobar un permiso
router.put('/permisos/:PermisosID/approve', async (req, res) => {
  const { PermisosID } = req.params;
  const { cod_supervisor } = req.body;

  console.log('Request PUT received for /permisos/:PermisosID/approve');
  try {
    const pool = await getConnection();
    const transaction = new sql.Transaction(pool);

    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

    const result = await transaction.request()
      .input('PermisosID', sql.Int, PermisosID)
      .query('SELECT Estado FROM [db_accessadmin].[PERMISOS] WHERE PermisosID = @PermisosID');

    if (result.recordset.length === 0) {
      await transaction.rollback();
      return res.status(404).send('Permiso no encontrado');
    }

    const permiso = result.recordset[0];
    if (permiso.Estado !== 'Pendiente') {
      await transaction.rollback();
      return res.status(400).send(`El permiso ya ha sido ${permiso.Estado.toLowerCase()}`);
    }

    await transaction.request()
      .input('PermisosID', sql.Int, PermisosID)
      .input('cod_supervisor', sql.Char, cod_supervisor)
      .query('UPDATE [db_accessadmin].[PERMISOS] SET Estado = \'Aprobada\', cod_supervisor = @cod_supervisor WHERE PermisosID = @PermisosID');

    await transaction.commit();
    res.send('Permiso aprobado exitosamente');
  } catch (error) {
    console.error('Error al aprobar permiso:', error);
    res.status(500).send('Error al aprobar permiso');
  }
});

// Ruta para procesar un permiso
router.put('/permisos/:PermisosID/process', async (req, res) => {
  const { PermisosID } = req.params;
  const { cod_RRHH } = req.body;

  console.log('Request PUT received for /permisos/:PermisosID/process');
  try {
    const pool = await getConnection();
    const transaction = new sql.Transaction(pool);

    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

    const result = await transaction.request()
      .input('PermisosID', sql.Int, PermisosID)
      .query('SELECT Estado FROM [db_accessadmin].[PERMISOS] WHERE PermisosID = @PermisosID');

    if (result.recordset.length === 0) {
      await transaction.rollback();
      return res.status(404).send('Permiso no encontrado');
    }

    const permiso = result.recordset[0];
    if (permiso.Estado !== 'Aprobada') {
      await transaction.rollback();
      return res.status(400).send(`El permiso ya ha sido ${permiso.Estado.toLowerCase()}`);
    }

    await transaction.request()
      .input('PermisosID', sql.Int, PermisosID)
      .input('cod_RRHH', sql.Char, cod_RRHH)
      .query('UPDATE [db_accessadmin].[PERMISOS] SET Estado = \'Procesada\', cod_RRHH = @cod_RRHH WHERE PermisosID = @PermisosID');

    await transaction.commit();
    res.send('Permiso procesado exitosamente');
  } catch (error) {
    console.error('Error al procesar permiso:', error);
    res.status(500).send('Error al procesar permiso');
  }
});

// Ruta para rechazar un permiso
router.put('/permisos/:PermisosID/reject1', async (req, res) => {
  const { PermisosID } = req.params;
  const { cod_supervisor } = req.body;

  console.log('Request PUT received for /permisos/:PermisosID/reject1');
  try {
    const pool = await getConnection();
    const transaction = new sql.Transaction(pool);

    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

    const result = await transaction.request()
      .input('PermisosID', sql.Int, PermisosID)
      .query('SELECT Estado FROM [db_accessadmin].[PERMISOS] WHERE PermisosID = @PermisosID');

    if (result.recordset.length === 0) {
      await transaction.rollback();
      return res.status(404).send('Permiso no encontrado');
    }

    const permiso = result.recordset[0];
    if (permiso.Estado !== 'Pendiente') {
      await transaction.rollback();
      return res.status(400).send(`El permiso ya ha sido ${permiso.Estado.toLowerCase()}`);
    }

    await transaction.request()
      .input('PermisosID', sql.Int, PermisosID)
      .input('cod_supervisor', sql.Char, cod_supervisor)
      .query('UPDATE [db_accessadmin].[PERMISOS] SET Estado = \'Rechazada\', cod_supervisor = @cod_supervisor WHERE PermisosID = @PermisosID');

    await transaction.commit();
    res.send('Permiso rechazado exitosamente');
  } catch (error) {
    console.error('Error al rechazar permiso:', error);
    res.status(500).send('Error al rechazar permiso');
  }
});

// Ruta para rechazar un permiso
router.put('/permisos/:PermisosID/reject2', async (req, res) => {
  const { PermisosID } = req.params;
  const { cod_supervisor } = req.body;

  console.log('Request PUT received for /permisos/:PermisosID/reject2');
  try {
    const pool = await getConnection();
    const transaction = new sql.Transaction(pool);

    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

    const result = await transaction.request()
      .input('PermisosID', sql.Int, PermisosID)
      .query('SELECT Estado FROM [db_accessadmin].[PERMISOS] WHERE PermisosID = @PermisosID');

    if (result.recordset.length === 0) {
      await transaction.rollback();
      return res.status(404).send('Permiso no encontrado');
    }

    const permiso = result.recordset[0];
    if (permiso.Estado !== 'Aprobada') {
      await transaction.rollback();
      return res.status(400).send(`El permiso ya ha sido ${permiso.Estado.toLowerCase()}`);
    }

    await transaction.request()
      .input('PermisosID', sql.Int, PermisosID)
      .input('cod_supervisor', sql.Char, cod_supervisor)
      .query('UPDATE [db_accessadmin].[PERMISOS] SET Estado = \'Rechazada\', cod_supervisor = @cod_supervisor WHERE PermisosID = @PermisosID');

    await transaction.commit();
    res.send('Permiso rechazado exitosamente');
  } catch (error) {
    console.error('Error al rechazar permiso:', error);
    res.status(500).send('Error al rechazar permiso');
  }
});

// Nueva ruta para obtener permisos aprobados y procesados
router.get('/permisos/aprobadosProcesados', async (req, res) => {
  console.log('Request GET received for /permisos/aprobadosProcesados');
  try {
    const pool = await getConnection();
    const result = await pool.request()
      .query(`
        SELECT DISTINCT
          P.PermisosID,
          P.Fecha_inicio,
          P.Fecha_Fin,
          P.Estado,
          P.cod_emp,
          P.cod_supervisor,
          P.Titulo,
          P.Motivo,
          P.Estado,
          P.descripcion,
          E.nombre_completo,
          E.nombres,
          E.apellidos,
          E.ci,
          E.des_depart AS departamento,
          E.des_cargo AS cargo
        FROM db_accessadmin.PERMISOS P
        JOIN dbo.VSNEMPLE E ON P.cod_emp COLLATE SQL_Latin1_General_CP1_CI_AS = E.cod_emp COLLATE SQL_Latin1_General_CP1_CI_AS
        WHERE P.Estado IN ('Aprobada', 'Procesada','Rechazada')
      `);
    res.json(result.recordset);
  } catch (error) {
    console.error('Error obteniendo permisos aprobados y procesados:', error);
    res.status(500).json({ error: 'Error obteniendo permisos aprobados y procesados' });
  }
});

export default router;