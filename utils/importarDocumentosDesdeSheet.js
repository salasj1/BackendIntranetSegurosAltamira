import { getSheet1Rows } from '../utils/importExpedientesSheet.js';
import { getConnection, sql } from '../database/connection.js';

function parseFecha(fechaStr) {
  if (!fechaStr || fechaStr.trim().toUpperCase() === 'N/A') return null;
  let partes = [];
  if (fechaStr.includes('-')) {
    partes = fechaStr.split('-');
  } else if (fechaStr.includes('/')) {
    partes = fechaStr.split('/');
  }
  if (partes.length === 3) {
    if (partes[0].length === 4) {
      const y = parseInt(partes[0], 10), m = parseInt(partes[1], 10), d = parseInt(partes[2], 10);
      if (y > 1900 && y < 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31) return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      return null;
    }
    const d = parseInt(partes[0], 10), m = parseInt(partes[1], 10), y = parseInt(partes[2], 10);
    if (y > 1900 && y < 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31) return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    return null;
  }
  return null;
}

export async function importarDocumentosDesdeSheet() {
  const rows = await getSheet1Rows();
  if (!rows || rows.length === 0) {
    return { success: false, message: 'No hay datos para importar' };
  }
  const pool = await getConnection();
  // Limpiar la tabla antes de importar (opcional, descomentar si se desea)
  await pool.request().query('TRUNCATE TABLE [db_accessadmin].[DOCUMENTOS]');
  await pool.request().query("DBCC CHECKIDENT('DOCUMENTOS', RESEED, 1)");
  await pool.request().query('TRUNCATE TABLE [db_accessadmin].[DOCUMENTOS_Staging]');
  for (const row of rows) {
    if (!row['Cédula'] && !row['Tipo de Archivo'] && !row['Fecha de Subida del Archivo'] && !row['Fecha de Vencimiento']) continue;
    const fechaSubida = parseFecha(row['Fecha de Subida del Archivo']);
    const fechaVencimiento = parseFecha(row['Fecha de Vencimiento']);
    await pool.request()
      .input('Cedula', sql.NVarChar, row['Cédula'] || null)
      .input('TipoDeArchivo', sql.NVarChar(100), row['Tipo de Archivo'] || null)
      .input('FechaSubida', sql.DateTime, fechaSubida)
      .input('FechaVencimiento', sql.Date, fechaVencimiento)
      .execute('spTraspasoMasivoDocumentos');
  }
  return { success: true, message: `Importados ${rows.length} registros actualizados` };
}
