import { google } from 'googleapis';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Solución para __dirname en ES modules:
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const KEYFILEPATH = join(__dirname, '../JSON/GoogleServiceKey.json');
const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;

export async function getSheet1Rows() {
  const auth = new google.auth.GoogleAuth({
    keyFile: KEYFILEPATH,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  // Leer la hoja 1 (primera hoja)
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const sheetList = meta.data.sheets;
  if (!sheetList || sheetList.length < 1) throw new Error('No hay hoja 1 en el spreadsheet');
  const firstSheetName = sheetList[0].properties.title;

  // Leer los datos de la hoja 1
  const range = firstSheetName; // Esto trae todas las filas y columnas con datos
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

  return data;
}
