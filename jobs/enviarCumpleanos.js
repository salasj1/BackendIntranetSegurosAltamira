/**
 * Job: enviarCumpleanos.js
 *
 * Cron que se ejecuta de Lunes a Viernes a las 7:20 AM (America/Caracas).
 * Consulta la BD mediante SP_ObtenerCumpleanerosHoy y, por cada empleado
 * que cumple años hoy, genera una tarjeta PNG con Puppeteer (en memoria,
 * sin escribir en disco) y la envía por correo a la dirección de distribución.
 *

 * Imágenes requeridas en public/images/:
 *   - Imagen-cumpleanos.jpg → fondo de la tarjeta (leído por generarTarjetaCumpleanos)
 */

import cron from 'node-cron';
import puppeteer from 'puppeteer';
import sql from 'mssql';
import { getConnection } from '../database/connection.js';
import { sendMailWithRetry } from '../functions/transporter.js';
import { generarTarjetaCumpleanos } from '../functions/generarTarjetaCumpleanos.js';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/**
 * Formatea un string en Title Case (primera letra mayúscula, resto minúscula).
 * @param {string} texto
 * @returns {string}
 */
function titleCase(texto) {
  if (!texto) return '';
  return texto.charAt(0).toUpperCase() + texto.slice(1).toLowerCase();
}

// ─────────────────────────────────────────────
// Acceso a BD
// ─────────────────────────────────────────────

/**
 * Llama al SP_ObtenerCumpleanerosHoy y retorna los registros.
 * @param {import('mssql').ConnectionPool} pool
 */
async function obtenerCumpleanerosHoy(pool) {
  const result = await pool
    .request()
    .execute('SP_ObtenerCumpleanerosHoy');
  return result.recordset;
}

// ─────────────────────────────────────────────
// HTML wrapper del correo
// ─────────────────────────────────────────────

/**
 * Construye el HTML mínimo del correo que contiene la tarjeta como imagen CID.
 * max-width:100% hace la imagen responsive automáticamente en móvil.
 * @param {string} primerNombre
 * @param {string} primerApellido
 * @returns {string}
 */
function buildEmailHtml(primerNombre, primerApellido) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f4f4f4;">
  <table width="100%" border="0" cellpadding="0" cellspacing="0" style="margin:0;padding:0;">
    <tr>
      <td align="center" style="padding:20px 0;">
        <img src="cid:tarjetaCumpleanos"
             width="800"
             alt="\u00a1Feliz Cumplea\u00f1os ${primerNombre} ${primerApellido}!"
             style="display:block;max-width:100%;height:auto;border:0;">
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─────────────────────────────────────────────
// Lógica principal de envío
// ─────────────────────────────────────────────

export const ejecutarEnvioCumpleanos = async () => {
  const pool = await getConnection();

  let cumpleaneros;
  try {
    cumpleaneros = await obtenerCumpleanerosHoy(pool);
  } catch (err) {
    console.error('[enviarCumpleanos] Error al consultar cumpleañeros:', err.message);
    return;
  }

  if (cumpleaneros.length === 0) {
    console.log('[enviarCumpleanos] No hay cumpleañeros hoy.');
    return;
  }

  console.log(`[enviarCumpleanos] Cumpleañeros hoy: ${cumpleaneros.length}`);

  const destino =  'masivo@segurosaltamira.com' ;
  let enviados = 0;
  let fallidos = 0;

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--allow-file-access-from-files'],
    });

    for (const emp of cumpleaneros) {
      const primerNombre = titleCase((emp.primer_nombre || '').trim());
      const primerApellido = titleCase((emp.primer_apellido || '').trim());
      const cargo = titleCase((emp.des_cargo || '').trim());
      const departamento = titleCase((emp.des_depart || '').trim());
      const fechaSolo = emp.fecha_nac.toISOString().split('T')[0];
      const [, mesRaw, diaRaw] = fechaSolo.split('-');
      const dia = String(parseInt(diaRaw, 10));
      const mes = mesRaw.padStart(2, '0');
      const fechaDia = `${dia}/${mes}`;

      let pngBuffer;
      try {
        pngBuffer = await generarTarjetaCumpleanos(browser, { primerNombre, primerApellido, cargo, departamento, fechaDia });
      } catch (err) {
        console.error(`[enviarCumpleanos] [IMG-FAIL] ${primerNombre} ${primerApellido}:`, err.message);
        fallidos++;
        continue;
      }

      const mailOptions = {
        from: '"Intranet Seguros Altamira" <IntranetSegurosAltamira@segurosaltamira.com>',
        to: destino,
        subject: `¡Celebremos las ocasiones especiales!`,
        html: buildEmailHtml(primerNombre, primerApellido),
        attachments: [{
          filename: `tarjeta-cumpleanos-${primerNombre}-${primerApellido}.png`,
          content: pngBuffer,
          cid: 'tarjetaCumpleanos',
          contentType: 'image/png',
          contentDisposition: 'inline',
        }],
      };

      const resultado = await sendMailWithRetry(mailOptions);
      if (resultado.success) {
        console.log(`[enviarCumpleanos] [OK]   ${primerNombre} ${primerApellido}`);
        enviados++;
      } else {
        console.error(`[enviarCumpleanos] [FAIL] ${primerNombre} ${primerApellido}:`, resultado.error?.message);
        fallidos++;
      }
    }
  } finally {
    if (browser) await browser.close();
  }

  console.log(`[enviarCumpleanos] Resumen: ${enviados} enviados, ${fallidos} fallidos de ${cumpleaneros.length} total.`);
};

// ─────────────────────────────────────────────
// Exportable: registrar el cron al iniciar el servidor
// ─────────────────────────────────────────────

/**
 * Registra el cron job de cumpleaños.
 * Llamar una sola vez desde index.js al arrancar el servidor.
 */
export function enviarCumpleanos() {
  console.log('[enviarCumpleanos] Programando cron diario a las 8:15 AM (America/Caracas)...');

  // Minuto 20, hora 7, cualquier día, mes y día de semana (Lunes a Viernes)
  // 7:20 AM para no colisionar con otros jobs que se disparan a las 8:00 AM exactas.
  cron.schedule('27 9 * * 1-5', ejecutarEnvioCumpleanos, {
    timezone: 'America/Caracas',
  });
}
