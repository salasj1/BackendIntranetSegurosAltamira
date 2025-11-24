import { authorize } from '../APIs/Drive.js';
import { google } from 'googleapis';

async function listFoldersInFolder(authClient, folderId) {
  const drive = google.drive({ version: 'v3', auth: authClient });
  const res = await drive.files.list({
    q: `'${folderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id, name)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true
  });
  return res.data.files;
}

async function listFilesInFolder(authClient, folderId) {
  const drive = google.drive({ version: 'v3', auth: authClient });
  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false and mimeType != 'application/vnd.google-apps.folder'`,
    fields: 'files(id, name, mimeType, webViewLink, createdTime, modifiedTime, owners)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true
  });
  return res.data.files;
}

/* (async () => {
  try {
    const authClient = await authorize();
    const folderId = '1_M5OdOUGxk_D2Ink2-66bPQGOiqcbz8q'; // Expedientes

    // 1. Listar subcarpetas
    const subcarpetas = await listFoldersInFolder(authClient, folderId);
    if (subcarpetas.length === 0) {
      console.log('No se encontraron subcarpetas en Expedientes.');
      return;
    }

    // 2. Para cada subcarpeta, listar sus archivos
    for (const carpeta of subcarpetas) {
      const archivos = await listFilesInFolder(authClient, carpeta.id);
      console.log(`\nCarpeta: ${carpeta.name} (${carpeta.id})`);
      if (archivos.length === 0) {
        console.log('  (Sin documentos)');
      } else {
        archivos.forEach(archivo => {
          console.log(`  * ${archivo.name} (${archivo.id})`);
        });
      }
    }
  } catch (error) {
    console.error('Error al listar documentos:', error);
  }
})(); */

function analizarArchivo(nombreArchivo, cedulaCarpeta) {
  const palabrasClave = [
    "CertificadoAdministracionRiesgo",
    "ImpuestoSobreRenta",
    "Rif",
    "Cedula",
    "DocumentosOtros",
    "ConstanciaResidencia",
    "SolicitudCedula"
  ];
  
  const palabras = palabrasClave.join('|');

  // 1. Validar extensión PDF
  if (!nombreArchivo.toLowerCase().endsWith('.pdf')) {
    return "El archivo no es un PDF.";
  }

  // 2. Validar patrón general
  const regex = new RegExp(
    `^([\\d-]+)_(${palabras})_(\\d{2}-\\d{2}-\\d{4})(_(\\d{2}-\\d{2}-\\d{4}))?\\.pdf$`,
    'i'
  );
  const match = nombreArchivo.match(regex);

  if (!match) {
    return "Nombre no cumple el patrón requerido: <Cédula>_<Título>_<FechaIngreso>[_<FechaVencimiento>].pdf";
  }
  
  const cedula = match[1];
  const titulo = match[2];
  const fechaIngreso = match[3];
  const fechaVencimiento = match[5];

  // 3. Validar cédula: solo números y guiones
  if (!/^\d{1,2}-?\d{6,8}$|^\d{6,9}$/.test(cedula)) {
    return "Cédula no tiene el formato correcto (solo números o números con guion).";
  }
  // 4. Validar coincidencia con la carpeta
  if (cedulaCarpeta && cedula !== cedulaCarpeta) {
    return `La cédula del archivo (${cedula}) no coincide con la carpeta (${cedulaCarpeta}).`;
  }

  // 5. Validar formato de fechas
  if (!/^\d{2}-\d{2}-\d{4}$/.test(fechaIngreso)) {
    return "Fecha de ingreso no tiene el formato DD-MM-YYYY.";
  }
  if (fechaVencimiento && !/^\d{2}-\d{2}-\d{4}$/.test(fechaVencimiento)) {
    return "Fecha de vencimiento no tiene el formato DD-MM-YYYY.";
  }

  // 6. Validar fechas reales
  const [d1, m1, y1] = fechaIngreso.split('-').map(Number);
  const fecha1 = new Date(`${y1}-${m1}-${d1}`);
  if (isNaN(fecha1.getTime())) {
    return "Fecha de ingreso no es una fecha válida.";
  }
  if (fechaVencimiento) {
    const [d2, m2, y2] = fechaVencimiento.split('-').map(Number);
    const fecha2 = new Date(`${y2}-${m2}-${d2}`);
    if (isNaN(fecha2.getTime())) {
      return "Fecha de vencimiento no es una fecha válida.";
    }
  }

  return null; // Sin errores
}

// Barra de carga en el terminal
function mostrarProgreso(actual, total) {
  const porcentaje = Math.round((actual / total) * 100);
  const barra = '='.repeat(porcentaje / 2) + ' '.repeat(50 - porcentaje / 2);
  process.stdout.clearLine();
  process.stdout.cursorTo(0);
  process.stdout.write(`[${barra}] ${porcentaje}%`);
}

// Modificar el código principal para incluir la barra de carga
(async () => {
  try {
    const authClient = await authorize();
    // Asegúrate de que la variable de entorno esté definida
    const folderId = '1_M5OdOUGxk_D2Ink2-66bPQGOiqcbz8q';
    if (!folderId) {
      throw new Error('La variable de entorno VITE_GOOGLE_DRIVE_FOLDER_ID no está definida. Define el ID de la carpeta raíz de Expedientes.');
    }

    // 1. Listar subcarpetas
    const subcarpetas = await listFoldersInFolder(authClient, folderId);
    if (subcarpetas.length === 0) {
      console.log('No se encontraron subcarpetas en Expedientes.');
      return;
    }

    let totalArchivos = 0;
    for (const carpeta of subcarpetas) {
      const archivos = await listFilesInFolder(authClient, carpeta.id);
      totalArchivos += archivos.length;
    }

    let procesados = 0;

    // 2. Para cada subcarpeta, listar sus archivos y analizar errores
    for (const carpeta of subcarpetas) {
      const cedulaCarpeta = carpeta.name;
      const archivos = await listFilesInFolder(authClient, carpeta.id);

      let huboErrores = false;
      for (const archivo of archivos) {
        const error = analizarArchivo(archivo.name, cedulaCarpeta);
        if (error) {
          if (!huboErrores) {
            console.log(`\nCarpeta: ${carpeta.name}`);
            huboErrores = true;
          }
          console.log(`  Error: ${error}`);
          console.log(`  * ${archivo.name} `);
        }
        procesados++;
        mostrarProgreso(procesados, totalArchivos);
      }
    }
    console.log('\nProceso completado.');
  } catch (error) {
    console.error('Error al listar documentos:', error);
    if (error.message && error.message.includes('VITE_GOOGLE_DRIVE_FOLDER_ID')) {
      console.error('Debes definir la variable de entorno VITE_GOOGLE_DRIVE_FOLDER_ID con el ID de la carpeta raíz de Expedientes.');
    }
  }
})();

