import cron from 'node-cron';
import { importarDocumentosDesdeSheet } from '../utils/importarDocumentosDesdeSheet.js';

export function sincronizarDocumentosBD() {
  cron.schedule('0 0 * * *', async () => {
    try {
      console.log('Ejecutando Sincronizacion automática de documentos desde Google Sheets...');
      const resultado = await importarDocumentosDesdeSheet();
      console.log(resultado.message);
    } catch (error) {
      console.error('Error en la importación automática:', error);
    }
  }, {
    timezone: 'America/Caracas'
  });
}
  
