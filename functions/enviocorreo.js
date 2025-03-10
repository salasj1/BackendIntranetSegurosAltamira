import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import {sendEmail } from '../functions/EmailQueue.js';
import { getConnection, sql } from '../database/connection.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Función para enviar correo de solicitud de vacaciones
export async function enviarCorreoSolicitudVacaciones(cod_emp, fechaInicio, fechaFin, fechaRetorno) {
    try {
        const pool = await getConnection();
        console.log('Enviando correo de solicitud de vacaciones:', cod_emp, fechaInicio, fechaFin, fechaRetorno);
        // Buscar supervisores
        let supervisores = await pool.request()
            .input('cod_emp', sql.Char, cod_emp)
            .input('tipo', sql.Int, 1)
            .execute('[db_accessadmin].[spBuscarSupervisores]');

        // Verificar si hay supervisores
        if (supervisores.recordset.length === 0) {
            console.error('No se encontraron supervisores para el empleado:', cod_emp);
            return; // Salir de la función si no hay supervisores
        }

        // Enviar correos a cada supervisor
        for (const supervisor of supervisores.recordset) {
            if (!supervisor.correo) {
                console.error('Supervisor email is missing:', supervisor);
                continue; // Saltar este supervisor si no tiene correo
            }

            let result = await pool.request()
                .input('cod_emp', sql.Char, cod_emp)
                .input('FechaInicio', sql.Date, fechaInicio)
                .input('FechaFin', sql.Date, fechaFin)
                .input('FechaRetorno', sql.Date, fechaRetorno)
                .input('nombresSupervisor', sql.VarChar, supervisor.nombres)
                .input('apellidosSupervisor', sql.VarChar, supervisor.apellidos)
                .query('SELECT [dbo].[ftCorreoSolcitudVacaciones] (@cod_emp, @FechaInicio, @FechaFin, @FechaRetorno, @nombresSupervisor, @apellidosSupervisor) AS result');

            const { result: cuerpo, trabajador } = JSON.parse(result.recordset[0].result);

            // Leer el archivo correo_recibo.html
            const templatePath = path.join(__dirname, "../templates/correo_Solicitud_vacaciones.html");
            let htmlContent = fs.readFileSync(templatePath, 'utf8');
            htmlContent = htmlContent.replace('${cuerpo}', cuerpo);

            const mailOptions = {
                from: 'IntranetSegurosAltamira@segurosaltamira.com',
                to: supervisor.correo,
                subject: `Solicitud de Vacaciones de ${trabajador}`,
                html: htmlContent
            };

            // Enviar el correo directamente
            const emailResult = await sendEmail(mailOptions);
            if (!emailResult.success) {
                console.error('Error enviando correo de solicitud de vacaciones:', emailResult.error);
            }
        }
    } catch (error) {
        console.error('Error enviando correo de solicitud de vacaciones:', error);
    }
}
  
  // Función para enviar correo de solicitud de permiso
export  async function enviarCorreoSolicitudPermiso(cod_emp, fechaInicio, fechaFin,Titulo,Motivo) {
    try {
      const pool = await getConnection();
        console.log('Enviando correo de solicitud de permiso:', cod_emp, fechaInicio, fechaFin);
      // Buscar supervisores
      let supervisores = await pool.request()
        .input('cod_emp', sql.Char, cod_emp)
        .input('tipo', sql.Int, 2)
        .execute('[db_accessadmin].[spBuscarSupervisores]');
        // Verificar si hay supervisores
        if (supervisores.recordset.length === 0) {
            console.error('No se encontraron supervisores para el empleado:', cod_emp);
            return; // Salir de la función si no hay supervisores
        }
      // Enviar correos a cada supervisor
      for (const supervisor of supervisores.recordset) {
        if (!supervisor.correo) {
          console.error('Supervisor email is missing:', supervisor);
          continue; // Saltar este supervisor si no tiene correo
        }
  
        let result = await pool.request()
          .input('cod_emp', sql.Char, cod_emp)
          .input('FechaInicio', sql.Date, fechaInicio)
          .input('FechaFin', sql.Date, fechaFin)
          .input('Titulo', sql.VarChar, Titulo)
          .input('Motivo', sql.VarChar, Motivo)
          .input('nombresSupervisor', sql.VarChar, supervisor.nombres)
          .input('apellidosSupervisor', sql.VarChar, supervisor.apellidos)
          .query('SELECT [dbo].[ftCorreoSolcitudPermisos] (@cod_emp, @FechaInicio, @FechaFin,@Titulo,@Motivo, @nombresSupervisor, @apellidosSupervisor) AS result');
  
        const { result: cuerpo, trabajador } = JSON.parse(result.recordset[0].result);
  
        // Leer el archivo correo_recibo.html
        const templatePath = path.join(__dirname, "../templates/correo_Solicitud_Permisos.html");
        let htmlContent = fs.readFileSync(templatePath, 'utf8');
        htmlContent = htmlContent.replace('${cuerpo}', cuerpo);
  
        const mailOptions = {
          from: 'IntranetSegurosAltamira@segurosaltamira.com',
          to: supervisor.correo,
          subject: `Solicitud de Permiso de ${trabajador}`,
          html: htmlContent
        };
  
        // Enviar el correo directamente
        const emailResult = await sendEmail(mailOptions);
        if (!emailResult.success) {
          console.error('Error enviando correo de solicitud de permiso:', emailResult.error);
        }
      }
    } catch (error) {
      console.error('Error enviando correo de solicitud de permiso:', error);
    }
  }