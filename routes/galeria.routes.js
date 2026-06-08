import express from 'express';
import { getConnection } from '../database/connection.js';
import { authorize } from '../APIs/Drive.js';
import { google } from 'googleapis';

const router = express.Router();

// Caché en memoria: clave → { data, ts }
const CACHE = new Map();

const cached = async (key, ttlMs, fetcher) => {
  const hit = CACHE.get(key);
  if (hit && Date.now() - hit.ts < ttlMs) return hit.data;
  const data = await fetcher();
  CACHE.set(key, { data, ts: Date.now() });
  return data;
};

// ──────────────────────────────────────────────────────────
// GET /galeria/titulo
// ──────────────────────────────────────────────────────────
router.get('/titulo', async (req, res) => {
  try {
    const titulo = await cached('galeria:titulo', 60 * 60 * 1000, async () => {
      const pool = await getConnection();
      const result = await pool.request().execute('spTituloGaleria');
      return result.recordset[0].titulo;
    });
    res.json({ titulo });
  } catch (error) {
    console.error('Error al obtener el título de la galería:', error);
    res.status(500).json({ error: 'Error al obtener el título de la galería' });
  }
});

// ──────────────────────────────────────────────────────────
// GET /galeria/carpetas/:parentFolderId
// Devuelve subcarpetas de una carpeta padre. Caché 10 min.
// ──────────────────────────────────────────────────────────
router.get('/carpetas/:parentFolderId', async (req, res) => {
  const { parentFolderId } = req.params;
  try {
    const data = await cached(`carpetas:${parentFolderId}`, 60 * 60 * 1000, async () => {
      const authClient = await authorize();
      const drive = google.drive({ version: 'v3', auth: authClient });
      const response = await drive.files.list({
        q: `'${parentFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id,name)',
        orderBy: 'name',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });
      return response.data;
    });
    res.json(data);
  } catch (error) {
    console.error('Error listando carpetas de galería:', error);
    res.status(500).json({ error: error.message });
  }
});

// ──────────────────────────────────────────────────────────
// GET /galeria/fotos/:folderId?pageToken=&pageSize=30
// Devuelve fotos y videos de una carpeta. Caché 5 min por página.
// ──────────────────────────────────────────────────────────
router.get('/fotos/:folderId', async (req, res) => {
  const { folderId } = req.params;
  const { pageToken = '', pageSize = '30' } = req.query;
  try {
    const data = await cached(`fotos:${folderId}:${pageToken}`, 80 * 60 * 1000, async () => {
      const authClient = await authorize();
      const drive = google.drive({ version: 'v3', auth: authClient });
      const params = {
        q: `'${folderId}' in parents and (mimeType contains 'image/' or mimeType contains 'video/')`,
        fields: 'nextPageToken, files(id,thumbnailLink,mimeType,webViewLink,videoMediaMetadata(durationMillis))',
        pageSize: parseInt(pageSize, 10),
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      };
      if (pageToken) params.pageToken = pageToken;
      const response = await drive.files.list(params);
      return response.data;
    });
    res.json(data);
  } catch (error) {
    console.error('Error listando fotos de galería:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
