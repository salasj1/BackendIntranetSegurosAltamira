import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { sendEmail } from '../functions/EmailQueue.js';
import { getConnection, sql } from '../database/connection.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function enviarCorreo(cod_emp, fechaInicio, fechaFin, fechaRetorno, tipo, templatePath, subjectPrefix, Titulo = null, Motivo = null, destinatario = null) {
  try {
    const pool = await getConnection();
    console.log(`Enviando correo de ${subjectPrefix.toLowerCase()}:`, cod_emp, fechaInicio, fechaFin, fechaRetorno);

    // Buscar supervisores
    let supervisores = await pool.request()
      .input('cod_emp', sql.Char, cod_emp)
      .input('tipo', sql.Int, tipo)
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

      let result;
      if (tipo === 1) {
        result = await pool.request()
          .input('cod_emp', sql.Char, cod_emp)
          .input('FechaInicio', sql.Date, fechaInicio)
          .input('FechaRetorno', sql.Date, fechaRetorno)
          .input('FechaFin', sql.Date, fechaFin)
          .input('nombresSupervisor', sql.VarChar, supervisor.nombres)
          .input('apellidosSupervisor', sql.VarChar, supervisor.apellidos)
          .query('SELECT [dbo].[ftCorreoSolcitudVacaciones] (@cod_emp, @FechaInicio, @FechaRetorno,@FechaFin, @nombresSupervisor, @apellidosSupervisor) AS result');
      } else  {
        result = await pool.request()
          .input('cod_emp', sql.Char, cod_emp)
          .input('FechaInicio', sql.Date, fechaInicio)
          .input('FechaFin', sql.Date, fechaFin)
          .input('Titulo', sql.VarChar, Titulo)
          .input('Motivo', sql.VarChar, Motivo)
          .input('nombresSupervisor', sql.VarChar, supervisor.nombres)
          .input('apellidosSupervisor', sql.VarChar, supervisor.apellidos)
          .query('SELECT [dbo].[ftCorreoSolcitudPermisos] (@cod_emp, @FechaInicio, @FechaFin, @Titulo, @Motivo, @nombresSupervisor, @apellidosSupervisor) AS result');
      }

      const { result: cuerpo, trabajador } = JSON.parse(result.recordset[0].result);

      // Leer el archivo de plantilla
      let htmlContent = fs.readFileSync(templatePath, 'utf8');
      htmlContent = htmlContent.replace('${cuerpo}', cuerpo);

      const mailOptions = {
        from: 'IntranetSegurosAltamira@segurosaltamira.com',
        to: destinatario || supervisor.correo,
        subject: `${subjectPrefix} de ${trabajador}`,
        html: htmlContent
      };

      // Enviar el correo directamente
      const emailResult = await sendEmail(mailOptions);
      if (!emailResult.success) {
        console.error(`Error enviando correo de ${subjectPrefix.toLowerCase()}:`, emailResult.error);
      }
    }
  } catch (error) {
    console.error(`Error enviando correo de ${subjectPrefix.toLowerCase()}:`, error);
  }
}

export async function enviarCorreoSolicitudVacaciones(cod_emp, fechaInicio, fechaRetorno,fechaFin) {
  const templatePath = path.join(__dirname, "../templates/correo_Solicitud_vacaciones.html");
  await enviarCorreo(cod_emp, fechaInicio, fechaFin, fechaRetorno,  1, templatePath, 'Solicitud de Vacaciones');
}

export async function enviarCorreoSolicitudPermiso(cod_emp, fechaInicio, fechaFin, Titulo, Motivo) {
  const templatePath = path.join(__dirname, "../templates/correo_Solicitud_Permisos.html");
  await enviarCorreo(cod_emp, fechaInicio, fechaFin, null, 2, templatePath, 'Solicitud de Permiso', Titulo, Motivo);
}

export async function enviarCorreoProcesarVacaciones(VacacionID) {
  try {
    console.log('Enviando correo de procesar vacaciones:', VacacionID);
    const pool = await getConnection();
    const result = await pool.request()
      .input('VacacionID', sql.Int, VacacionID)
      .query('SELECT [dbo].[ftCorreoProcesarVacaciones] (@VacacionID) AS result');

    const { result: cuerpo, trabajador } = JSON.parse(result.recordset[0].result);
    console.log('Cuerpo del correo:', cuerpo);
    const templatePath = path.join(__dirname, "../templates/correo_Procesar_vacaciones.html");
    let htmlContent = fs.readFileSync(templatePath, 'utf8');
    htmlContent = htmlContent.replace('${cuerpo}', cuerpo);

    const mailOptions = {
      from: 'IntranetSegurosAltamira@segurosaltamira.com',
      to: 'alejandro.salas@segurosaltamira.com',
      subject: `Procesar Vacaciones de ${trabajador}`,
      html: htmlContent
    };
    console.log('A punto de enviar correo de procesar vacaciones:', mailOptions);
    const emailResult = await sendEmail(mailOptions);
    console.log('Correo de procesar vacaciones enviado');
    if (!emailResult.success) {
      console.error('Error enviando correo de procesar vacaciones:', emailResult.error);
    }
  } catch (error) {
    console.error('Error enviando correo de procesar vacaciones:', error);
  }
}

export async function enviarCorreoProcesarPermiso(PermisoID) {
  try {
    console.log('Enviando correo de procesar permiso:', PermisoID);
    const pool = await getConnection();
    const result = await pool.request()
      .input('PermisoID', sql.Int, PermisoID)
      .query('SELECT [dbo].[ftCorreoProcesarPermisos] (@PermisoID) AS result');

    const { result: cuerpo, trabajador } = JSON.parse(result.recordset[0].result);

    const templatePath = path.join(__dirname, "../templates/correo_Procesar_Permisos.html");
    let htmlContent = fs.readFileSync(templatePath, 'utf8');
    htmlContent = htmlContent.replace('${cuerpo}', cuerpo);

    const mailOptions = {
      from: 'IntranetSegurosAltamira@segurosaltamira.com',
      to: 'alejandro.salas@segurosaltamira.com',
      subject: `Procesar Permiso de ${trabajador}`,
      html: htmlContent
    };
    console.log('A punto de enviar correo de procesar permiso:', mailOptions);
    const emailResult = await sendEmail(mailOptions);
    console.log('Correo de procesar permiso enviado');
    if (!emailResult.success) {
      console.error('Error enviando correo de procesar permiso:', emailResult.error);
    }
  } catch (error) {
    console.error('Error enviando correo de procesar permiso:', error);
  }
}