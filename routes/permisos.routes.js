import express from 'express';
import { getConnection, sql } from '../database/connection.js'; 
import { enviarCorreoSolicitudPermiso, enviarCorreoProcesarPermiso, enviarCorreoPermisosProcesados, enviarCorreoPermisoRechazado,enviarCorreoPermisosAprobados} from '../functions/enviocorreo.js';
import { enviarReporteCorreo } from '../functions/reporteEnvioCorreo.js';
import { format } from 'date-fns-tz';
import path from 'path';
import { fileURLToPath } from 'url';
const router = express.Router();
const publicImagesPath = path.join(process.cwd(), 'public', 'images');
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
      .execute('spMostrarPermisosSupervisor');
    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching supervisor vacaciones:', error);
    res.status(500).json({ error: 'Error fetching supervisor vacaciones' });
  }
});

router.get('/permisos/calcularFechaMaximaFin', async (req, res) => {
  const { fechaInicio, dias } = req.query;
  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input('fechaInicio', sql.Date, fechaInicio)
      .input('dias', sql.Int, dias)
      .query('SELECT [dbo].[ftSACalcularFechaMaximaFinVacaciones] (@fechaInicio, @dias) AS fechaFin');
    console.log('Fecha máxima fin calculada:', result.recordset[0].fechaFin);
      res.json({ fechaFin: result.recordset[0].fechaFin });
  } catch (error) {
    console.error('Error calculando fecha máxima fin:', error);
    res.status(500).send('Error calculando fecha máxima fin');
  }
});

// Ruta para crear un nuevo permiso
router.post('/permisos', async (req, res) => {
  const { cod_emp, Fecha_inicio, Fecha_Fin, Titulo, Motivo, descripcion, descontable } = req.body;
  console.log('Request POST received for /permisos');

  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input('cod_emp', sql.Char, cod_emp)
      .input('Fecha_inicio', sql.Date, Fecha_inicio)
      .input('Fecha_Fin', sql.Date, Fecha_Fin)
      .input('Titulo', sql.VarChar, 'Permiso: ' + Motivo)
      .input('Motivo', sql.VarChar, Motivo)
      .input('descripcion', sql.VarChar, descripcion)
      .input('descontable', sql.Bit, descontable)
      .output('STATUS', sql.Int)
      .output('Mensaje', sql.NVarChar)
      .execute('spSolicitarPermisos');

    const status = result.output.STATUS;
    const mensaje = result.output.Mensaje;

    console.log('Resultado del procedimiento:', { status, mensaje });

    if (status !== 1) {
      return res.status(400).json({ status, message: mensaje });
    }

    // Intentar enviar el correo
    let emailSuccess = true;
    try {
      await enviarCorreoSolicitudPermiso(cod_emp, Fecha_inicio, Fecha_Fin, 'Permiso: ' + Motivo, Motivo);
    } catch (error) {
      console.error('Error enviando correo:', error);
      emailSuccess = false;
    }

    res.status(201).json({
      message: mensaje,
      emailError: !emailSuccess,
    });
  } catch (error) {
    console.error('Error al crear permiso:', error);
    res.status(500).json({ status: 4, message: 'Error al crear permiso' });
  }
});

router.get('/permisos/notificacion/Empleado/id/:cod_emp', async (req, res) => {
  const { cod_emp } = req.params;
  console.log('DEVUELTO POR MANTENIMIENTO /permisos/notificacion/Empleado/id/:cod_emp');
  // Endpoint en mantenimiento temporalmente
  return res.status(503).send('Endpoint en mantenimiento temporalmente');
  /* try {
    const pool = await getConnection();
    const result = await pool.request()
      .input('cod_emp', sql.Char, cod_emp)
      .execute('spManejoNotificacionEmpleado');
    res.json(result.recordset);
  } catch (error) {
    console.error('Error al obtener permisos nuevos:', error);
    res.status(500).send('Error al obtener permisos nuevos');
  } */
});

router.get('/permisos/notificacion/Supervisor/:cod_supervisor', async (req, res) => {
  const { cod_supervisor } = req.params;
  console.log('DEVUELTO POR MANTENIMIENTO Request GET received for/permisos/notificacion/Supervisor/:cod_supervisor');
  return res.status(503).send('Endpoint en mantenimiento temporalmente');
  /* try {
    const pool = await getConnection();
    const result = await pool.request()
      .input('cod_supervisor', sql.Char, cod_supervisor)
      .execute('spManejoNotificacionSupervisor');
    res.json(result.recordset);
  } catch (error) {
    console.error('Error al obtener permisos nuevos:', error);
    res.status(500).send('Error al obtener permisos nuevos');
  } */
});

// Ruta para obtener permisos pendientes de un supervisor específico y todos los permisos aprobados de todos los empleados
router.get('/permisos/notificacion/RRHH/:cod_supervisor', async (req, res) => {
  const { cod_supervisor } = req.params
  console.log('DEVUELTO POR MANTENIMIENTO  Request GET received for /permisos/nuevos/:cod_supervisor');
  return res.status(503).send('Endpoint en mantenimiento temporalmente');
  /* try {
    const pool = await getConnection();
    const result = await pool.request()
      .input('cod_supervisor', sql.Char, cod_supervisor)
      .execute('spManejoNotificacionRRHH');
    res.json(result.recordset);
  } catch (error) {
    console.error('Error al obtener permisos nuevos:', error);
    res.status(500).send('Error al obtener permisos nuevos');
  } */
});


// Ruta para aprobar un permiso
router.put('/permisos/:PermisosID/approve', async (req, res) => {
  const { PermisosID } = req.params;
  const { cod_supervisor } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  console.log('Request PUT received for /permisos/:PermisosID/approve');
  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input('PermisosID', sql.Int, PermisosID)
      .input('cod_supervisor', sql.Char, cod_supervisor)
      .output('STATUS', sql.Int)
      .output('RESULTADO', sql.VarChar(2500))
      .execute('sp_AprobarPermiso');

    const status = result.output.STATUS;
    const resultado = result.output.RESULTADO;
    let emailResults = {
      procesarPermiso: true,
      permisosAprobados: true
    };
    console.log('Resultado del procedimiento:', { status, resultado });

    if (status === 1) {
      // Enviar correos y capturar errores individualmente
      try {
        await enviarCorreoProcesarPermiso(PermisosID);
      } catch (error) {
        emailResults.procesarPermiso = false;
        console.error('Error enviando correo procesarPermiso:', error);
      }
      try {
        await enviarCorreoPermisosAprobados(PermisosID);
      } catch (error) {
        emailResults.permisosAprobados = false;
        console.error('Error enviando correo permisosAprobados:', error);
      }
      res.send({ resultado, emailResults });
      await enviarReporteCorreo(
        cod_supervisor,
        ip,
        'Solicitud para Procesar Permisos',
        emailResults,
        format(new Date(), "yyyy-MM-dd'T'HH:mm:ss", { timeZone: 'America/Caracas' })
      );
    } else {
      res.status(400).send({ message: resultado });
    }
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
    const result = await pool.request()
      .input('PermisosID', sql.Int, PermisosID)
      .input('cod_RRHH', sql.Char, cod_RRHH)
      .output('STATUS', sql.Int) 
      .output('RESULTADO', sql.VarChar)
      .execute('spProcesarPermiso');
      const status = result.output.STATUS;
      const resultado = result.output.RESULTADO;
      if (status !== 1) {
        res.status(400).send({ message: resultado });
        return;
      }
      await enviarCorreoPermisosProcesados(PermisosID);
      await transaction.commit();
      res.send('Permiso procesado exitosamente');
  } catch (error) {
    console.error('Error al procesar permiso:', error);
    res.status(500).send(error?.message);
  }
});

// Ruta para rechazar un permiso
router.put('/permisos/:PermisosID/reject1', async (req, res) => {
  const { PermisosID } = req.params;
  const { cod_supervisor } = req.body;

  console.log('Request PUT received for /permisos/:PermisosID/reject1');
  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input('PermisosID', sql.Int, PermisosID)
      .input('cod_supervisor', sql.Char, cod_supervisor)
      .output('STATUS', sql.Int)
      .output('RESULTADO', sql.VarChar(2500))
      .execute('sp_RechazarPermisoPendiente');

    const status = result.output.STATUS;
    const resultado = result.output.RESULTADO;

    if (status === 1) {
      await enviarCorreoPermisoRechazado(PermisosID);
      res.send(resultado);
    } else {
      res.status(400).send(resultado);
    }
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
    const result = await pool.request()
      .input('PermisosID', sql.Int, PermisosID)
      .input('cod_RRHH', sql.Char, cod_supervisor)
      .output('STATUS', sql.Int)
      .output('RESULTADO', sql.VarChar(2500))
      .execute('sp_RechazarPermisoPendienteRRHH');
    const status = result.output.STATUS;
    const resultado = result.output.RESULTADO;

    if (status === 1) {
      await enviarCorreoPermisoRechazado(PermisosID);
      res.send(resultado);
    } else {
      res.status(400).send(resultado);
    }
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
      .execute('[db_accessadmin].[spMostrarPermisosRRHH]')
    res.json(result.recordset);
  } catch (error) {
    console.error('Error obteniendo permisos aprobados y procesados:', error);
    res.status(500).json({ error: 'Error obteniendo permisos aprobados y procesados' });
  }
});


router.get('/permisos/motivos', async (req, res) => {
  console.log('Request GET received for /permisos/motivos');
  try {
    const pool = await getConnection();
    const result = await pool.request()
      .execute('spObtenerMotivosPermisos');
    res.json(result.recordset);
  } catch (error) {
    console.error('Error al obtener motivos de permisos:', error);
    res.status(500).send('Error al obtener motivos de permisos');
  }
});

router.post('/permisos/enviarCorreo', async (req, res) => {
  const { cod_emp, fechaInicio, fechaFin,Titulo,Motivo  } = req.body;

  console.log('Request POST received for /permisos/enviarCorreo');
  console.log('cod_emp:', cod_emp);
  console.log('fechaInicio:', fechaInicio);
  console.log('fechaRetorno:', fechaRetorno);
  console.log('Titulo:', Titulo);
  console.log('Motivo:', Motivo);
  try {
    const pool = await getConnection();

    // Obtener los días de vacaciones
    let dias = await pool.request()
      .input('fechaInicio', sql.Date, fechaInicio)
      .input('fechaFin', sql.Date, fechaFin)
      .query('SELECT [dbo].[ftCalcularDiferenciaDiasVacacionesHabiles] (@fechaInicio, @fechaFin)');

    // Buscar supervisores
    let supervisores = await pool.request()
      .input('cod_emp', sql.Char, cod_emp)
      .input('tipo', sql.Int, 2)
      .execute('[db_accessadmin].[spBuscarSupervisores]');

    // Enviar correos a cada supervisor
    for (const supervisor of supervisores.recordset) {
      if (!supervisor.correo) {
        console.error('Supervisor email is missing:', supervisor);
        continue; // Saltar este supervisor si no tiene correo
      }

      let result = await pool.request()
        .input('cod_emp', sql.Char, cod_emp)
        .input('FechaInicio', sql.Date, fechaInicio)
        .input('FechaFin', sql.Date, fechaFin)
        .input('FechaRetorno', sql.Date, fechaRetorno)
        .input('nombresSupervisor', sql.VarChar, supervisor.nombres)
        .input('apellidosSupervisor', sql.VarChar, supervisor.apellidos)
        .input('Titulo', sql.VarChar, Titulo)
        .input('Motivo', sql.VarChar, Motivo)
        .query('SELECT [dbo].[ftCorreoSolcitudVacaciones] (@cod_emp, @FechaInicio, @FechaFin, @FechaRetorno, @nombresSupervisor, @apellidosSupervisor) AS result');

      const { result: cuerpo, trabajador } = JSON.parse(result.recordset[0].result);

      // Leer el archivo correo_recibo.html
      const templatePath = path.join(__dirname, "../templates/correo_Solicitud_vacaciones.html");
      let htmlContent = fs.readFileSync(templatePath, 'utf8');
      htmlContent = htmlContent.replace('${cuerpo}', cuerpo);

      const mailOptions = {
        from: 'IntranetSegurosAltamira@segurosaltamira.com',
        to: supervisor.correo,
        subject: `Solicitud de Permisos de ${trabajador}`,
        html: htmlContent
      };

      // Enviar el correo directamente
      const emailResult = await sendEmail(mailOptions);
      if (!emailResult.success) {
        return res.status(500).json({ success: false, message: emailResult.message, error: emailResult.error });
      }
    }

    res.json({ success: true, message: 'Emails sent successfully' });
  } catch (error) {
    console.error('Error enviando correos:', error);
    res.status(500).json({ success: false, message: 'Error enviando correos', error });
  }
});

router.get('/permisos/DiasVacacionesNoDisfrutados/:cod_emp', async (req, res) => {
  const { cod_emp } = req.params;
  console.log('Request GET received for /permisos/DiasVacacionesNoDisfrutados/:cod_emp');
  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input('cod_emp', sql.Char, cod_emp)
      .query('SELECT dbo.ftCalcularVacacionesNoDisfrutados(@cod_emp) AS DiasVacasPendientes');
    res.json(result.recordset);
  } catch (error) {
    console.error('Error al obtener permisos:', error);
    res.status(500).send('Error al obtener permisos');
  }
});

export default router;