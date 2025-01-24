import express from 'express';
import { authorize, createFolder } from '../APIs/Drive.js';
import { google } from 'googleapis';
import multer from 'multer';
import { Readable } from 'stream';
import { getConnection, sql } from '../database/connection.js';
const router = express.Router();

// Configura multer para manejar la carga de archivos
const upload = multer();

router.get('/buscar-archivos/carpeta/:cod_emp', async (req, res) => {
  const { cod_emp } = req.params;

  try {
    const authClient = await authorize();
    const drive = google.drive({ version: 'v3', auth: authClient });

    let folderId = await buscarCarpetaPorCodEmp(drive, cod_emp);
    if (!folderId) {
      return res.status(404).json({ success: false, error: 'No se encontró la carpeta' });
    }

    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      spaces: 'drive',
      fields: 'files(id, name, mimeType)'
    });

    const archivos = response.data.files;
    res.status(200).json({ success: true, archivos });
  } catch (error) {
    console.error('Error buscando los archivos:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint para obtener los tipos de documentos
router.get('/tiposDocumentos', async (req, res) => {
  try{
    const pool= await getConnection();
    const result = await pool.request()
    .execute('spObtenerTipoDocumentos');
    res.json(result.recordset);
  }catch(error){
    console.error('Error fetching tipos de documentos:', error);
    res.status(500).json({ error: 'Error fetching tipos de documentos' });
  }
});

// Endpoint para crear una carpeta
router.post('/crear-carpeta/:cod_emp', async (req, res) => {
  const { cod_emp } = req.params;
  try {
    const authClient = await authorize();
    const folderId = await createFolder(authClient, cod_emp);
    res.status(200).json({ success: true, folderId });
  } catch (error) {
    console.error('Error creando la carpeta:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint para subir un archivo
router.post('/subir-archivo', upload.single('archivo'), async (req, res) => {
  let { cod_emp, tipo_documento } = req.body;
  const archivo = req.file;

  if (!archivo) {
    return res.status(400).json({ error: 'Falta el archivo' });
  }
  if (!cod_emp) {
    return res.status(400).json({ error: 'Falta el parámetro cod_emp' });
  }
  cod_emp = cod_emp.replace(/\s+/g, '');
  try {
    const authClient = await authorize();
    const drive = google.drive({ version: 'v3', auth: authClient });

    // Verificar si la carpeta existe, si no, crearla
    let folderId = await buscarCarpetaPorCodEmp(drive, cod_emp);
    if (!folderId) {
      folderId = await createFolder(authClient, cod_emp);
    }

    // Renombrar el archivo según el tipo de documento
    let nombreArchivo = archivo.originalname;
    if (tipo_documento === 'Cédula') {
      nombreArchivo = `CEDULA_${cod_emp}.pdf`;
    } else if (tipo_documento === 'RIF') {
      nombreArchivo = `RIF_${cod_emp}.pdf`;
    } else if (tipo_documento === 'Recibo') {
      nombreArchivo = `RECIBO_DE_PAGO_${cod_emp}.pdf`;
    }

    // Convertir el buffer del archivo en un stream
    const bufferStream = new Readable();
    bufferStream.push(archivo.buffer);
    bufferStream.push(null);

    // Sube el archivo
    const fileMetadata = {
      name: nombreArchivo,
      parents: [folderId]
    };
    const media = {
      mimeType: archivo.mimetype,
      body: bufferStream
    };
    const response = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id'
    });

    res.status(200).json({ success: true, fileId: response.data.id });
  } catch (error) {
    console.error('Error subiendo el archivo:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Función para buscar la carpeta por cod_emp
async function buscarCarpetaPorCodEmp(drive, cod_emp) {
  try {
    const response = await drive.files.list({
      q: `name='${cod_emp}' and mimeType='application/vnd.google-apps.folder'`,
      spaces: 'drive',
      fields: 'nextPageToken, files(id, name)'
    });
    const files = response.data.files;
    if (files.length) {
      return files[0].id;
    } else {
      return null;
    }
  } catch (error) {
    console.error(error);
    return null;
  }
}

// Endpoint para subir varios archivos
router.post('/subir-varios-archivos', upload.array('archivos'), async (req, res) => {
  let { cod_emp, tipo_documento } = req.body;
  const archivos = req.files;

  if (!archivos || archivos.length === 0) {
    return res.status(400).json({ error: 'Faltan los archivos' });
  }
  if (!cod_emp) {
    return res.status(400).json({ error: 'Falta el parámetro cod_emp' });
  }

  cod_emp = cod_emp.replace(/\s+/g, '');
  try {
    const authClient = await authorize();
    const drive = google.drive({ version: 'v3', auth: authClient });

    // Verificar si la carpeta existe, si no, crearla
    let folderId = await buscarCarpetaPorCodEmp(drive, cod_emp);
    if (!folderId) {
      folderId = await createFolder(authClient, cod_emp);
    }

    // Subir cada archivo
    const fileIds = [];
    for (const archivo of archivos) {
      // Renombrar el archivo según el tipo de documento
      const fechaActual = new Date().toLocaleString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).replace(/ /g, '_');
      let nombreArchivo = archivo.originalname;
      
      nombreArchivo = `${cod_emp}_${tipo_documento}`;
      try {
        const pool= await getConnection();
        const result = await pool.request()
        .input('cod_emp', sql.Char, cod_emp)
        .input('tipo_documento', sql.NVarChar, tipo_documento)
        .input('nombre', sql.NVarChar, nombreArchivo)
        .input('fechaEmision', sql.date, fechaActual)
        .execute('spInsertarDocumentos');
      }catch{
        console.error('Error insertando el documento en la base de datos');
        res.status(500).json({ success: false, error: error.message });
      }

      nombreArchivo = `${cod_emp}_${tipo_documento}_${fechaActual}`;
      // Convertir el buffer del archivo en un stream
      const bufferStream = new Readable();
      bufferStream.push(archivo.buffer);
      bufferStream.push(null);

      const fileMetadata = {
        name: nombreArchivo,
        parents: [folderId]
      };
      const media = {
        mimeType: archivo.mimetype,
        body: bufferStream
      };
      const response = await drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: 'id'
      });

      fileIds.push(response.data.id);
    }

    res.status(200).json({ success: true, fileIds });
  } catch (error) {
    console.error('Error al subir los archivos:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;