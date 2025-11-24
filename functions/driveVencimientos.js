
import { authorize } from '../APIs/Drive.js';
import { google } from 'googleapis';
import { getConnection } from '../database/connection.js';

const PARENT_FOLDER_ID = process.env.VITE_GOOGLE_DRIVE_FOLDER_ID || '1_M5OdOUGxk_D2Ink2-66bPQGOiqcbz8q';

// Analiza el nombre del archivo y retorna info útil o null si no es válido
function parseDocumentoNombre(nombre) {
  // <Cédula>_<Título>_<FechaIngreso>_<FechaVencimiento>.pdf
  const regex = /^(\d+)_([A-Za-z]+)_(\d{2}-\d{2}-\d{4})(?:_(\d{2}-\d{2}-\d{4}))?\.pdf$/i;
  const match = nombre.match(regex);
  if (!match) return null;
  return {
    cedula: match[1],
    tipo: match[2],
    fechaIngreso: match[3],
    fechaVencimiento: match[4] || null,
    nombreArchivo: nombre
  };
}

// Devuelve true si la fecha de vencimiento es anterior a hoy
function estaVencido(fechaVencimiento) {
  if (!fechaVencimiento) return false;
  const [d, m, y] = fechaVencimiento.split('-').map(Number);
  const fecha = new Date(y, m - 1, d, 23, 59, 59);
  const hoy = new Date();
  hoy.setHours(0,0,0,0);
  return fecha < hoy;
}

// Busca empleados con documentos vencidos de cualquier tipo que requiera fecha de vencimiento
export async function empleadosConDocumentosVencidos() {
  // 1. Obtener tipos de documentos con fechaVencimiento = true
  const pool = await getConnection();
  const tiposResult = await pool.request().execute('spObtenerTipoDocumentos');
  const tiposConVencimiento = (tiposResult.recordset || []).filter(t => t.fechaVencimiento === true || t.fechaVencimiento === 1).map(t => t.nombre.toLowerCase());

  const authClient = await authorize();
  const drive = google.drive({ version: 'v3', auth: authClient });
  // 2. Listar subcarpetas (empleados)
  const subcarpetas = await drive.files.list({
    q: `'${PARENT_FOLDER_ID}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id, name)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  const empleados = [];
  for (const carpeta of subcarpetas.data.files) {
    // 3. Listar archivos de la carpeta
    const archivosRes = await drive.files.list({
      q: `'${carpeta.id}' in parents and trashed = false and mimeType != 'application/vnd.google-apps.folder'`,
      fields: 'files(id, name, webViewLink)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    // Guardar documentos vencidos por tipo
    const vencidosPorTipo = {};
    for (const archivo of archivosRes.data.files) {
      const info = parseDocumentoNombre(archivo.name);
      if (!info) continue;
      info.webViewLink = archivo.webViewLink;
      // Si el tipo requiere vencimiento y tiene fecha de vencimiento
      if (tiposConVencimiento.includes(info.tipo.toLowerCase()) && info.fechaVencimiento) {
        if (estaVencido(info.fechaVencimiento)) {
          vencidosPorTipo[info.tipo.toLowerCase()] = info;
        }
      }
    }
    if (Object.keys(vencidosPorTipo).length > 0) {
      empleados.push({
        cedula: carpeta.name,
        documentosVencidos: vencidosPorTipo
      });
    }
  }
  return empleados;
}
