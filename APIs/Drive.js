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
 * @return {Promise<string>} El ID de la carpeta creada.
 */
export async function createFolder(authClient, folderName) {
  const drive = google.drive({ version: 'v3', auth: authClient });
  const fileMetadata = {
    'name': folderName,
    'mimeType': 'application/vnd.google-apps.folder'
  };
  const file = await drive.files.create({
    resource: fileMetadata,
    fields: 'id'
  });
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

export { authorize };