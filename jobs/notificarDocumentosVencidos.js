import cron from 'node-cron';
import { getConnection, sql } from '../database/connection.js';
import { sendMailWithRetry } from '../functions/transporter.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Solución para __dirname en ES modules:
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function notificarDocumentosVencidos() {
  
  cron.schedule('0 8 * * 1', async () => {
    try {
      const pool = await getConnection();
      // Trae empleados con pendientes y los datos html desde SQL
      const result = await pool.request().execute('spEmpleadosDocumentosPendientes');
      // Leer la plantilla HTML una sola vez fuera del ciclo
      const plantillaPath = path.join(__dirname, '../templates/plantillaCorreoDocumentos.html');
      const plantillaHtml = fs.readFileSync(plantillaPath, 'utf8');
      console.log('Subiendo correos de documentos vencidos...');
      for (const emp of result.recordset) {
        let detalles = '';
        if (emp.documentosVencidos) {
          detalles += `<b>Documentos vencidos:</b><ul style='color:#d32f2f;'>`;
          detalles += emp.documentosVencidos.split(', ').map(doc => `<li>${doc}</li>`).join('');
          detalles += '</ul>';
        }
        if (emp.documentosObligatorios) {
          detalles += `<b>Documentos obligatorios que debes subir:</b><ul style='color:#f57c00;'>`;
          detalles += emp.documentosObligatorios.split(', ').map(doc => `<li>${doc}</li>`).join('');
          detalles += '</ul>';
        }
        if (!detalles) continue; // No enviar si no hay nada que mostrar
        let html = plantillaHtml
          .replace(/{{nombre_completo}}/g, emp.nombre_completo)
          .replace('{{detalles}}', detalles)
          .replace('{{anio}}', new Date().getFullYear());
        const mailOptions = {
          from: 'Intranet Seguros Altamira <intranet@segurosaltamira.com.ve>',
          to: emp.correo_e,
          subject: 'Hora de Actualizar tu Expediente',
          html
        };
        
        const resultado = await sendMailWithRetry(mailOptions);
        if (!resultado.success) {

          console.error(`Error enviando correo a ${emp.correo_e}:`, resultado.error);
        }
      }
      console.log('Correos de documentos vencidos enviados.');
    } catch (error) {
      console.error('Error enviando correos de documentos vencidos:', error);
    }
  }, {
    timezone: 'America/Caracas'
  });
}
