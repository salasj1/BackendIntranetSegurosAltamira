/**
 * functions/generarTarjetaCumpleanos.js
 *
 * Genera la tarjeta de cumpleaños como buffer PNG en memoria usando Puppeteer.
 * La imagen resultante NUNCA se escribe en disco — solo existe como Buffer durante el envío.
 *
 * Estrategia de renderizado:
 *   1. El HTML procesado (pocos KB) se escribe en un archivo temporal.
 *   2. Puppeteer navega a ese archivo vía file:// → Chromium carga la imagen de fondo
 *      también desde file:// (sin pasar datos grandes por CDP).
 *   3. Se toma el screenshot → Buffer PNG en RAM.
 *   4. El archivo temporal se borra de inmediato.
 *
 * El Browser debe ser creado y destruido por el llamador (jobs/enviarCumpleanos.js)
 * para reutilizarlo entre varios empleados sin relanzar Chromium cada vez.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEMPLATE_PATH = path.resolve(__dirname, '../templates/tarjeta_cumpleanos_render.html');
const CAKE_PATH = path.resolve(__dirname, '../public/images/Imagen-cumpleanos.jpg');
// URL file:// de la imagen base (se calcula una sola vez)
// En Windows: "C:\foo\bar.jpg" → "file:///C:/foo/bar.jpg"
const CAKE_FILE_URL = 'file:///' + CAKE_PATH.replace(/\\/g, '/');

// ── Cache de la plantilla — se lee del disco una sola vez al primer uso ───────
let _plantillaBase = null;

function cargarPlantilla() {
  if (!_plantillaBase) {
    _plantillaBase = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  }
}

// ── Helpers tipográficos ──────────────────────────────────────────────────────

/**
 * Tamaño de fuente para el primer nombre según su longitud.
 * Rango diseñador: 38–58 px (tarjeta 600×338 px, columna texto 280 px).
 * @param {string} texto
 * @returns {string}
 */
function fontSizeNombre(texto) {
  const len = (texto || '').length;
  if (len <= 3) return '52px';
  if (len <= 5) return '46px';
  if (len <= 7) return '42px';
  if (len <= 9) return '38px';
  return '34px';
}

/**
 * Tamaño de fuente para el primer apellido según su longitud.
 * Rango diseñador: 48–78 px.
 * @param {string} texto
 * @returns {string}
 */
function fontSizeApellido(texto) {
  const len = (texto || '').length;
  if (len <= 4) return '72px';
  if (len <= 6) return '62px';
  if (len <= 8) return '56px';
  if (len <= 10) return '50px';
  return '44px';
}

/**
 * Escapa caracteres HTML especiales para evitar inyección en la plantilla.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Función principal ─────────────────────────────────────────────────────────

/**
 * Genera la tarjeta de cumpleaños como buffer PNG usando Puppeteer.
 * La imagen NO se guarda en disco — se retorna como Buffer para adjuntar al correo.
 *
 * @param {import('puppeteer').Browser} browser  Instancia de browser ya abierta (reutilizar).
 * @param {object}  datos
 * @param {string}  datos.primerNombre     Nombre en Title Case.
 * @param {string}  datos.primerApellido   Apellido en Title Case.
 * @param {string}  datos.cargo            Cargo del empleado.
 * @param {string}  datos.departamento     Departamento/Sucursal (puede ser vacío).
 * @param {string}  datos.fechaDia         Fecha "DD/MM".
 * @returns {Promise<Buffer>}              Buffer PNG (1200×676 px físicos, 600×338 lógicos).
 */
export async function generarTarjetaCumpleanos(browser, datos) {
  cargarPlantilla();

  // Departamento es opcional: si está vacío no se renderiza el elemento
  const departamentoHtml = datos.departamento
    ? `<p class="departamento">${escapeHtml(datos.departamento)}</p>`
    : '';

  // Construir el HTML con todos los placeholders reemplazados.
  // El HTML resultante es pequeño (~5 KB) porque la imagen se referencia
  // con {{IMAGEN_URL}} (file://) en lugar de embeberse como base64.

  let html = _plantillaBase
    .replace(/{{IMAGEN_URL}}/g, CAKE_FILE_URL)
    .replace(/{{primerNombre}}/g, escapeHtml(datos.primerNombre))
    .replace(/{{primerApellido}}/g, escapeHtml(datos.primerApellido))
    .replace(/{{cargo}}/g, escapeHtml(datos.cargo))
    .replace(/{{departamento_html}}/g, departamentoHtml)
    .replace(/{{fechaDia}}/g, escapeHtml(datos.fechaDia))
    .replace(/font-size:\s*21px/g, `font-size:${fontSizeNombre(datos.primerNombre)}`)
    .replace(/font-size:\s*22px/g, `font-size:${fontSizeApellido(datos.primerApellido)}`);

  // Escribir el HTML en un archivo temporal (solo el HTML, la imagen NO se copia).
  // El archivo existe solo unos segundos y se borra al terminar.
  const tempPath = path.join(os.tmpdir(), `tarjeta-cumpleanos-${Date.now()}.html`);
  fs.writeFileSync(tempPath, html, 'utf8');

  const page = await browser.newPage();
  try {
    // deviceScaleFactor:2 → PNG de 1200×676 px físicos (nítido en pantallas HiDPI/Retina)
    await page.setViewport({ width: 800, height: 450, deviceScaleFactor: 2 });

    // Navegar al archivo temporal.
    // Chromium carga la imagen de fondo desde file:// (gracias a --allow-file-access-from-files).
    // waitUntil:'networkidle0' espera que Google Fonts también termine de descargar.
    const tempUrl = 'file:///' + tempPath.replace(/\\/g, '/');
    await page.goto(tempUrl, { waitUntil: 'networkidle0', timeout: 30000 });

    const pngBuffer = await page.screenshot({
      type: 'png',
      clip: { x: 0, y: 0, width: 800, height: 450 },
    });

    return pngBuffer;
  } finally {
    await page.close();
    // Borrar el archivo temporal inmediatamente (fire-and-forget)
    fs.unlink(tempPath, () => { });
  }
}
