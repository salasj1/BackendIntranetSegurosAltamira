import { authorize, createFolder, uploadFile, listFilesInFolder, findFileByNameInSubfolder, findFileByName, BuscarDocumento } from '../APIs/Drive.js';
import { google } from 'googleapis';
import dotenv from 'dotenv';
dotenv.config();
const parentFolderId = process.env.VITE_GOOGLE_DRIVE_FOLDER_ID;
// Copia de la función analizarArchivo (puedes importar si la tienes en un util)
function analizarArchivo(nombreArchivo, cedulaCarpeta) {
  const palabrasClave = [
    "CertificadoAdministracionRiesgo",
    "ImpuestoSobreRenta",
    "Rif",
    "Cedula",
    "DocumentosOtros",
    "ConstanciaResidencia",
    "SolicitudCedula",
    "SolicitudEmpleo",
    "Rutograma"
  ];
  const palabras = palabrasClave.join('|');
  const regex = new RegExp(
    `^([\\d-]+)_(${palabras})_(\\d{2}-\\d{2}-\\d{4})(_(\\d{2}-\\d{2}-\\d{4}))?(\\.pdf)?$`,
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
  if (!/^\d{1,2}-?\d{6,8}$|^\d{6,9}$/.test(cedula)) {
    return "Cédula no tiene el formato correcto (solo números o números con guion).";
  }
  if (cedulaCarpeta && cedula !== cedulaCarpeta) {
    return `La cédula del archivo (${cedula}) no coincide con la carpeta (${cedulaCarpeta}).`;
  }
  if (!/^\d{2}-\d{2}-\d{4}$/.test(fechaIngreso)) {
    return "Fecha de ingreso no tiene el formato DD-MM-YYYY.";
  }
  if (fechaVencimiento && !/^\d{2}-\d{2}-\d{4}$/.test(fechaVencimiento)) {
    return "Fecha de vencimiento no tiene el formato DD-MM-YYYY.";
  }
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
  return null;
}

async function main() {
  const auth = await authorize();

  /*   // Ejemplo: crear una carpeta
    const folderId = await createFolder(auth, 'CarpetaPrueba');
    console.log('ID de la carpeta creada:', folderId);
  
    // Ejemplo: subir un archivo
    await uploadFile(auth, folderId, './archivoPrueba.txt');
    console.log('Archivo subido');
  
    // Ejemplo: listar archivos en la carpeta
    const files = await listFilesInFolder(auth, folderId);
    console.log('Archivos en la carpeta:', files);
   */
  // Ejemplo: buscar un archivo por nombre
  /* const file = await findFileByNameInSubfolder(auth, '19330859', '19330859_Cedula_24-04-2025_28-10-2025.pdf');
  console.log('Archivo encontrado:', file); */
  
   /*  const archivo = await BuscarDocumento(auth, '5787215', 'Cedula');
    console.log('Archivo encontrado:', archivo); */
  
  /*   const file2 = await findFileByName(auth, '19330859_Cedula_24-04-2025_28-10-2025.pdf');
    console.log('Archivo encontrado por nombre:', file2); */
  
  // Prueba: listar archivos de una carpeta y analizarlos
  const parentFolderId = process.env.VITE_GOOGLE_DRIVE_FOLDER_ID ; // Expedientes
  const drive = google.drive({ version: 'v3', auth });
  
  // Listar subcarpetas (empleados)
  const subfoldersRes = await drive.files.list({
    q: `'${parentFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id, name)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true
  });
  const subfolders = subfoldersRes.data.files;
  for (const carpeta of subfolders) {
    // Listar archivos y subcarpetas dentro de la carpeta del empleado
    const archivosYCarpetas = await listFilesInFolder(auth, carpeta.id);
    if (archivosYCarpetas.length === 0) continue;

    // Filtrar subcarpeta "Antiguo o vencido" y solo analizar archivos fuera de ella
    for (const item of archivosYCarpetas) {
      // Si es una carpeta y su nombre es "Antiguo o vencido", ignorar su contenido
      if (item.mimeType === 'application/vnd.google-apps.folder' && item.name.trim().toLowerCase() === 'antiguo o vencido') {
        continue;
      }
      // Si es archivo, analizar
      if (!item.mimeType || item.mimeType !== 'application/vnd.google-apps.folder') {
        const error = analizarArchivo(item.name, carpeta.name);
        if (error) {
          console.log(`\nCarpeta: ${carpeta.name}`);
          console.log(`  [ERROR] ${item.name}: ${error}`);
        }
      }
    }
  }
}

main().catch(console.error);