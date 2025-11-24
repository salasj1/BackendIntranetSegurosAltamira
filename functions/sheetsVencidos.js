import { google } from 'googleapis';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getConnection } from '../database/connection.js';
// Solución para __dirname en ES modules:
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const KEYFILEPATH = join(__dirname, '../JSON/GoogleServiceKey.json');
const SPREADSHEET_ID = '1y25HNN8BJzknQWEfx8UtC-MvktLSmtAVcW2AIyl6acM';

async function getVencidosFromSheet() {
  const auth = new google.auth.GoogleAuth({
    keyFile: KEYFILEPATH,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  // 1. Obtener el nombre de la segunda hoja
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const sheetList = meta.data.sheets;
  if (!sheetList || sheetList.length < 2) throw new Error('No hay segunda hoja en el spreadsheet');
  const secondSheetName = sheetList[1].properties.title;

  // 2. Leer los datos de la segunda hoja
  const range = `${secondSheetName}`;
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range,
  });

  const rows = res.data.values;
  if (!rows || rows.length < 2) return [];

  const headers = rows[0];
  const data = rows.slice(1).map(row => {
    const obj = {};
    headers.forEach((header, idx) => {
      obj[header] = row[idx];
    });
    return obj;
  });

  // Agrupar documentos vencidos por empleado
  const empleadosMap = {};
  for (const row of data) {
    const cedula = row['Cédula'];
    if (!cedula) continue;
    //necesito obtener el nombre del empleado por un sp de base de datos usando la cedula
    const pool = await getConnection();
    const empleadoResult = await pool.request()
      .input('cod_emp', cedula)
      .execute('spObtenerNombreCompletoEmpleado');
    const empleado = (empleadoResult.recordset || [])[0];

    if (!empleadosMap[cedula]) {
      empleadosMap[cedula] = {
        cod_emp: cedula,
        cedula: cedula,
        nombreCompleto: empleado ? empleado.nombre_completo : '',
        documentosVencidos: {}
      };
    }
    empleadosMap[cedula].documentosVencidos[row['Tipo de Archivo']] = {
      fechaVencimiento: row['Fecha de Vencimiento'],
      nombreArchivo: row['Nombre del Archivo'],
      webViewLink: row['Enlace al Archivo'],
      carpeta: row['Nombre de la Carpeta'],
    };
  }

  // Devuelve los empleados agrupados
  return Object.values(empleadosMap);
}

export { getVencidosFromSheet };