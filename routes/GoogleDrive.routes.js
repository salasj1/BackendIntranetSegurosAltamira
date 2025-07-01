import express from 'express';
import { authorize, createFolder, BuscarDocumento, getOrCreateSubfolder, moveFileToFolder } from '../APIs/Drive.js';
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
      fields: 'files(id, name, mimeType, webContentLink, webViewLink)',
      supportsAllDrives: true,
    includeItemsFromAllDrives: true
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
  try {
    const pool = await getConnection();
    const result = await pool.request()
      .execute('spObtenerTipoDocumentos');
    res.json(result.recordset);
  } catch (error) {
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
  const parentFolderId = process.env.VITE_GOOGLE_DRIVE_FOLDER_ID ;
  try {
    const response = await drive.files.list({
      q: `'${parentFolderId}' in parents and name='${cod_emp}' and mimeType='application/vnd.google-apps.folder'  `,
      fields: 'nextPageToken, files(id, name)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true
    });
    const files = response.data.files;
    if (files && files.length > 0) {
      return files[0].id;
    } else {
      console.error(`Folder with name '${cod_emp}' not found in parent folder '${parentFolderId}'.`);
      return null;
    }
  } catch (error) {
    if (error.response && error.response.status === 404) {
      console.error(`Folder not found or inaccessible: ${error.response.data.error.message}`);
    } else {
      console.error('Unexpected error:', error);
    }
    return null;
  }
}

// Endpoint para subir varios archivos
router.post('/subir-varios-archivos', upload.array('archivos'), async (req, res) => {
  let { cod_emp, cedula, tipo_documento, fecha_actualizacion, fecha_vencimiento, correo } = req.body;
  const archivos = req.files;

  if (!archivos || archivos.length === 0) {
    return res.status(400).json({ error: 'Faltan los archivos' });
  }
  if (!cedula) {
    return res.status(400).json({ error: 'Falta el parámetro cedula' });
  }

  cedula = cedula.replace(/\s+/g, '').replace(/\./g, '');
  try {
    const authClient = await authorize();
    const drive = google.drive({ version: 'v3', auth: authClient });

    // Verificar si la carpeta existe, si no, crearla y compartirla con el empleado
    let folderId = await buscarCarpetaPorCodEmp(drive, cedula);
    let correoEmpleado = correo || null;
    if (!folderId) {
      // Buscar el correo del empleado en la base de datos usando cod_emp si no viene en el request
      if (!correoEmpleado) {
        try {
          const pool = await getConnection();
          const result = await pool.request()
            .input('cod_emp', sql.VarChar, cod_emp)
            .query(`SELECT TOP 1 correo_e FROM VSNEMPLE WHERE cod_emp = @cod_emp`);
          if (result.recordset.length > 0) {
            correoEmpleado = result.recordset[0].correo_e;
          }
        } catch (err) {
          console.error('Error buscando correo del empleado:', err);
        }
      }
      // Crear la carpeta y compartirla si se encontró el correo
      folderId = await createFolder(authClient, cedula, correoEmpleado);
    } else if (correoEmpleado) {
      // Si la carpeta ya existe, compartirla si el correo no tiene permiso
      try {
        // Verificar si ya tiene permiso
        const permissions = await drive.permissions.list({
          fileId: folderId,
          supportsAllDrives: true
        });
        const yaTienePermiso = permissions.data.permissions && permissions.data.permissions.some(p => p.emailAddress === correoEmpleado);
        if (!yaTienePermiso) {
          await drive.permissions.create({
            fileId: folderId,
            resource: {
              type: 'user',
              role: 'reader',
              emailAddress: correoEmpleado,
            },
            sendNotificationEmail: false,
            supportsAllDrives: true
          });
        }
      } catch (err) {
        console.error('Error compartiendo carpeta existente:', err);
      }
    }

    console.log('Request body:', fecha_actualizacion);
    // Subir cada archivo
    const fechaActual = new Date();
    const fileIds = [];
    for (const archivo of archivos) {
      // Renombrar el archivo según el tipo de documento
      let nombreArchivo = archivo.originalname;
      console.log('fecha Actual: ', fechaActual);
      const formattedDate = `${fechaActual.getDate().toString().padStart(2, '0')}-${(fechaActual.getMonth() + 1).toString().padStart(2, '0')}-${fechaActual.getFullYear()}`;
      console.log('fecha Vencimiento: ', fecha_vencimiento);
      if (
        (tipo_documento === "Cedula" || tipo_documento === "Rif") &&
        fecha_vencimiento
      ) {
        // Formatear la fecha de vencimiento a DD-MM-YYYY
        const [yyyy, mm, dd] = fecha_vencimiento.split('-');
        const formattedFechaVencimiento = `${dd}-${mm}-${yyyy}`;
        nombreArchivo = `${cedula}_${tipo_documento}_${formattedDate}_${formattedFechaVencimiento}`;
      } else {
        nombreArchivo = `${cedula}_${tipo_documento}_${formattedDate}`;
      }
      try {
        const pool = await getConnection();
        const result = await pool.request()
          .input('cod_emp', sql.Char, cod_emp)
          .input('TipoDocumento', sql.NVarChar, tipo_documento)
          .input('nombre', sql.NVarChar, nombreArchivo)
          .input('fechaEmision', sql.DateTime, fechaActual)
          .input('Recordatorio', sql.Date, fecha_actualizacion)
          .output('STATUS', sql.Int)
          .output('RESULTADO', sql.VarChar(2500))
          .execute('[db_accessadmin].[spCargarDocumento]');

        // Agregar el resultado a la lista de resultados
        fileIds.push(result.recordset);
      } catch (error) {
        console.error('Error insertando el documento en la base de datos:', error);
        throw new Error('Error insertando el documento en la base de datos');
      }

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
        fields: 'id',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true
      });

      fileIds.push(response.data.id);
    }

    res.status(200).json({ success: true, fileIds });
  } catch (error) {
    console.error('Error al subir los archivos:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/buscar-documento', async (req, res) => {
  const { cedula, tipo_documento, correo, cod_emp } = req.query;
  if (!cedula || !tipo_documento) {
    return res.status(400).json({ error: 'Faltan parámetros' });
  }
  const cedulaNumerica = cedula.replace(/\D/g, '');
  try {
    const authClient = await authorize();
    const drive = google.drive({ version: 'v3', auth: authClient });
    // Buscar la carpeta
    let folderId = await buscarCarpetaPorCodEmp(drive, cedulaNumerica);
    let correoEmpleado = correo || null;
    if (!correoEmpleado && cod_emp) {
      try {
        const pool = await getConnection();
        const result = await pool.request()
          .input('cod_emp', sql.VarChar, cod_emp)
          .query(`SELECT TOP 1 correo_e FROM VSNEMPLE WHERE cod_emp = @cod_emp`);
        if (result.recordset.length > 0) {
          correoEmpleado = result.recordset[0].correo_e;
        }
      } catch (err) {
        console.error('Error buscando correo del empleado:', err);
      }
    }
    // Si la carpeta existe y hay correo, compartir si no tiene permiso
    if (folderId && correoEmpleado) {
      try {
        const permissions = await drive.permissions.list({
          fileId: folderId,
          supportsAllDrives: true
        });
        const yaTienePermiso = permissions.data.permissions && permissions.data.permissions.some(p => p.emailAddress === correoEmpleado);
        if (!yaTienePermiso) {
          await drive.permissions.create({
            fileId: folderId,
            resource: {
              type: 'user',
              role: 'reader',
              emailAddress: correoEmpleado,
            },
            sendNotificationEmail: false,
            supportsAllDrives: true
          });
        }
      } catch (err) {
        console.error('Error compartiendo carpeta existente (buscar-documento):', err);
      }
    }
    const file = await BuscarDocumento(authClient, cedulaNumerica, tipo_documento);
    if (file) {
      res.json({
        found: true,
        file: {
          name: file.name,
          id: file.id,
          webContentLink: file.webContentLink,
          webViewLink: file.webViewLink
        }
      });
    } else {
      res.json({ found: false });
    }
  } catch (error) {
    res.status(500).json({ error: 'Error buscando documento' });
  }
});

// Endpoint para actualizar un archivo
router.post('/actualizar-archivo', upload.single('archivo'), async (req, res) => {
  const { cedula, tipo_documento, fileIdViejo, fecha_vencimiento } = req.body;
  const archivoNuevo = req.file;
  if (!archivoNuevo || !cedula || !tipo_documento || !fileIdViejo) {
    return res.status(400).json({ error: 'Faltan parámetros' });
  }
  try {
    const authClient = await authorize();
    const drive = google.drive({ version: 'v3', auth: authClient });
    const cedulaNumerica = cedula.replace(/\D/g, '');
    let empleadoFolderId = await buscarCarpetaPorCodEmp(drive, cedulaNumerica);
    if (!empleadoFolderId) {
      return res.status(404).json({ error: 'No se encontró la carpeta del empleado' });
    }
    const subfolderId = await getOrCreateSubfolder(drive, empleadoFolderId);
    await moveFileToFolder(drive, fileIdViejo, subfolderId);

    // Renombrar el archivo
    const fechaActual = new Date();
    const formattedDate = `${fechaActual.getDate().toString().padStart(2, '0')}-${(fechaActual.getMonth() + 1).toString().padStart(2, '0')}-${fechaActual.getFullYear()}`;
    let nombreArchivo = `${cedulaNumerica}_${tipo_documento}_${formattedDate}`;
    // Si es Cedula o Rif y hay fecha de vencimiento, agregarla
    if (
      (tipo_documento === "Cedula" || tipo_documento === "Rif") &&
      fecha_vencimiento
    ) {
      // Formatear la fecha de vencimiento a DD-MM-YYYY
      const [yyyy, mm, dd] = fecha_vencimiento.split('-');
      const formattedFechaVencimiento = `${dd}-${mm}-${yyyy}`;
      nombreArchivo = `${cedulaNumerica}_${tipo_documento}_${formattedDate}_${formattedFechaVencimiento}`;
    }

    const bufferStream = new Readable();
    bufferStream.push(archivoNuevo.buffer);
    bufferStream.push(null);

    const fileMetadata = {
      name: nombreArchivo,
      parents: [empleadoFolderId]
    };
    const media = {
      mimeType: archivoNuevo.mimetype,
      body: bufferStream
    };
    const response = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id',
      supportsAllDrives: true
    });

    res.status(200).json({ success: true, fileIdNuevo: response.data.id });
  } catch (error) {
    console.error('Error actualizando el archivo:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;