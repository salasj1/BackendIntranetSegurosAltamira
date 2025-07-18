import express from 'express';
import { getConnection, sql } from '../database/connection.js';
import { enviarCorreoSolicitudCambioDatos } from '../functions/enviocorreo.js';

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

router.post('/SolicitarCambioDatosPersonales', async (req, res) => {
    const { cod_emp, cedula, nombres, apellidos, rif, edocivil, email, fechaNacimiento, telefonoCelular, direccion } = req.body;
    console.log(`Request POST received for /SolicitarCambioDatosPersonales with cod_emp: ${cod_emp}, cedula: ${cedula}, nombres: ${nombres}, apellidos: ${apellidos}, rif: ${rif}, edocivil: ${edocivil}, email: ${email}, fechaNacimiento: ${fechaNacimiento}, telefonoCelular: ${telefonoCelular}, direccion: ${direccion}`);

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
            .execute('spSolicitarCambioDatosPersonales');

        // Buscar los cambios realizados para el correo
        const cambios = [];
        if (result.recordset && result.recordset[0] && result.recordset[0].cambios_realizados > 0) {
            // Consultar los cambios pendientes recién insertados
            const cambiosResult = await pool.request()
                .input('cod_emp', sql.NVarChar, cod_emp)
                .query(`SELECT etiqueta, solicitud FROM SOLICITUDCAMBIOEXPEDIENTE WHERE cod_emp = @cod_emp AND status = 0 ORDER BY id DESC`);
            cambios.push(...cambiosResult.recordset);
        }
        const nombreCompletoOficial = await pool.request()
                .input('cod_emp', sql.NVarChar, cod_emp)
                .query(`SELECT nombres as NombreOficial,apellidos  as ApellidoOficial FROM VSNEMPLE WHERE cod_emp = @cod_emp`);
        const { NombreOficial, ApellidoOficial } = nombreCompletoOficial.recordset[0] || {};

        // Enviar correo solo si hubo cambios
        if (cambios.length > 0) {
            try {
                await enviarCorreoSolicitudCambioDatos(cod_emp, cambios, NombreOficial, ApellidoOficial);
            } catch (correoError) {
                console.error('Error enviando correo de solicitud de cambio de datos:', correoError);
            }
        }

        res.json({ 
            success: true, 
            message: 'Solicitud de cambio enviada correctamente' ,
            cambios_realizados: result.recordset[0].cambios_realizados
        });
    } catch (error) {
        console.error('ERROR: ' + JSON.stringify(error));
        res.status(500).json({ success: false, message: 'Error al enviar la solicitud de cambio' });
    }
});

router.post('/guardarRutas', async (req, res) => {
  const { cod_emp, RutaaOficina, RutaaCasa } = req.body;

  try {
    const pool = await getConnection();
console.log('RutasOficina',RutaaOficina)
        console.log('RutasCasa',RutaaCasa)

    await pool.request()

      

      .input('cod_emp', sql.Char, cod_emp)
      .input('RutasOficina', sql.NVarChar(sql.MAX),  JSON.stringify(RutaaOficina))
      .input('RutasCasa', sql.NVarChar(sql.MAX), JSON.stringify(RutaaCasa))
      .execute('spGuardarRutas');
    res.json({ success: true });
  } catch (error) {
    console.error('ERROR: ' + JSON.stringify(error));
    res.status(500).json({ success: false, message: 'Error al guardar las rutas' });
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

export default router;