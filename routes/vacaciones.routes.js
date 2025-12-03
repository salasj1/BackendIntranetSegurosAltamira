import express from 'express';
import { getConnection, sql } from '../database/connection.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import {sendEmail } from '../functions/emailQueue.js';
import { enviarCorreoVacacionesAprobadas,enviarCorreoVacacionesRechazadas,enviarCorreoSolicitudVacaciones, enviarCorreoSolicitudPermiso, enviarCorreoProcesarVacaciones, enviarCorreoVacacionesProcesadas } from '../functions/enviocorreo.js';
import {addDays} from 'date-fns';
import { enviarReporteCorreo } from '../functions/reporteEnvioCorreo.js';
import { format } from 'date-fns-tz';
import e from 'express';
const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Se obtienen las vacaciones de un empleado
router.get('/vacaciones/id/:cod_emp', async (req, res) => {
  const { cod_emp } = req.params;
  try {
    const pool = await getConnection();
    pool.requestTimeout = 30000;
    const result = await pool.request()
      .input('cod_emp', sql.Char, cod_emp)
      .execute('[db_accessadmin].[spMostrarVacacionesEmpleado]');
    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching vacaciones:', error);
    res.status(500).json({ error: error.message || 'Error fetching vacaciones' });
  }
});

// Se obtienen las vacaciones aprobadas
router.get('/vacacionesaprobadas', async (req, res) => {

  console.log('Request GET received for /vacacionesaprobadas');

  try {
    const pool = await getConnection();
    const result = await pool.request()
      .execute(`spMostrarVacacionesRRHH`);
    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching vacaciones:', error);
    res.status(500).json({ error: 'Error fetching vacaciones' });
  }
});


router.get('/vacaciones/vacacionesProcesadas/:cod_emp', async (req, res) => {
  const { cod_emp } = req.params;
  console.log('Request GET received for /vacacionesProcesadas');

  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input('cod_emp', sql.Char, cod_emp)
      .execute(`db_accessadmin.spVacacionesProcesadasconFechaRetorno`);
    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching vacaciones:', error);
    res.status(500).json({ error: 'Error fetching vacaciones' });
  }
});

// Se publica una solicitud de vacaciones
// Modificación del endpoint existente para la inserción de la solicitud de vacaciones
router.post('/vacaciones', async (req, res) => {
  const { cod_emp, fechaInicio, fechaFin, fechaRetorno, tipoConfirmacion } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  console.log('Request POST received for /vacaciones');
  console.log('cod_emp:', cod_emp);
  console.log('fechaInicio:', fechaInicio);
  console.log('fechaFin:', fechaFin);
  console.log('fechaRetorno:', fechaRetorno);
  console.log('tipoConfirmacion:', tipoConfirmacion);

  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input('cod_emp', sql.Char, cod_emp)
      .input('FechaInicio', sql.Date, fechaInicio)
      .input('FechaFin', sql.Date, fechaFin)
      .input('FechaRetorno', sql.Date, fechaRetorno)
      .input('TipoResultado', sql.Int, tipoConfirmacion)
      .output('Mensaje', sql.NVarChar)
      .execute('[db_accessadmin].[spSolicitarVacaciones]');

    console.log('Resultado de la consulta:', result);

    // Verificar si hay un mensaje de error en el resultado
    const mensaje = 'exitosamente';

    if (!mensaje.includes('exitosamente')) {
      return res.status(400).json({ message: mensaje });
    }

    // Enviar correos dependiendo del tipo de confirmación
    let emailSuccess = true;
    try {
      if (tipoConfirmacion === 1 || tipoConfirmacion === 3) {
        await enviarCorreoSolicitudVacaciones(cod_emp, fechaInicio, fechaRetorno, fechaFin);
      } else {
        await enviarCorreoSolicitudVacaciones(cod_emp, fechaInicio, fechaFin, fechaRetorno);
        await enviarCorreoSolicitudPermiso(cod_emp, addDays(fechaFin, 1), fechaRetorno, "Días de Vacaciones", "Días de Vacaciones");
      }
    } catch (error) {
      console.error('Error enviando correo:', error);
      emailSuccess = false;
      return res.status(500).json({ message: error.message }); // Enviar el error al cliente
    }

    console.log('Email enviado:', emailSuccess);
    await enviarReporteCorreo(cod_emp, ip, 'Solicitud de Vacaciones', emailSuccess, format(new Date(), "yyyy-MM-dd'T'HH:mm:ss", { timeZone: 'America/Caracas' }));
    return res.status(201).json({
      message: 'Vacaciones registradas exitosamente',
      emailError: !emailSuccess,
    });
   
  } catch (error) {
    console.error('Error registrando vacaciones:', error);

    // Detectar si el error proviene de RAISERROR
    if (error.originalError && error.originalError.info && error.originalError.info.message) {
      return res.status(400).json({ message: error.originalError.info.message });
    }

    return res.status(500).json({ message: error.message || 'Error registrando vacaciones' });
  }
});

// Se obtienen las vacaciones aprobadas para el supervisor para su aprobación
router.get('/vacaciones/supervisor/:cod_supervisor', async (req, res) => {
  const { cod_supervisor } = req.params;

  console.log('Request GET received for /vacaciones/supervisor/:cod_supervisor');

  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input('cod_supervisor', sql.Char, cod_supervisor)
      .execute('spMostrarVacacionesSupervisor');
    res.json(result.recordset);
  } catch (error) {
    console.error('Error al cargar las vacaciones que le han solicitado al supervisor:', error);
    res.status(500).json({ error: 'Error al cargar las vacaciones que le han solicitado al supervisor' });
  }
});

//Se modifica una solicitud de vacaciones cambiandole las fechas
router.put('/vacaciones/:id', async (req, res) => {
  const { id } = req.params;
  const { FechaInicio, FechaFin } = req.body;

  console.log('Request PUT received for /vacaciones/:id');

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

//Se aprueban las vacaciones
router.put('/vacaciones/:id/approve', async (req, res) => {
  const { id } = req.params;
  const { cod_supervisor } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  console.log('Request PUT received for /vacaciones/:id/approve');

  try {
    const pool = await getConnection();
    const transaction = new sql.Transaction(pool);

    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

    const result = await transaction.request()
      .input('id', sql.Int, id)
      .execute('spObtenerEstadoVacacionPorId');

    if (result.recordset.length === 0) {
      await transaction.rollback();
      return res.status(404).send('Vacación no encontrada');
    }

    const vacacion = result.recordset[0];
    if (vacacion.Estado !== 'solicitada' ) {
      await transaction.rollback();
      return res.status(400).send(`La vacación ya ha sido ${vacacion.Estado.toLowerCase()}`);
    }

    await transaction.request()
      .input('id', sql.Int, id)
      .input('cod_supervisor', sql.Char, cod_supervisor)
      .execute('sp_AprobarVacaciones');

    await transaction.commit();
    
      // Enviar correo de procesamiento de vacaciones
    let emailSuccess = true;
    try{
      await enviarCorreoProcesarVacaciones(id);
      await enviarCorreoVacacionesAprobadas(id);
    }catch(error){
       emailSuccess = false;
    }
    await enviarReporteCorreo(cod_supervisor, ip, 'Procesar Vacaciones', emailSuccess, format(new Date(), "yyyy-MM-dd'T'HH:mm:ss", { timeZone: 'America/Caracas' })) ;
    res.send('Vacaciones aprobadas exitosamente');
  } catch (error) {
    console.error('Error aprobando vacaciones:', error);
    res.status(500).send('Error aprobando vacaciones');
  }
});

//Se procesan las vacaciones
router.put('/vacaciones/:id/process', async (req, res) => {
  const { id } = req.params;
  const { cod_RRHH, sCod_emp, sdDesde, sdHasta } = req.body;

  // Calcular el número de días de vacaciones
  const fechaInicio = new Date(sdDesde);
  const fechaFin = new Date(sdHasta);
  const iDias = 0;
  
  console.log('Request PUT received for /vacaciones/:id/process');
  
  try {
    const pool = await getConnection();
    const transaction = new sql.Transaction(pool);

    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

    const result = await transaction.request()
      .input('id', sql.Int, id)
      .execute('spObtenerEstadoVacacionPorId');

    if (result.recordset.length === 0) {
      await transaction.rollback();
      return res.status(404).send('Vacación no encontrada');
    }

    const vacacion = result.recordset[0];
    if (vacacion.Estado !== 'Aprobada') {
      await transaction.rollback();
      return res.status(400).send(`La vacación ya ha sido ${vacacion.Estado.toLowerCase()}`);
    }

    await transaction.request()
      .input('sCod_emp', sql.Char(17), sCod_emp)
      .input('sCo_Us_In', sql.Char(250), cod_RRHH)
      .input('sdDesde', sql.SmallDateTime, sdDesde)
      .input('sdHasta', sql.SmallDateTime, sdHasta)
      .input('iDias', sql.Int, iDias)
      .input('VACACIONID', sql.Int, id)
      .execute('dbo.pInsertarVacacion');

    await transaction.commit();
    
    await enviarCorreoVacacionesProcesadas(id);

    res.send('Vacaciones procesadas exitosamente');
  } catch (error) {
    console.error('Error procesando vacaciones:', error);
    res.status(500).send('Error procesando vacaciones');
  }
});

//Se rechazan las vacaciones en la aprobación
router.put('/vacaciones/:id/reject1', async (req, res) => {
  const { id } = req.params;
  const { cod_supervisor } = req.body;
  try {
    console.log('Request PUT received for /vacaciones/:id/reject1');
    const pool = await getConnection();
    const transaction = new sql.Transaction(pool);

    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

    const result = await transaction.request()
      .input('id', sql.Int, id)
      .execute('spObtenerEstadoVacacionPorId');

    if (result.recordset.length === 0) {
      await transaction.rollback();
      return res.status(404).send('Vacación no encontrada');
    }

    const vacacion = result.recordset[0];
    if (vacacion.Estado !== 'solicitada') {
      await transaction.rollback();
      return res.status(400).send(`La vacación ya ha sido ${vacacion.Estado.toLowerCase()}`);
    }

    await transaction.request()
      .input('id', sql.Int, id)
      .input('cod_supervisor', sql.Char, cod_supervisor)
      .execute('sp_RechazarVacacionesSupervisor');
      await enviarCorreoVacacionesRechazadas(id);
    await transaction.commit();
    res.send('Vacaciones rechazadas exitosamente');
  } catch (error) {
    console.error('Error rechazando vacaciones:', error);
    res.status(500).send('Error rechazando vacaciones');
  }
});

//Se rechazan las vacaciones en la aprobación
router.put('/vacaciones/:id/reject2', async (req, res) => {
  const { id } = req.params;
  const { cod_RRHH } = req.body;
  try {
    console.log('Request PUT received for /vacaciones/:id/reject2');
    const pool = await getConnection();
    const transaction = new sql.Transaction(pool);

    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

    const result = await transaction.request()
      .input('id', sql.Int, id)
      .execute('spObtenerEstadoVacacionPorId');

    if (result.recordset.length === 0) {
      await transaction.rollback();
      return res.status(404).send('Vacación no encontrada');
    }

    const vacacion = result.recordset[0];
    if (vacacion.Estado !== 'Aprobada') {
      await transaction.rollback();
      return res.status(400).send(`La vacación ya ha sido ${vacacion.Estado.toLowerCase()}`);
    }

    await transaction.request()
      .input('id', sql.Int, id)
      .input('cod_RRHH', sql.Char, cod_RRHH)
      .execute('sp_RechazarVacacionesRRHH');
    await enviarCorreoVacacionesRechazadas(id);
    await transaction.commit();
    res.send('Vacaciones rechazadas exitosamente');
  } catch (error) {
    console.error('Error rechazando vacaciones:', error);
    res.status(500).send('Error rechazando vacaciones');
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

// Se modifican las vacaciones emitidas para solicitarlo formalmente al supervisor
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

// Se obtiene la fecha máxima de fin de vacaciones
router.get('/vacaciones/fechaMaximaFin', async (req, res) => {
  const { fechaInicio, diasDisfrutar } = req.query;

  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input('FechaInicio', sql.Date, fechaInicio)
      .input('DiasDisfrutar', sql.Int, diasDisfrutar)
      .query(`
        SELECT dbo.ftSACalcularFechaMaximaFinVacaciones(@FechaInicio, @DiasDisfrutar) AS FechaMaximaFin
      `);
    res.json({ fechaMaximaFin: result.recordset[0].FechaMaximaFin });
  } catch (error) {
    console.error('Error calculando la fecha máxima de fin de vacaciones:', error);
    res.status(500).json({ error: 'Error calculando la fecha máxima de fin de vacaciones' });
  }
});

router.post('/vacaciones/revisionRangoCalendario', async (req, res) => {
  const { fechaInicio, fechaFin, cod_emp, tipoConfirmacion } = req.body;
  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input('COD_EMP', sql.Char, cod_emp)
      .input('FEC_INI', sql.Date, fechaInicio)
      .input('FEC_FIN', sql.Date, fechaFin)
      .input('TIPO', sql.Int, tipoConfirmacion)
      .execute('dbo.spValidarVacacion');

    const { STATUS, RESULTADO } = result.recordset[0];

    if (STATUS === 1) {
      res.json({ status: STATUS, resultado: RESULTADO });
    } else {
      res.status(400).json({ status: STATUS, resultado: RESULTADO });
    }
  } catch (error) {
    console.error('Error revisando el rango de calendario:', error);
    res.status(500).json({ error: 'Error revisando el rango de calendario' });
  }
});

router.get('/vacaciones/CalculrDiasNoDisfrutadosVacaciones/:cod_emp', async (req, res) => {
  const { cod_emp } = req.params;

  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input('cod_emp', sql.Char, cod_emp)
      .query(`
        SELECT dbo.ftCalcularDiferenciaFechasIncluyePermisosSinProcesar(@cod_emp) AS diasNoDisfrutados
      `);
    res.json({ diasNoDisfrutados: result.recordset[0].diasNoDisfrutados });
  } catch (error) {
    console.error('Error calculando los dias no disfrutados:', error);
    res.status(500).json({ error: 'Error calculando los dias no disfrutados' });
  }
});

router.put('/retornoVacaciones', async (req, res) => {
  const { VacacionID, FechaRetorno } = req.body;
  
  if (!VacacionID || isNaN(VacacionID)) {
    return res.status(400).json({ error: 'ID inválido' });
  }

  if (!FechaRetorno) {
    return res.status(400).json({ error: 'Fecha de retorno es requerida' });
  }

  
  try {
    const pool = await getConnection();
    await pool.request()
      .input('VacacionID', sql.Int, VacacionID)
      .input('FechaRetorno', sql.DateTime, FechaRetorno)
      .execute('db_accessadmin.spColocarRetornodeVacaciones');
    res.json({ message: 'Vacaciones devueltas exitosamente' });
  } catch (error) {
    console.error('Error devolviendo vacaciones:', error);
    res.status(500).json({ error: 'Error devolviendo vacaciones', message: error.message});
  }
});

router.post('/vacaciones/enviarCorreo', async (req, res) => {
  const { cod_emp, fechaInicio, fechaFin, fechaRetorno } = req.body;

  console.log('Request POST received for /vacaciones/enviarCorreo');
  console.log('cod_emp:', cod_emp);
  console.log('fechaInicio:', fechaInicio);
  console.log('fechaFin:', fechaFin);
  console.log('fechaRetorno:', fechaRetorno);

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
      .input('tipo', sql.Int, 1)
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
        .query('SELECT [dbo].[ftCorreoSolcitudVacaciones] (@cod_emp, @FechaInicio, @FechaFin, @FechaRetorno, @nombresSupervisor, @apellidosSupervisor) AS result');

      const { result: cuerpo, trabajador } = JSON.parse(result.recordset[0].result);
      const attachments = [
        {
          filename: 'logo.png',
          path: path.join(publicImagesPath, 'logo.png'),
          cid: 'logoEmpresa',
          filename: 'solicitar_vacaciones.png',
          path: path.join(publicImagesPath, 'solicitar_vacaciones.png'),
          cid: 'SolicitudVacaciones'
        }];
      // Leer el archivo correo_recibo.html
      const templatePath = path.join(__dirname, "../templates/correo_Solicitud_vacaciones.html");
      let htmlContent = fs.readFileSync(templatePath, 'utf8');
      htmlContent = htmlContent.replace('${cuerpo}', cuerpo);

      const mailOptions = {
        from: 'IntranetSegurosAltamira@segurosaltamira.com',
        to: 'alejandro.salas@segurosaltamira.com'/* supervisor.correo */,
        subject: `Solicitud de Vacaciones de ${trabajador}`,
        html: htmlContent,
        attachments:attachments
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

router.get('/vacaciones/periodos/id/:cod_emp', async (req, res) => {
  const { cod_emp } = req.params;

  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input('cod_emp', sql.VarChar, cod_emp)
      .execute('[db_accessadmin].[spPeriodosVacaciones]');
    res.json(result.recordset);
  } catch (error) {
    console.error('Error Calculando:', error);
    res.status(500).json({ error: 'Error Calculando', message: error.message });
  }
});



router.get('/vacaciones/InfoConfirmacionSolicitudVacaciones', async (req, res) => {
  const { fechaInicio, fechaFin, fechaRetorno } = req.query;
  console.log('Request GET received for /vacaciones/InfoConfirmacionSolicitudVacaciones');
  
  console.log('fechaInicio:', fechaInicio);
  console.log('fechaRetorno:', fechaRetorno);
  console.log('fechaFin:', fechaFin);
  

  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input('FechaInicio', sql.Date, fechaInicio)
      .input('FechaFin', sql.Date, fechaFin)
      .input('FechaRetorno', sql.Date, fechaRetorno)
      .output('TipoResultado', sql.Int)
      .output('Mensaje', sql.NVarChar)
      .output('DiasADisfrutar',sql.Int)
      .execute('[db_accessadmin].[sp_InfoConfirmacionSolicitudVacaciones]');

    const tipoResultado = result.output.TipoResultado;
    const mensaje = result.output.Mensaje;
    const diasDisfrutar =result.output.DiasADisfrutar;

    res.json({ TipoResultado: tipoResultado, Mensaje: mensaje,diasDisfrutar :diasDisfrutar });
  } catch (error) {
    console.error('Error trayendo el mensaje de confirmación:', error);
    res.status(500).json({ error: 'Hubo un error al querer confirmar la solicitud de vacaciones', message: error.message });
  }
});

router.post('/vacaciones/revisionPeriodo', async (req, res) => {
  const {  periodos } = req.body;
  try {
    console.log('Request POST received for /vacaciones/revisionPeriodo');
    console.log(periodos.join(','));
    const pool = await getConnection();
    const result = await pool.request()
      .input('NumeroPeriodos',sql.Int, periodos.length)
      .input('PERIODOS', sql.VarChar, periodos.join(',')) // Convertir la lista de periodos en una cadena separada por comas
      .execute('db_accessadmin.spVerificarPeriodosSeleccionados');

    const { STATUS, RESULTADO } = result.recordset[0];

    if (STATUS === 1) {
      res.json({ status: STATUS, resultado: RESULTADO });
    } else {
      res.status(400).json({ status: STATUS, resultado: RESULTADO });
    }
  } catch (error) {
    console.error('Error revisando el rango de calendario:', error);
    res.status(500).json({ error: 'Error revisando el rango de calendario' });
  }
});
export default router;