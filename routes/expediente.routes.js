import express from 'express';
import { getConnection, sql } from '../database/connection.js';
import { enviarCorreoSolicitudCambioDatos } from '../functions/enviocorreo.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { enviarCorreoRutograma } from '../functions/enviocorreo.js'; // Asegúrate de tener esta función

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

router.post('/SolicitarCambioDatosPersonales', async (req, res) => {
  const { cod_emp, cedula, nombres, apellidos, rif, edocivil, email, fechaNacimiento, telefonoCelular, direccion, profesion } = req.body;
  console.log(`Request POST received for /SolicitarCambioDatosPersonales `);

  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input('cod_emp', sql.NVarChar, cod_emp)
      .input('cedula', sql.NVarChar, cedula)
      .input('nombres', sql.NVarChar, nombres)
      .input('apellidos', sql.NVarChar, apellidos)
      .input('rif', sql.NVarChar, rif)
      .input('edocivil', sql.NVarChar, edocivil)
      .input('email', sql.NVarChar, email)
      .input('fechaNacimiento', sql.NVarChar, fechaNacimiento)
      .input('telefonoCelular', sql.NVarChar, telefonoCelular)
      .input('direccion', sql.NVarChar, direccion)
      .input('profesion', sql.NVarChar, profesion)
      .execute('spSolicitarCambioDatosPersonales');

    // 1. Responder inmediatamente al cliente para que no espere.
    res.json({
      success: true,
      message: 'Solicitud de cambio enviada correctamente',
      cambios_realizados: result.recordset[0].cambios_realizados
    });

    // 2. Iniciar el proceso de envío de correo en segundo plano.
    // Usamos una función autoejecutable para no bloquear la respuesta.
    (async () => {
      try {
        if (result.recordset && result.recordset[0] && result.recordset[0].cambios_realizados > 0) {
          const pool = await getConnection();
          const cambiosResult = await pool.request()
            .input('cod_emp', sql.NVarChar, cod_emp)
            .query(`SELECT etiqueta, solicitud FROM SOLICITUDCAMBIOEXPEDIENTE WHERE cod_emp = @cod_emp AND status = 0 ORDER BY id DESC`);

          const nombreCompletoOficial = await pool.request()
            .input('cod_emp', sql.NVarChar, cod_emp)
            .query(`SELECT nombres as NombreOficial, apellidos as ApellidoOficial FROM VSNEMPLE WHERE cod_emp = @cod_emp`);

          const { NombreOficial, ApellidoOficial } = nombreCompletoOficial.recordset[0] || {};

          if (cambiosResult.recordset.length > 0) {
            // Asumiendo que tienes una función para enviar el correo.
            await enviarCorreoSolicitudCambioDatos(cod_emp, cambiosResult.recordset, NombreOficial, ApellidoOficial);
            console.log('INFO: Proceso de envío de correo iniciado en segundo plano.');
          }
        }
      } catch (correoError) {
        // Si el envío de correo falla, solo lo registramos en el log del servidor.
        // El usuario no se verá afectado porque ya recibió la confirmación.
        console.error('ERROR (background-task): Falla al enviar correo de solicitud de cambio:', correoError);
      }
    })();

  } catch (error) {
    console.error('ERROR: ' + JSON.stringify(error));
    // Asegurarse de no enviar una respuesta si ya se envió una.
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Error al enviar la solicitud de cambio' });
    }
  }
});

router.post('/rutograma', async (req, res) => {
  // Recibe todos los parámetros del rutograma
  const {
    cod_emp,
    RutaaOficina,
    RutaaCasa,
    horarioTrabajoDesde,
    horarioTrabajoHasta,
    horaSalidaCasa,
    tipoTransporteSeleccionado,
    medioTransporteOtro, // <-- AGREGADO
    tiempoViaje,
    haceEscalas,
    numEscalas,
    haceActividadAntes,
    actividadesSeleccionadas,
    detallesActividades,
    telefonoReferencia,
    nombreReferencia,
    // Regreso
    tipoTransporteSeleccionadoRegreso,
    medioTransporteOtroRegreso, // <-- AGREGADO
    tiempoViajeRegreso,
    haceEscalasRegreso,
    numEscalasRegreso,
    haceActividadAntesRegreso,
    actividadesSeleccionadasRegreso,
    detallesActividadesRegreso,
  } = req.body;

  try {
    const pool = await getConnection();
    console.log(req.body);
    console.log(JSON.stringify(req.body));
    // Guardar rutograma completo (ida y regreso)
    await pool.request()
      .input('cod_emp', sql.Char, cod_emp)
      .input('RutasOficina', sql.NVarChar(sql.MAX), JSON.stringify(RutaaOficina))
      .input('RutasCasa', sql.NVarChar(sql.MAX), JSON.stringify(RutaaCasa))
      .input('HorarioTrabajoDesde', sql.NVarChar(10), horarioTrabajoDesde || null)
      .input('HorarioTrabajoHasta', sql.NVarChar(10), horarioTrabajoHasta || null)
      .input('HoraSalidaCasa', sql.NVarChar(10), horaSalidaCasa || null)
      .input('TipoTransporteSeleccionado', sql.NVarChar(sql.MAX), JSON.stringify(tipoTransporteSeleccionado || []))
      .input('medioTransporteOtro', sql.NVarChar(50), medioTransporteOtro || null) // <-- AGREGADO
      .input('TiempoViaje', sql.NVarChar(20), tiempoViaje || null)
      .input('HaceEscalas', sql.Bit, typeof haceEscalas === 'boolean' ? haceEscalas : null)
      .input('NumEscalas', sql.Int, typeof numEscalas === 'number' ? numEscalas : null)
      .input('HaceActividadAntes', sql.Bit, typeof haceActividadAntes === 'boolean' ? haceActividadAntes : null)
      .input('ActividadesSeleccionadas', sql.NVarChar(sql.MAX), JSON.stringify(actividadesSeleccionadas || []))
      .input('DetallesActividades', sql.NVarChar(sql.MAX), JSON.stringify(detallesActividades || {}))
      .input('TelefonoReferencia', sql.NVarChar(50), telefonoReferencia || null)
      .input('NombreReferencia', sql.NVarChar(100), nombreReferencia || null)
      // Regreso
      .input('TipoTransporteSeleccionadoRegreso', sql.NVarChar(sql.MAX), JSON.stringify(tipoTransporteSeleccionadoRegreso || []))
      .input('medioTransporteOtroRegreso', sql.NVarChar(50), medioTransporteOtroRegreso || null) // <-- AGREGADO
      .input('TiempoViajeRegreso', sql.NVarChar(20), tiempoViajeRegreso || null)
      .input('HaceEscalasRegreso', sql.Bit, typeof haceEscalasRegreso === 'boolean' ? haceEscalasRegreso : null)
      .input('NumEscalasRegreso', sql.Int, typeof numEscalasRegreso === 'number' ? numEscalasRegreso : null)
      .input('HaceActividadAntesRegreso', sql.Bit, typeof haceActividadAntesRegreso === 'boolean' ? haceActividadAntesRegreso : null)
      .input('ActividadesSeleccionadasRegreso', sql.NVarChar(sql.MAX), JSON.stringify(actividadesSeleccionadasRegreso || []))
      .input('DetallesActividadesRegreso', sql.NVarChar(sql.MAX), JSON.stringify(detallesActividadesRegreso || {}))
      .execute('spGuardarRutograma'); // Debes crear/ajustar este SP en SQL

    // 1. Responder inmediatamente al cliente para que no espere.
    res.json({ success: true, message: 'Rutograma guardado correctamente' });

    // 2. Iniciar el proceso de envío de correo en segundo plano.
    (async () => {
      try {
        const bgPool = await getConnection();
        // Ejecutar la función para obtener el JSON del correo de nuevo rutograma
        const correoResult = await bgPool.request()
          .input('cod_emp', sql.Char, cod_emp)
          .query('SELECT dbo.ftCorreoNuevoRutograma(@cod_emp) AS correo_json');

        const correoJsonStr = correoResult.recordset[0]?.correo_json;
        if (!correoJsonStr) {
          console.error('ERROR (background-task): No se pudo generar el correo para el nuevo rutograma.');
          return;
        }

        const correoData = JSON.parse(correoJsonStr);

        // Enviar el correo usando los datos del JSON
        await enviarCorreoRutograma({
          tipo: 'nuevo',
          destinatario: correoData.correo_destinatario,
          subject: correoData.subject,
          body: correoData.body
        });
        console.log('INFO: Correo de nuevo rutograma enviado en segundo plano.');
      } catch (error) {
        console.error('ERROR (background-task): Falla al enviar correo de nuevo rutograma:', error);
      }
    })();

  } catch (error) {
    console.error('ERROR: ' + JSON.stringify(error));
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Error al guardar las rutas' });
    }
  }
});

// Endpoint para listar solicitudes de cambio de datos de un empleado
router.get('/solicitudes-cambio/:cod_emp', async (req, res) => {
  const { cod_emp } = req.params;
  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input('cod_emp', sql.NVarChar, cod_emp)
      .execute('spSolicitudesCambioExpedienteEmpleado');
    // El SP debe devolver: id, cod_emp, etiqueta, solicitud, status
    res.json(result.recordset);
  } catch (error) {
    console.error('Error en /expediente/solicitudes-cambio:', error);
    res.status(500).json({ error: 'Error al obtener solicitudes de cambio' });
  }
});

// Endpoint para obtener los datos personales del empleado desde VSNEMPLE
router.get('/datos-personales/:cod_emp', async (req, res) => {
  const { cod_emp } = req.params;
  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input('cod_emp', sql.NVarChar, cod_emp)
      .execute('spMostrarDatosPersonalesPorEmpleadoVSNEMPLE'); // Nuevo SP
    if (result.recordset.length > 0) {
      res.json({ success: true, datos: result.recordset[0] });
    } else {
      res.status(404).json({ success: false, message: 'No se encontraron datos personales para este empleado' });
    }
  } catch (error) {
    console.error('Error en /expediente/datos-personales:', error);
    res.status(500).json({ success: false, message: 'Error al obtener datos personales' });
  }
});

// Endpoint para obtener las rutas del empleado 
router.get('/rutas/:cod_emp', async (req, res) => {
  const { cod_emp } = req.params;
  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input('cod_emp', sql.NVarChar, cod_emp)
      .execute('spRutasPorEmpleado'); // Nuevo SP
    res.json({ success: true, rutas: result.recordset });
  } catch (error) {
    console.error('Error en /expediente/rutas:', error);
    res.status(500).json({ success: false, message: 'Error al obtener rutas' });
  }
});

router.put('/actualizarDatosPersonales/:id', async (req, res) => {
  const { id } = req.params;


  try {
    const pool = await getConnection();
    await pool.request()
      .input('id', sql.Int, id)
      .execute('spActualizarDatosPersonales')

    res.json({ success: true, message: 'Datos personales actualizados correctamente' });
  } catch (error) {
    console.error('Error al actualizar datos personales:', error);
    res.status(500).json({ success: false, message: 'Error al actualizar datos personales' });
  }
});

router.put('/rechazarSolicitud/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const pool = await getConnection();
    await pool.request()
      .input('id', sql.Int, id)
      .execute('spRechazarSolicitudCambio')

    res.json({ success: true, message: 'Solicitud rechazada correctamente' });
  } catch (error) {
    console.error('Error al rechazar solicitud:', error);
    res.status(500).json({ success: false, message: 'Error al rechazar solicitud' });
  }
});

// Endpoint para listar empleados con solicitudes de cambio y su estatus general
router.get('/empleados-con-solicitudes-cambio', async (req, res) => {
  try {
    const pool = await getConnection();
    const result = await pool.request()
      .execute('spEmpleadosConSolicitudesCambio');
    res.json(result.recordset);
  } catch (error) {
    console.error('Error en /expediente/empleados-con-solicitudes-cambio:', error);
    res.status(500).json({ error: 'Error al obtener empleados con solicitudes de cambio' });
  }
});

// Endpoint para obtener el rutograma completo de un empleado
router.get('/rutograma-completo/:cod_emp', async (req, res) => {
  const { cod_emp } = req.params;
  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input('cod_emp', sql.NVarChar, cod_emp)
      .execute('spObtenerRutogramaCompleto'); // Asumimos que este SP devuelve todos los campos del rutograma

    if (result.recordset && result.recordset.length > 0) {
      const dbData = result.recordset[0];
      // Función para parsear JSON de forma segura
      const parseJsonField = (field) => {
        if (typeof field === 'string') {
          try {
            return JSON.parse(field);
          } catch {
            return []; // Devuelve array vacío si el parseo falla
          }
        }
        return field || []; // Devuelve el campo si no es string, o un array vacío si es null/undefined
      };

      // Helper para transformar el array de detalles de actividad en un objeto
      const transformDetallesActividad = (detallesArray, actividadesSeleccionadas) => {
        if (!Array.isArray(detallesArray) || !Array.isArray(actividadesSeleccionadas) || detallesArray.length !== actividadesSeleccionadas.length) {
          return {};
        }
        const detallesObjeto = {};
        actividadesSeleccionadas.forEach((actividad, index) => {
          const idActividad = actividad.id_tipo_actividad;
          if (idActividad && detallesArray[index]) {
            detallesObjeto[idActividad] = detallesArray[index];
          }
        });
        return detallesObjeto;
      };

      const actividadesSeleccionadasIda = parseJsonField(dbData.ActividadesSeleccionadas);
      const actividadesSeleccionadasRegreso = parseJsonField(dbData.ActividadesSeleccionadasRegreso);

      // Helper para extraer solo la parte de hora (HH:mm) de un string tipo fecha/hora
      const extractTime = (dateString) => {
        if (!dateString) return null;
        const date = new Date(dateString);
        // Si la conversión falla, retorna el string original
        if (isNaN(date.getTime())) return dateString;
        // Extrae horas y minutos con padding
        const hours = String(date.getUTCHours()).padStart(2, '0');
        const minutes = String(date.getUTCMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`;
      };

      const payload = {
        global: {
          id: dbData.id,
          estado: dbData.estado,
          horarioTrabajoDesde: extractTime(dbData.HorarioTrabajoDesde),
          horarioTrabajoHasta: extractTime(dbData.HorarioTrabajoHasta),
          horaSalida: extractTime(dbData.HoraSalidaCasa),
          nombreReferencia: dbData.NombreReferencia,
          telefonoReferencia: dbData.TelefonoReferencia,
          fechaEnvio: dbData.fecha_envio,
          comentarios_revision: dbData.comentarios_revision,
          fecha_aprobacion: dbData.fecha_aprobacion,
          cod_revisor: dbData.cod_revisor,
          nombre_completo_revisor: dbData.nombre_completo_revisor
        },
        ida: {
          rutas: parseJsonField(dbData.RutasOficina),
          tipoTransporteSeleccionado: parseJsonField(dbData.TipoTransporteSeleccionado).map(t => t.id_tipo_vehiculo),
          medioTransporteOtro: dbData.medioTransporteOtro,
          tiempoViaje: dbData.TiempoViaje,
          haceEscalas: dbData.HaceEscalas,
          numEscalas: dbData.NumEscalas,
          haceActividadAntes: dbData.HaceActividadAntes,
          actividadesSeleccionadas: actividadesSeleccionadasIda.map(a => a.id_tipo_actividad),
          detallesActividades: transformDetallesActividad(parseJsonField(dbData.DetallesActividades), actividadesSeleccionadasIda),
        },
        regreso: {
          rutas: parseJsonField(dbData.RutasCasa),
          tipoTransporteSeleccionado: parseJsonField(dbData.TipoTransporteSeleccionadoRegreso).map(t => t.id_tipo_vehiculo),
          medioTransporteOtro: dbData.medioTransporteOtroRegreso,
          tiempoViaje: dbData.TiempoViajeRegreso,
          haceEscalas: dbData.HaceEscalasRegreso,
          numEscalas: dbData.NumEscalasRegreso,
          haceActividadAntes: dbData.HaceActividadAntesRegreso,
          actividadesSeleccionadas: actividadesSeleccionadasRegreso.map(a => a.id_tipo_actividad),
          detallesActividades: transformDetallesActividad(parseJsonField(dbData.DetallesActividadesRegreso), actividadesSeleccionadasRegreso),
        }
      };
      res.json({ success: true, data: payload });

    } else {
      res.status(404).json({ success: false, message: 'No se encontró rutograma para este empleado.' });
    }
  } catch (error) {
    console.error('Error en /expediente/rutograma-completo:', error);
    res.status(500).json({ success: false, message: 'Error al obtener el rutograma.' });
  }
});

// Ruta para obtener los datos del expediente de una ruta (Ida y Regreso)
router.get('/getDatosRutas/:tipo/:cod_emp', async (req, res) => {
  const { cod_emp, tipo } = req.params;
  console.log(`Request GET received for /getDatosRuta/${tipo}/${cod_emp}`);

  if (tipo !== 'Ida' && tipo !== 'Regreso') {
    return res.status(400).json({ success: false, message: 'Tipo de ruta inválido. Debe ser "Ida" o "Regreso".' });
  }

  try {
    const pool = await getConnection();
    const sp = tipo === 'Ida' ? 'spObtenerDatosRutasIda' : 'spObtenerDatosRutaRegreso';
    const result = await pool.request()
      .input('cod_emp', sql.NVarChar, cod_emp)
      .execute(sp);

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

//Ruta para mostrar los tipos de transporte
router.get('/getTiposTransporte', async (req, res) => {
  try {
    const pool = await getConnection();
    const result = await pool.request()
      .execute('spObtenerTiposTransporte');

    if (result.recordset.length > 0) {
      res.json({
        success: true,
        tiposTransporte: result.recordset
      });
    } else {
      res.status(404).json({ success: false, message: 'No se encontraron tipos de transporte' });
    }
  } catch (error) {
    console.error('ERROR: ' + JSON.stringify(error));
    res.status(500).json({ success: false, message: 'Error de conexion' });
  }
});

//Ruta para mostrar las profesiones
router.get('/getProfesiones', async (req, res) => {
  try {
    const pool = await getConnection();
    const result = await pool.request()
      .execute('spObtenerProfesiones');

    if (result.recordset.length > 0) {
      res.json({
        success: true,
        profesiones: result.recordset
      });
    } else {
      res.json({ success: false, message: 'No se encontraron profesiones' });
    }
  } catch (error) {
    console.error('ERROR: ' + JSON.stringify(error));
    res.status(500).json({ success: false, message: 'Error de conexion' });
  }
});

router.get('/getTipoActividadesExtra', async (req, res) => {
  try {
    const pool = await getConnection();
    const result = await pool.request()
      .execute('spObtenerTipoActividadesExtra');

    if (result.recordset.length > 0) {
      res.json({
        success: true,
        tiposActividadesExtra: result.recordset
      });
    } else {
      res.status(404).json({ success: false, message: 'No se encontraron tipos de actividades extra' });
    }
  } catch (error) {
    console.error('ERROR: ' + JSON.stringify(error));
    res.status(500).json({ success: false, message: 'Error de conexion' });
  }
});



// Importaciones necesarias al inicio de tu archivo


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


// =================================================================================
// ENDPOINT DEFINITIVO BASADO EN LA ESTRUCTURA EXACTA DE LA PLANTILLA
// =================================================================================
router.get('/rutograma/:id/preview-pdf', async (req, res) => {
  console.log(`Request GET received for /rutograma/${req.params.id}/preview-pdf`);
  try {
    const { id } = req.params;
    const pool = await getConnection();
    const result = await pool.request()
      .input('id_rutograma', sql.Int, id)
      .execute('[db_accessadmin].[spDatosPDFRutograma]');

    if (!result.recordsets || !result.recordsets[0] || result.recordsets[0].length === 0) {
      return res.status(404).send({ success: false, message: 'Rutograma no encontrado' });
    }

    const datos = result.recordsets[0][0];
    const tiposActividades = result.recordsets[1];
    const tiposTransporteIda = result.recordsets[2];
    const actividadesIda = result.recordsets[3];
    const tiposTransporteRegreso = result.recordsets[4];
    const actividadesRegreso = result.recordsets[5];
    // Mapear los datos al formato que espera el componente de PDF
    const rutogramaData = {
      //datos
      Nombres: datos.NombreCompleto.split(' ')[0] || '',
      Apellidos: datos.NombreCompleto.split(' ').slice(1).join(' ') || '',
      Cedula: datos.Cedula || '',
      Cargo: datos.Cargo || '',
      CentroTrabajo: datos.CentroTrabajo || '',
      DireccionEmpresa: datos.DireccionEmpresa || '',
      DireccionHabitacion: datos.DireccionEmpleado || '',
      Horario: datos.HorarioTrabajo || '',
      ContactoEmergencia: datos.ContactoEmergencia || '',
      // Tipos de Actividades
      tiposActividades: tiposActividades,
      // Ida
      VehiculoIda: tiposTransporteIda,
      HoraSalida: datos.HoraSalidaCasa
        ? (() => {
          const d = new Date(datos.HoraSalidaCasa);
          const h = String(d.getUTCHours()).padStart(2, '0');
          const m = String(d.getUTCMinutes()).padStart(2, '0');
          return `${h}:${m}`;
        })()
        : '',
      EsAmIda: datos.HoraSalidaCasa ? new Date(datos.HoraSalidaCasa).getHours() < 12 : true,
      TiempoViajeIda: datos.TiempoViajeIda || '',
      HaceEscalasIda: datos.HaceEscalasIda,
      NumeroTransferenciasIda: datos.NumEscalasIda || 0,
      DescripcionRutaIda: datos.DescripcionRutaIda || '',
      RutaAlternaIda: datos.DescripcionRutaAlternaIda || '',
      HaceActividadAntesIda: datos.HaceActividadAntesIda,
      ActividadesIda: actividadesIda.map(act => ({
        TipoActividad: act.id_tipo_actividad || 'No especificado',
        otroTipoActividad: act.otro_tipo_actividad || '',
        Descripcion: act.descripcion || '',
        Ubicacion: act.ubicacion || '',
        TiempoAproximado: act.tiempo_aproximado || '',
        Frecuencia: act.frecuencia || '',
        otroTipo: act.otro_tipo_actividad || ''
      })),
      // Regreso

      VehiculoRegreso: tiposTransporteRegreso,
      HoraRegreso: datos.HoraSalidaRegreso ? new Date(datos.HoraSalidaRegreso).getDate().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '',
      EsAmRegreso: datos.HoraSalidaRegreso ? new Date(datos.HoraSalidaRegreso).getHours() < 12 : false,
      TiempoViajeRegreso: datos.TiempoViajeRegreso || '',
      TiempoViajeRegreso: datos.TiempoViajeRegreso || '',
      HaceEscalasRegreso: datos.HaceEscalasRegreso,
      NumeroTransferenciasRegreso: datos.NumEscalasRegreso || 0,
      DescripcionRutaRegreso: datos.DescripcionRutaRegreso || '',
      RutaAlternaRegreso: datos.RutaAlternaRegreso || '',
      HaceActividadAntesRegreso: datos.HaceActividadAntesRegreso,
      ActividadesRegreso: actividadesRegreso.map(act => ({
        TipoActividad: act.id_tipo_actividad || 'No especificado',
        Descripcion: act.descripcion || '',
        Ubicacion: act.ubicacion || '',
        TiempoAproximado: act.tiempo_aproximado || '',
        Frecuencia: act.frecuencia || ''
      }))
    };
    console.log(rutogramaData);
    res.json({ success: true, data: rutogramaData });

  } catch (error) {
    console.error('Error al generar los datos para el PDF del rutograma:', error);
    res.status(500).send({ success: false, message: 'Error interno del servidor al obtener los datos.', error: error.message });
  }
});

router.get('/rutogramaRRHH/SolicitudesRutograma', async (req, res) => {
  try {
    const pool = await getConnection();
    // Establece el timeout a 120 segundos (120000 ms)
    pool.request().timeout = 120000;
    const result = await pool.request()
      .execute('spObtenerSolicitudesRutogramaRRHH');

    res.json({ success: true, data: result.recordset });
  } catch (error) {
    console.error('Error al obtener las solicitudes del rutograma:', error);
    res.status(500).send({ success: false, message: 'Error interno del servidor al obtener las solicitudes.', error: error.message });
  }
});
router.put('/rutograma/aprobar/:id', async (req, res) => {
  const { id } = req.params;
  const { cod_revisor } = req.body;
  try {
    const pool = await getConnection();
    // 1. Ejecutar el SP de aprobación
    await pool.request()
      .input('id_rutograma', sql.Int, id)
      .input('cod_revisor', sql.Char, cod_revisor)
      .execute('spAprobarRutograma');

    // 2. Ejecutar la función para obtener el JSON del correo de aprobación
    const correoResult = await pool.request()
      .input('id_rutograma', sql.Int, id)
      .query('SELECT dbo.ftCorreoAprobarRutograma(@id_rutograma) AS correo_json');

    const correoJsonStr = correoResult.recordset[0]?.correo_json;
    if (!correoJsonStr) {
      return res.status(500).json({ success: false, message: 'No se pudo generar el correo para el rutograma aprobado.' });
    }

    const correoData = JSON.parse(correoJsonStr);

    // 3. Enviar el correo usando los datos del JSON
    try {
      await enviarCorreoRutograma({
        tipo: 'aprobado',
        destinatario: correoData.correo_destinatario,
        subject: correoData.subject,
        body: correoData.body
      });
    } catch (error) {
      console.error('Error enviando correo de aprobación de rutograma:', error);
      // No detenemos la respuesta por error de correo
    }

    res.json({ success: true, destinatario: correoData.correo_destinatario, message: 'Rutograma aprobado correctamente' });
  } catch (error) {
    console.error('Error al aprobar el rutograma:', error);
    res.status(500).send({ success: false, message: 'Error interno del servidor al aprobar el rutograma.', error: error.message });
  }
});

// Nuevo endpoint para devolver rutograma con comentarios
router.put('/rutograma-devolver', async (req, res) => {
  const { id_rutograma, comentarios_revision, cod_revisor } = req.body;
  try {
    const pool = await getConnection();
    await pool.request()
      .input('id_rutograma', sql.Int, id_rutograma)
      .input('comentarios_revision', sql.NVarChar, comentarios_revision)
      .input('cod_revisor', sql.Char, cod_revisor)
      .execute('spDevolverRutograma');
    // 2. Ejecutar la función para obtener el JSON del correo
    const correoResult = await pool.request()
      .input('id_rutograma', sql.Int, id_rutograma)
      .query('SELECT dbo.ftCorreoDevolverRutograma(@id_rutograma) AS correo_json');

    const correoJsonStr = correoResult.recordset[0]?.correo_json;
    if (!correoJsonStr) {
      return res.status(500).json({ success: false, message: 'No se pudo generar el correo para el rutograma devuelto.' });
    }

    const correoData = JSON.parse(correoJsonStr);

    // 3. Enviar el correo usando los datos del JSON
    try {
      await enviarCorreoRutograma({
        tipo: 'devuelto',
        destinatario: correoData.correo_destinatario,
        subject: correoData.subject,
        body: correoData.body
      });
    } catch (error) {
      console.error('Error enviando correo de devolución de rutograma:', error);
      // No detenemos la respuesta por error de correo
    }

    res.json({ success: true, destinatario: correoData.correo_destinatario });
  } catch (error) {
    console.error('Error en /expediente/rutograma-devolver:', error);
    res.status(500).send({ success: false, message: 'Error interno del servidor al devolver el rutograma.', error: error.message });
  }
});
export default router;