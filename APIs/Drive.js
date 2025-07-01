import { promises as fs } from 'fs';
import path from 'path';
import process from 'process';
import { authenticate } from '@google-cloud/local-auth';
import { google } from 'googleapis';

// Si modificas estos alcances, elimina token.json.
const SCOPES = ['https://www.googleapis.com/auth/drive'];
// El archivo token.json almacena los tokens de acceso y actualización del usuario,
// y se crea automáticamente cuando el flujo de autorización se completa por primera vez.
const TOKEN_PATH = path.join(process.cwd(), 'token.json');
const CREDENTIALS_PATH = path.join(process.cwd(), 'JSON/GoogleDriveKey.json');

/**
 * Lee las credenciales autorizadas previamente desde el archivo guardado.
 *
 * @return {Promise<OAuth2Client|null>}
 */
async function loadSavedCredentialsIfExist() {
  try {
    const content = await fs.readFile(TOKEN_PATH);
    const credentials = JSON.parse(content);
    return google.auth.fromJSON(credentials);
  } catch (err) {
    return null;
  }
}

/**
 * Serializa las credenciales a un archivo compatible con GoogleAuth.fromJSON.
 *
 * @param {OAuth2Client} client
 * @return {Promise<void>}
 */
async function saveCredentials(client) {
  const content = await fs.readFile(CREDENTIALS_PATH);
  const keys = JSON.parse(content);
  const key = keys.installed || keys.web;
  const payload = JSON.stringify({
    type: 'authorized_user',
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  });
  await fs.writeFile(TOKEN_PATH, payload);
}

/**
 * Carga o solicita autorización para llamar a las APIs.
 *
 */
async function authorize() {
  let client = await loadSavedCredentialsIfExist();
  if (client) {
    return client;
  }
  client = await authenticate({
    scopes: SCOPES,
    keyfilePath: CREDENTIALS_PATH,
  });
  if (client.credentials) {
    await saveCredentials(client);
  }
  return client;
}

/**
 * Crea una carpeta en Google Drive.
 * @param {OAuth2Client} authClient Un cliente OAuth2 autorizado.
 * @param {string} folderName El nombre de la carpeta a crear.
 * @param {string} userEmail El email del usuario con el que se compartirá la carpeta (opcional).
 * @return {Promise<string>} El ID de la carpeta creada.
 */
export async function createFolder(authClient, folderName, userEmail) {
  const drive = google.drive({ version: 'v3', auth: authClient });
  const fileMetadata = {
    'name': folderName,
    'mimeType': 'application/vnd.google-apps.folder',
    'parents': ['1_M5OdOUGxk_D2Ink2-66bPQGOiqcbz8q'],
  };
  const file = await drive.files.create({
    resource: fileMetadata,
    fields: 'id',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true
  });
  // Compartir la carpeta con el usuario como lector, sin notificación
  if (userEmail) {
    await drive.permissions.create({
      fileId: file.data.id,
      resource: {
        type: 'user',
        role: 'reader',
        emailAddress: userEmail,
      },
      sendNotificationEmail: false,
      supportsAllDrives: true
    });
  }
  return file.data.id;
}

/**
 * Sube un archivo a Google Drive.
 * @param {OAuth2Client} authClient Un cliente OAuth2 autorizado.
 * @param {string} folderId El ID de la carpeta donde se subirá el archivo.
 * @param {string} filePath La ruta del archivo a subir.
 * @return {Promise<void>}
 */
export async function uploadFile(authClient, folderId, filePath) {
  const drive = google.drive({ version: 'v3', auth: authClient });
  const fileMetadata = {
    'name': path.basename(filePath),
    'parents': [folderId]
  };
  const media = {
    mimeType: 'application/octet-stream',
    body: fs.createReadStream(filePath)
  };
  await drive.files.create({
    resource: fileMetadata,
    media: media,
    fields: 'id'
  });
}

/**
 * Sube un archivo a Google Drive usando una carga simple.
 * @param {OAuth2Client} authClient Un cliente OAuth2 autorizado.
 * @param {string} filePath La ruta del archivo a subir.
 * @return {Promise<string>} El ID del archivo subido.
 */
export async function uploadSimple(authClient, filePath) {
  const drive = google.drive({ version: 'v3', auth: authClient });
  const fileMetadata = {
    'name': path.basename(filePath)
  };
  const media = {
    mimeType: 'application/octet-stream',
    body: fs.createReadStream(filePath)
  };
  const file = await drive.files.create({
    resource: fileMetadata,
    media: media,
    fields: 'id',
    uploadType: 'media'

  });
  return file.data.id;
}

export async function uploadMultipart(authClient, folderId, archivo) {
  const drive = google.drive({ version: 'v3', auth: authClient });
  const fileMetadata = {
    'name': archivo.originalname,
    'parents': [folderId]
  };
  const media = {
    mimeType: archivo.mimetype,
    body: archivo.buffer
  };
  const file = await drive.files.create({
    resource: fileMetadata,
    media: media,
    fields: 'id',
    uploadType: 'multipart'
  });
  return file.data.id;
}

/**
 * Lista los archivos dentro de una carpeta de Google Drive.
 * @param {OAuth2Client} authClient Un cliente OAuth2 autorizado.
 * @param {string} folderId El ID de la carpeta a listar.
 * @return {Promise<Array>} Lista de archivos (id, name, mimeType).
 */
export async function listFilesInFolder(authClient, folderId) {
  const drive = google.drive({ version: 'v3', auth: authClient });
  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: 'files(id, name, mimeType, webViewLink, createdTime, modifiedTime, owners)',
    pageSize: 1000,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true
  });
  return res.data.files;
}

const PARENT_FOLDER_ID = '1_M5OdOUGxk_D2Ink2-66bPQGOiqcbz8q';

/**
 * Busca un archivo por nombre dentro de una subcarpeta (por nombre) que está dentro de una carpeta padre fija.
 * @param {OAuth2Client} authClient
 * @param {string} subfolderName - Nombre de la subcarpeta donde buscar
 * @param {string} fileName - Nombre del archivo a buscar
 * @return {Promise<Object|null>} El archivo encontrado o null si no se encuentra.
 */
export async function findFileByNameInSubfolder(authClient, subfolderName, fileName) {
  const drive = google.drive({ version: 'v3', auth: authClient });

  // Buscar la subcarpeta por nombre dentro de la carpeta padre fija
  const folderRes = await drive.files.list({
    q: `'${PARENT_FOLDER_ID}' in parents and name = '${subfolderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id,name)',
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true
  });

  if (folderRes.data.files.length === 0) {
    throw new Error(`No se encontró la subcarpeta '${subfolderName}' dentro de la carpeta padre con ID: ${PARENT_FOLDER_ID}`);
  }

  const subfolderId = folderRes.data.files[0].id;

  // Buscar el archivo dentro de la subcarpeta encontrada
  const fileRes = await drive.files.list({
    q: `'${subfolderId}' in parents and name = '${fileName}' and trashed = false`,
    fields: 'files(id, name, mimeType)',
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true
  });

  return fileRes.data.files.length > 0 ? fileRes.data.files[0] : null;
}

/**
 * Busca un archivo por nombre en todo Google Drive.
 * @param {OAuth2Client} authClient Un cliente OAuth2 autorizado.
 * @param {string} fileName El nombre del archivo a buscar.
 * @return {Promise<Object|null>}
 */
export async function findFileByName(authClient, fileName) {
  const drive = google.drive({ version: 'v3', auth: authClient });
  const res = await drive.files.list({
    q: `name = '${fileName}' in parents and trashed = false`,
    fields: 'files(id, name, mimeType)',
    pageSize: 1
  });
  return res.data.files.length > 0 ? res.data.files[0] : null;
}


/**
 * Busca el archivo más recientemente modificado dentro de una subcarpeta (por nombre) que contenga una palabra en su nombre.
 * @param {OAuth2Client} authClient
 * @param {string} subfolderName - Nombre de la subcarpeta donde buscar
 * @param {string} palabra - Palabra que debe estar contenida en el nombre del archivo
 * @return {Promise<Object|null>} El archivo más reciente encontrado o null si no se encuentra.
 */
export async function BuscarDocumento(authClient, subfolderName, palabra) {
  const drive = google.drive({ version: 'v3', auth: authClient });

  // Buscar la subcarpeta por nombre dentro de la carpeta padre fija
  const folderRes = await drive.files.list({
    q: `'${PARENT_FOLDER_ID}' in parents and name = '${subfolderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id,name)',
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true
  });

  if (folderRes.data.files.length === 0) {
    throw new Error(`No se encontró la subcarpeta '${subfolderName}' dentro de la carpeta padre con ID: ${PARENT_FOLDER_ID}`);
  }

  const subfolderId = folderRes.data.files[0].id;

  // Buscar archivos que contengan la palabra en su nombre dentro de la subcarpeta
  const fileRes = await drive.files.list({
    q: `'${subfolderId}' in parents and name contains '${palabra}' and trashed = false`,
    fields: 'files(id, name, mimeType, modifiedTime, webViewLink, webContentLink)',
    orderBy: 'modifiedTime desc',
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true
  });

  return fileRes.data.files.length > 0 ? fileRes.data.files[0] : null;
}

/**
 * Busca o crea la subcarpeta "Viejo o vencido" dentro de la carpeta del empleado.
 * @param {google.drive_v3.Drive} drive
 * @param {string} parentId - ID de la carpeta del empleado (cédula)
 * @returns {Promise<string>} - ID de la carpeta "Antiguo o vencido"
 */
export async function getOrCreateSubfolder(drive, parentId, subfolderName = "Antiguo o vencido") {
  // Buscar la subcarpeta
  const res = await drive.files.list({
    q: `'${parentId}' in parents and name='${subfolderName}' and mimeType='application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id, name)',
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true
  });
  if (res.data.files.length > 0) {
    return res.data.files[0].id;
  }
  // Si no existe, crearla
  const fileMetadata = {
    name: subfolderName,
    mimeType: 'application/vnd.google-apps.folder',
    parents: [parentId]
  };
  const folder = await drive.files.create({
    resource: fileMetadata,
    fields: 'id',
    supportsAllDrives: true
  });
  return folder.data.id;
}

/**
 * Mueve un archivo a otra carpeta (quita la carpeta anterior y lo pone en la nueva).
 * @param {google.drive_v3.Drive} drive
 * @param {string} fileId
 * @param {string} newParentId
 */
export async function moveFileToFolder(drive, fileId, newParentId) {
  // Obtener los padres actuales
  const file = await drive.files.get({
    fileId,
    fields: 'parents',
    supportsAllDrives: true
  });
  const previousParents = file.data.parents.join(',');
  // Mover el archivo
  await drive.files.update({
    fileId,
    addParents: newParentId,
    removeParents: previousParents,
    fields: 'id, parents',
    supportsAllDrives: true
  });
}
export { authorize };