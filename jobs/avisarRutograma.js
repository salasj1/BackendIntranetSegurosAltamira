/**
 * Job: avisarRutograma.js
 *
 * Cron que se ejecuta cada miércoles a las 8:00 AM (America/Caracas).
 * Envía un correo de aviso a todos los empleados activos sin rutograma registrado.
 *
 * El estado de la campaña (contador de ejecuciones) se persiste en la tabla
 * [db_accessadmin].[CAMPANAS_CORREO] de SQL Server para sobrevivir reinicios del servidor.
 *
 * Flujo:
 *  1. Al iniciar el servidor, busca en BD si hay una campaña de rutograma activa.
 *  2. Si no existe o ya alcanzó el límite de ejecuciones → no programa el cron.
 *  3. Si está activa → programa el cron para cada miércoles a las 8:00 AM.
 *  4. Al dispararse el cron:
 *     a. Vuelve a leer la campaña desde BD (por si el servidor se reinició).
 *     b. Si ya se completó → detiene el job y sale.
 *     c. Si aún está activa → envía los correos.
 *     d. Incrementa el contador en BD.
 *     e. Si ahora llega al límite → marca la campaña como inactiva y detiene el job.
 */

import cron from 'node-cron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { getConnection, sql } from '../database/connection.js';
import { sendMailWithRetry } from '../functions/transporter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEMPLATE_PATH = path.join(__dirname, '../templates/correo_Aviso_Rutograma.html');
const LOGO_PATH = path.join(process.cwd(), 'public', 'images', 'logo.png');
const GIF_PATH = path.join(process.cwd(), 'public', 'images', 'mapa.gif');
const BASE_URL = process.env.BASE_URL || '';

// Nombre de la campaña activa — debe coincidir con el registro en CAMPANAS_CORREO
const NOMBRE_CAMPANA = 'RUTOGRAMA_2026_Q2';

// ─────────────────────────────────────────────
// Helpers de base de datos
// ─────────────────────────────────────────────

/** Obtiene la campaña activa por nombre. Retorna null si no existe. */
async function obtenerCampana(pool) {
  const result = await pool.request()
    .input('nombre', sql.NVarChar(100), NOMBRE_CAMPANA)
    .query(`
      SELECT id, ejecuciones, max_ejecuciones, activa
      FROM [db_accessadmin].[CAMPANAS_CORREO]
      WHERE nombre = @nombre
    `);
  return result.recordset[0] ?? null;
}

/** Incrementa el contador de ejecuciones y, si se alcanzó el límite, desactiva la campaña. */
async function registrarEjecucion(pool, campana) {
  const nuevasEjecuciones = campana.ejecuciones + 1;
  const completada = nuevasEjecuciones >= campana.max_ejecuciones;

  await pool.request()
    .input('id', sql.Int, campana.id)
    .input('ejecuciones', sql.Int, nuevasEjecuciones)
    .input('activa', sql.Bit, completada ? 0 : 1)
    .query(`
      UPDATE [db_accessadmin].[CAMPANAS_CORREO]
      SET ejecuciones = @ejecuciones,
          activa      = @activa
      WHERE id = @id
    `);

  return { nuevasEjecuciones, completada };
}

/** Trae los empleados activos sin rutograma usando el stored procedure existente. */
async function obtenerEmpleadosSinRutograma(pool) {
  const result = await pool.request().execute('SP_ObtenerEmpleadosSinRutograma');
  return result.recordset;
}

// ─────────────────────────────────────────────
// Lógica principal de envío
// ─────────────────────────────────────────────

async function ejecutarEnvioRutograma(job) {
  console.log('[avisarRutograma] Cron disparado —', new Date().toLocaleString('es-VE'));

  let pool;
  try {
    pool = await getConnection();
  } catch (err) {
    console.error('[avisarRutograma] Error de conexión a BD:', err.message);
    return;
  }

  // Re-leer la campaña desde BD (por si el servidor se reinició entre ejecuciones)
  const campana = await obtenerCampana(pool);

  if (!campana || !campana.activa || campana.ejecuciones >= campana.max_ejecuciones) {
    console.log('[avisarRutograma] La campaña ya fue completada o está inactiva. Deteniendo job.');
    job.stop();
    return;
  }

  console.log(`[avisarRutograma] Ejecución ${campana.ejecuciones + 1} de ${campana.max_ejecuciones}`);

  // Obtener empleados
  let empleados = [];
  try {
    empleados = await obtenerEmpleadosSinRutograma(pool);
  } catch (err) {
    console.error('[avisarRutograma] Error al obtener empleados:', err.message);
    return;
  }

  if (empleados.length === 0) {
    console.log('[avisarRutograma] Todos los empleados ya tienen rutograma. No se envían correos.');
  } else {
    const plantillaBase = fs.readFileSync(TEMPLATE_PATH, 'utf8');
    const anio = new Date().getFullYear();
    const formatoTitulo = (texto) =>
      texto ? texto.charAt(0).toUpperCase() + texto.slice(1).toLowerCase() : '';

    let enviados = 0;
    let fallidos = 0;

    for (const emp of empleados) {
      const primerNombre = emp.nombres ? emp.nombres.trim().split(/\s+/)[0] : '';
      const primerApellido = emp.apellidos ? emp.apellidos.trim().split(/\s+/)[0] : '';
      const nombreCompleto = `${formatoTitulo(primerNombre)} ${formatoTitulo(primerApellido)}`.trim();

      const html = plantillaBase
        .replace(/\${nombre_completo}/g, nombreCompleto)
        .replace(/\${BASE_URL}/g, BASE_URL)
        .replace(/\${anio}/g, anio);

      const mailOptions = {
        from: '"Intranet Seguros Altamira" <IntranetSegurosAltamira@segurosaltamira.com>',
        to: emp.correo_e,
        subject: 'Recordatorio: Debes completar tu Rutograma',
        html,
        attachments: [
          {
            filename: 'logo.png',
            path: LOGO_PATH,
            cid: 'logoEmpresa',
            contentType: 'image/png',
            contentDisposition: 'inline',
          },
          {
            filename: 'mapa.gif',
            path: GIF_PATH,
            cid: 'revisionRutograma',
            contentType: 'image/gif',
            contentDisposition: 'inline',
          },
        ],
      };

      const resultado = await sendMailWithRetry(mailOptions);
      if (resultado.success) {
        console.log(`[OK]   ${emp.correo_e} — ${nombreCompleto}`);
        enviados++;
      } else {
        console.error(`[FAIL] ${emp.correo_e} — ${nombreCompleto}:`, resultado.error?.message);
        fallidos++;
      }
    }
    console.log(`[avisarRutograma] Resumen: ${enviados} enviados, ${fallidos} fallidos de ${empleados.length} total.`);
  }

  // Registrar la ejecución en BD
  const { nuevasEjecuciones, completada } = await registrarEjecucion(pool, campana);

  if (completada) {
    console.log(`[avisarRutograma] Campaña "${NOMBRE_CAMPANA}" completada (${nuevasEjecuciones}/${campana.max_ejecuciones} ejecuciones). Deteniendo job.`);
    job.stop();
  } else {
    console.log(`[avisarRutograma] Ejecuciones completadas: ${nuevasEjecuciones}/${campana.max_ejecuciones}. Próximo miércoles.`);
  }
}

// ─────────────────────────────────────────────
// Exportable: registrar el cron al iniciar el servidor
// ─────────────────────────────────────────────

export async function avisarRutograma() {
  let pool;
  try {
    pool = await getConnection();
  } catch (err) {
    console.error('[avisarRutograma] No se pudo conectar a BD al iniciar:', err.message);
    return;
  }

  const campana = await obtenerCampana(pool);

  if (!campana) {
    console.log(`[avisarRutograma] No existe campaña "${NOMBRE_CAMPANA}" en BD. Job no registrado.`);
    return;
  }

  if (!campana.activa || campana.ejecuciones >= campana.max_ejecuciones) {
    console.log(`[avisarRutograma] Campaña "${NOMBRE_CAMPANA}" ya finalizada (${campana.ejecuciones}/${campana.max_ejecuciones}). Job no registrado.`);
    return;
  }

  console.log(`[avisarRutograma] Campaña "${NOMBRE_CAMPANA}" activa. Programando cron cada miércoles 8:00 AM...`);

  // Expresión cron: minuto 0, hora 8, cualquier día del mes, cualquier mes, miércoles (3)
  const job = cron.schedule('0 8 * * 3', () => ejecutarEnvioRutograma(job), {
    timezone: 'America/Caracas',
  });
}
