/**
 * Script: enviar_aviso_rutograma.js
 * Ejecutar con: node scripts/enviar_aviso_rutograma.js
 *
 * Envía un correo masivo a todos los empleados activos que NO tienen
 * ningún registro en la tabla [db_accessadmin].[RUTOGRAMAS].
 */

import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';
import { getConnection, sql } from '../database/connection.js';
import { sendMailWithRetry } from '../functions/transporter.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEMPLATE_PATH = path.join(__dirname, '../templates/correo_Aviso_Rutograma.html');
const LOGO_PATH = path.join(__dirname, '../public/images/logo.png');
const GIF_PATH = path.join(__dirname, '../public/images/mapa.gif');
const BASE_URL = process.env.BASE_URL || '';

async function obtenerEmpleadosSinRutograma(pool) {
  const result = await pool.request().execute('SP_ObtenerEmpleadosSinRutograma');
  return result.recordset;
}

async function enviarAvisoRutograma() {
  let pool;
  try {
    pool = await getConnection();
    console.log('Conexión a la base de datos establecida.');
  } catch (err) {
    console.error('Error al conectar a la base de datos:', err);
    process.exit(1);
  }

  let empleados;
  try {
    empleados = await obtenerEmpleadosSinRutograma(pool);
  } catch (err) {
    console.error('Error al consultar empleados sin rutograma:', err);
    process.exit(1);
  }

  if (empleados.length === 0) {
    console.log('Todos los empleados activos ya tienen rutograma registrado. No se envían correos.');
    process.exit(0);
  }

  console.log(`Se encontraron ${empleados.length} empleado(s) sin rutograma. Iniciando envío de correos...`);

  const plantillaBase = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  const anio = new Date().getFullYear();

  let enviados = 0;
  let fallidos = 0;

  for (const emp of empleados) {
    // 1. Extraemos la primera palabra
    const primerNombre = emp.nombres ? emp.nombres.trim().split(/\s+/)[0] : '';
    const primerApellido = emp.apellidos ? emp.apellidos.trim().split(/\s+/)[0] : '';
    // 2. Definimos una pequeña función para el formato "Capitalize" (Primera mayúscula, resto minúscula)
    const formatoTitulo = (texto) => texto ? texto.charAt(0).toUpperCase() + texto.slice(1).toLowerCase() : '';
    // 3. Lo armamos aplicando la función
    const nombreCompleto = `${formatoTitulo(primerNombre)} ${formatoTitulo(primerApellido)}`.trim();
    const html = plantillaBase
      .replace(/\${nombre_completo}/g, nombreCompleto)
      .replace(/\${BASE_URL}/g, BASE_URL)
      .replace(/\${anio}/g, anio);

    const mailOptions = {
      from: '"Intranet Seguros Altamira" <IntranetSegurosAltamira@segurosaltamira.com>',
      to: emp.correo_e,
      subject: 'Actualización del Rutograma',
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
      console.log(`[OK]  ${emp.correo_e} — ${nombreCompleto}`);
      enviados++;
    } else {
      console.error(`[FAIL] ${emp.correo_e} — ${nombreCompleto}:`, resultado.error?.message);
      fallidos++;
    }
  }

  console.log('\n=== Resumen ===');
  console.log(`Total empleados sin rutograma : ${empleados.length}`);
  console.log(`Correos enviados exitosamente  : ${enviados}`);
  console.log(`Correos fallidos               : ${fallidos}`);

  process.exit(0);
}

enviarAvisoRutograma();
