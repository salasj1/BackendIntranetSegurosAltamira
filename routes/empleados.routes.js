import express from 'express';
import { getConnection, sql } from '../database/connection.js';

const router = express.Router();

// Ruta para obtener todos los empleados
router.get('/empleados', async (req, res) => {
  console.log('Request GET received for /empleados');
  try {
    const pool = await getConnection();
    const result = await pool.request()
      .execute('spObtenerEmpleados'); // Nuevo SP
    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching empleados:', error);
    res.status(500).json({ error: 'Error fetching empleados' });
  }
});

// Ruta para obtener datos de un empleado
/*
router.get('/empleados/id/:cod_emp'), async(req, res){
  try{
    const pool = await getConnection();
    const result = await pool.request()
    .execute()
  }
  catch(error){

  }
}
*/


// Ruta para obtener detalles de supervisión de empleados
router.get('/empleados/control', async (req, res) => {
  console.log('Request GET received for /empleados/control');
  try {
    const pool = await getConnection();
    const result = await pool.request()
      .execute('spObtenerControlSupervision'); // Nuevo SP
    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching empleados detalles:', error);
    res.status(500).json({ error: 'Error fetching empleados detalles' });
  }
});

// Ruta para actualizar el tipo de supervisión
router.put('/empleados/supervision/Tipo', async (req, res) => {
  console.log('Request PUT received for /empleados/supervision/Tipo');
  const { ID_SUPERVISION, Tipo } = req.body;
  try {
    const pool = await getConnection();
    await pool.request()

      .input('ID_SUPERVISION', sql.Int, ID_SUPERVISION)
      .input('Tipo', sql.VarChar, Tipo)
      .query(`
        UPDATE SUPERVISION
        SET Tipo = @Tipo
        WHERE ID_SUPERVISION = @ID_SUPERVISION
      `);
    res.status(200).send('Supervisión actualizada correctamente');
  } catch (error) {
    console.error('Error updating supervision:', error);
    res.status(500).json({ error: 'Error updating supervision' });
  }
});

// Ruta para eliminar el número de teléfono de un empleado
router.put('/empleados/:cod_emp/telefono', async (req, res) => {
  console.log(`Request PUT received for /empleados/${req.params.cod_emp}/telefono`);
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

// Ruta para eliminar el número de teléfono de un empleado
router.delete('/empleados/:cod_emp/telefono', async (req, res) => {
  console.log(`Request DELETE received for /empleados/${req.params.cod_emp}/telefono`);
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

// Ruta para agregar una nueva supervisión
router.post('/empleados/supervision', async (req, res) => {
  console.log('Request POST received for /empleados/supervision');
  const { supervisor, supervisados, tipo } = req.body;

  try {
    const pool = await getConnection();
    const supervisadosXml = `<Supervisados>${supervisados.map(s => `<supervisado>${s}</supervisado>`).join('')}</Supervisados>`;

    await pool.request()
      .input('supervisor', sql.Char, supervisor)
      .input('supervisados', sql.NVarChar, supervisadosXml)
      .input('tipo', sql.VarChar, tipo)
      .execute('spAgregarSupervision');

    res.json({ message: 'Supervisión agregada correctamente' });
  } catch (error) {
    console.error('Error agregando supervisión:', error);
    
    res.status(500).json({ error: 'Error agregando supervisión' });
  }
});


// Ruta para obtener detalles de supervisión de un empleado específico
router.get('/empleados/supervision', async (req, res) => {
  console.log('Request GET received for /empleados/supervision');
  const { cod_emp, cod_supervisor } = req.query;
  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input('cod_emp', sql.VarChar, cod_emp)
      .input('cod_supervisor', sql.VarChar, cod_supervisor)
      .execute('spObtenerSupervisionEmpleado'); // Nuevo SP
    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Supervisión no encontrada' });
    }
    res.json(result.recordset[0]);
  } catch (error) {
    console.error('Error fetching supervision:', error);
    res.status(500).json({ error: 'Error fetching supervision' });
  }
});

// Ruta para eliminar una supervisión
router.delete('/empleados/supervision', async (req, res) => {
  
  const { ID_SUPERVISION } = req.body;
  console.log('Request DELETE received for /empleados/supervision ' + ID_SUPERVISION);
  try {
    const pool = await getConnection();
    await pool.request()
      .input('ID_SUPERVISION', sql.Int, ID_SUPERVISION)
      .query(`
        DELETE FROM SUPERVISION
        WHERE ID_SUPERVISION = @ID_SUPERVISION
      `);
    res.json({ message: 'Supervisión eliminada correctamente' });
  } catch (error) {
    console.error('Error eliminando supervisión:', error);
    res.status(500).json({ error: 'Error eliminando supervisión' });
  }
});

// Nueva ruta para cargar tipos de supervisión
router.get('/empleados/tipos-supervision', async (req, res) => {
  console.log('Request received for /empleados/tipos-supervision');
  try {
    const pool = await getConnection();
    const result = await pool.request().execute('spCargarTipoSupervision');
    res.json(result.recordset);
  } catch (error) {
    console.error('Error cargando tipos de supervisión:', error);
    res.status(500).json({ error: 'Error cargando tipos de supervisión' });
  }
});

router.put('/empleados/supervision/supervisor', async (req, res) => {
  const { ID_SUPERVISION, cod_emp } = req.body; // `cod_emp` es una lista de supervisores
  try {
    const pool = await getConnection();
    console.log('supervisor:', cod_emp); // Verifica el contenido de `cod_emp`
    // Convertir la lista de supervisores en una cadena separada por comas
    if (!cod_emp) {
      return res.status(400).json({ error: 'cod_emp is required' });
    }
    const supervisoresCsv = Array.isArray(cod_emp) ? cod_emp.join(',') : String(cod_emp).split(',').join(',');
    console.log('supervisoresCsv:', supervisoresCsv); // Verifica el contenido de `supervisoresCsv`

    await pool.request()
      .input('ID_SUPERVISION', sql.Int, ID_SUPERVISION)
      .input('Supervisores', sql.NVarChar, supervisoresCsv) // Pasar la cadena CSV
      .execute('spTransferirSupervision'); // Llama al procedimiento almacenado

    res.status(200).send('Supervisores actualizados correctamente');
  } catch (error) {
    console.error('Error al actualizar supervisores:', error);
    res.status(500).json({ error: 'Error al actualizar supervisores' });
  }
});

router.put('/empleados/supervision/cambiar-supervisor', async (req, res) => {
  const { ID_SUPERVISION, cod_emp } = req.body;
  if (!ID_SUPERVISION || !cod_emp) {
    return res.status(400).json({ error: 'ID_SUPERVISION y cod_emp son requeridos' });
  }
  try {
    const pool = await getConnection();
    const idsCsv = Array.isArray(ID_SUPERVISION) ? ID_SUPERVISION.join(',') : String(ID_SUPERVISION);
    const supervisoresCsv = Array.isArray(cod_emp) ? cod_emp.join(',') : String(cod_emp);

    const result = await pool.request()
      .input('IDS', sql.NVarChar, idsCsv)
      .input('SUPERVISORES', sql.NVarChar, supervisoresCsv)
      .output('Status', sql.Int)
      .output('Result', sql.NVarChar(200))
      .execute('spTransferirSupervisionesMasiva');

    const status = result.output.Status;
    const message = result.output.Result;

    if (status && status !== 0) {
      return res.status(400).json({ error: message, status });
    }

    res.status(200).json({ message, status });
  } catch (error) {
    console.error('Error al cambiar supervisores:', error);
    res.status(500).json({ error: 'Error al cambiar supervisores' });
  }
});

// Ruta para listar empleados para RRHH (solo cod_emp, nombre_completo y cedula)
router.get('/empleados/listar', async (req, res) => {
  try {
    const pool = await getConnection();
    const result = await pool.request()
      .execute('spListarEmpleadosRRHH'); // Nuevo SP
    res.json(result.recordset);
  } catch (error) {
    console.error('Error en /empleados/listar:', error);
    res.status(500).json({ error: 'Error al listar empleados' });
  }
});

// Ruta para obtener el nombre completo de un empleado por cod_emp
router.get('/empleados/nombre-completo/:cod_emp', async (req, res) => {
  const { cod_emp } = req.params;
  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input('cod_emp', sql.VarChar, cod_emp)
      .execute('spObtenerNombreCompletoEmpleado'); // Nuevo SP
    if (result.recordset.length > 0) {
      res.json({ nombre_completo: result.recordset[0].nombre_completo });
    } else {
      res.status(404).json({ error: 'Empleado no encontrado' });
    }
  } catch (error) {
    console.error('Error obteniendo nombre completo:', error);
    res.status(500).json({ error: 'Error obteniendo nombre completo' });
  }
});
export default router;