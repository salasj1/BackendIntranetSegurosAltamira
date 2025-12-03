import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { sendEmail } from '../functions/emailQueue.js';
import { getConnection, sql } from '../database/connection.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicImagesPath = path.join(process.cwd(), 'public', 'images');
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
      throw new Error('No se encontraron supervisores para el empleado.');
    }

    // Enviar correos a cada supervisor
    for (const supervisor of supervisores.recordset) {
      if (!supervisor.correo) {
        console.error('Supervisor email is missing:', supervisor);
        continue; // Saltar este supervisor si no tiene correo
      }
      
      const attachments = [
        {
          filename: 'logo.png',
          path: path.join(publicImagesPath, 'logo.png'),
          cid: 'logoEmpresa'
        }
      ];
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
      
        attachments.push({
          filename: 'solicitar_vacaciones.png',
          path: path.join(publicImagesPath, 'solicitar_vacaciones.png'),
          cid: 'SolicitudVacaciones'
        });
        } else {
        result = await pool.request()
          .input('cod_emp', sql.Char, cod_emp)
          .input('FechaInicio', sql.Date, fechaInicio)
          .input('FechaFin', sql.Date, fechaFin)
          .input('Titulo', sql.VarChar, Titulo)
          .input('Motivo', sql.VarChar, Motivo)
          .input('nombresSupervisor', sql.VarChar, supervisor.nombres)
          .input('apellidosSupervisor', sql.VarChar, supervisor.apellidos)
          .query('SELECT [dbo].[ftCorreoSolcitudPermisos] (@cod_emp, @FechaInicio, @FechaFin, @Titulo, @Motivo, @nombresSupervisor, @apellidosSupervisor) AS result');
        
        attachments.push({
          filename: 'solcitud_permiso.png',
          path: path.join(publicImagesPath, 'solcitud_permiso.png'),
          cid: 'SolicitudPermiso'
        });
      
        }

      const { result: cuerpo, trabajador } = JSON.parse(result.recordset[0].result);
      
      // Leer el archivo de plantilla
      let htmlContent = fs.readFileSync(templatePath, 'utf8');
      htmlContent = htmlContent.replace('${cuerpo}', cuerpo);

      const mailOptions = {
        from: '"Intranet Seguros Altamira" <IntranetSegurosAltamira@segurosaltamira.com>',
        to: 'alejandro.salas@segurosaltamira.com'/* destinatario || supervisor.correo */,
        subject: `${subjectPrefix} de ${trabajador}`,
        html: htmlContent,
        attachments:attachments
      };

      // Enviar el correo directamente
      const emailResult = await sendEmail(mailOptions);
      if (!emailResult.success) {
        console.error(`Error enviando correo de ${subjectPrefix.toLowerCase()}:`, emailResult.error);
        throw new Error(`Error enviando correo: ${emailResult.message || 'Error desconocido'}`);
      }
    }
  } catch (error) {
    console.error(`Error enviando correo de ${subjectPrefix.toLowerCase()}:`, error);
    throw error; // Lanzar el error para que sea manejado por las funciones que llaman a esta
  }
}

export async function enviarCorreoSolicitudVacaciones(cod_emp, fechaInicio, fechaRetorno, fechaFin) {
  const templatePath = path.join(__dirname, "../templates/correo_Solicitud_vacaciones.html");
  await enviarCorreo(cod_emp, fechaInicio, fechaFin, fechaRetorno, 1, templatePath, 'Solicitud de Aprobación de Vacaciones');
}

export async function enviarCorreoSolicitudPermiso(cod_emp, fechaInicio, fechaFin, Titulo, Motivo) {
  const templatePath = path.join(__dirname, "../templates/correo_Solicitud_Permisos.html");
  await enviarCorreo(cod_emp, fechaInicio, fechaFin, null, 2, templatePath, 'Solicitud de Aprobación de Permiso', Titulo, Motivo);
}

export async function enviarCorreoProcesarVacaciones(VacacionID) {
  try {
    console.log('Enviando correo de procesar vacaciones:', VacacionID);
    const pool = await getConnection();
    const result = await pool.request()
      .input('VacacionID', sql.Int, VacacionID)
      .query('SELECT [dbo].[ftCorreoProcesarVacaciones] (@VacacionID) AS result');

    const { result: cuerpo, trabajador } = JSON.parse(result.recordset[0].result);
    const attachments = [
    {
      filename: 'logo.png',
      path: path.join(publicImagesPath, 'logo.png'),
      cid: 'logoEmpresa',
      filename:'procesar_vacaciones.gif',
      path: path.join(publicImagesPath, 'procesar_vacaciones.gif'),
      cid:'procesarVacaciones',

    }];
    const templatePath = path.join(__dirname, "../templates/correo_Procesar_vacaciones.html");
    let htmlContent = fs.readFileSync(templatePath, 'utf8');
    htmlContent = htmlContent.replace('${cuerpo}', cuerpo)
                  .replace('${BASE_URL}', process.env.BASE_URL);

    const mailOptions = {
      from: '"Intranet Seguros Altamira" <IntranetSegurosAltamira@segurosaltamira.com>',
      to: 'alejandro.salas@segurosaltamira.com'/* 'capitalhumano@segurosaltamira.com' */,
      subject: `Procesar Vacaciones de ${trabajador}`,
      html: htmlContent,
      attachments:attachments
    };
  
    const emailResult = await sendEmail(mailOptions);

    if (!emailResult.success) {
      console.error('Error enviando correo de procesar vacaciones:', emailResult.error);
      throw new Error(`Error enviando correo: ${emailResult.message || 'Error desconocido'}`);
    }
  } catch (error) {
    console.error('Error enviando correo de procesar vacaciones:', error);
    throw error;
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
    const attachments = [
        {
          filename: 'logo.png',
          path: path.join(publicImagesPath, 'logo.png'),
          cid: 'logoEmpresa',
          filename:'procesando.gif',
          path: path.join(publicImagesPath, 'procesando.gif'),
          cid: 'procesando',
      }];
    const templatePath = path.join(__dirname, "../templates/correo_Procesar_Permisos.html");
    let htmlContent = fs.readFileSync(templatePath, 'utf8');
    htmlContent = htmlContent.replace('${cuerpo}', cuerpo)
                .replace(/\${BASE_URL}/g, process.env.BASE_URL);  

    const mailOptions = {
      from: '"Intranet Seguros Altamira" <IntranetSegurosAltamira@segurosaltamira.com>',
      to: 'alejandro.salas@segurosaltamira.com'/* 'capitalhumano@segurosaltamira.com' */,
      subject: `Procesar Permiso de ${trabajador}`,
      html: htmlContent
    };
    
    const emailResult = await sendEmail(mailOptions);
    
    if (!emailResult.success) {
      console.error('Error enviando correo de procesar permiso:', emailResult.error);
      throw new Error(`Error enviando correo: ${emailResult.message || 'Error desconocido'}`);
    }
  } catch (error) {
    console.error('Error enviando correo de procesar permiso:', error);
    throw error;
  }
}


export async function enviarCorreoSolicitudCambioDatos(cod_emp, cambios, nombres, apellidos) {
  try {
    // Buscar correo de RRHH (puedes cambiar el destinatario si lo necesitas)
    const destinatario = 'capitalhumano@segurosaltamira.com';
    const templatePath = path.join(__dirname, '../templates/correo_Solicitud_CambioDatos.html');
    const attachments = [
    {
      filename: 'logo.png',
      path: path.join(publicImagesPath, 'logo.png'),
      cid: 'logoEmpresa',
      filename:'solcitud_datos_personales.gif',
      path: path.join(publicImagesPath, 'solcitud_datos_personales.gif'),
      cid:'solicitudDatosPersonales'
    }];
    let htmlContent = fs.readFileSync(templatePath, 'utf8');
    // Generar cuerpo dinámico con los cambios solicitados
    let cuerpo = '<ul>';
    for (const cambio of cambios) {
      cuerpo += `<li><b>${cambio.etiqueta}:</b> ${cambio.solicitud}</li>`;
    }
    cuerpo += '</ul>';

    htmlContent = htmlContent.replace('${cuerpo}', cuerpo);
    htmlContent = htmlContent.replace('${nombres}', nombres);
    htmlContent = htmlContent.replace('${apellidos}', apellidos);
    const mailOptions = {
      from: 'Intranet Seguros Altamira <IntranetSegurosAltamira@segurosaltamira.com>',
      to: 'alejandro.salas@segurosaltamira.com'/* destinatario */,
      subject: `Solicitud de cambio de datos personales de ${nombres} ${apellidos}`,
      html: htmlContent,
      attachments:attachments
    };
    const emailResult = await sendEmail(mailOptions);
    if (!emailResult.success) {
      console.error('Error enviando correo de solicitud de cambio de datos:', emailResult.error);
      throw new Error(`Error enviando correo: ${emailResult.message || 'Error desconocido'}`);
    }
  } catch (error) {
    console.error('Error enviando correo de solicitud de cambio de datos:', error);
    throw error;
  }
}

/**
 * Envía un correo al empleado notificando que sus vacaciones han sido aprobadas por el supervisor.
 * @param {number} VacacionID
 */
export async function enviarCorreoVacacionesAprobadas(VacacionID) {
  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input('VacacionID', sql.Int, VacacionID)
      .query('SELECT dbo.ftCorreoVacacionesAprobadas(@VacacionID) AS result');

    const { nombre, correo, fecha_inicio, fecha_retorno, Numero_Dias_Vacaciones } = JSON.parse(result.recordset[0].result);
    const attachments = [
        {
          filename: 'logo.png',
          path: path.join(publicImagesPath, 'logo.png'),
          cid: 'logoEmpresa',
          filename: 'vacaciones_aprobadas.png',
          path: path.join(publicImagesPath, 'vacaciones_aprobadas.png'),
          cid: 'vacacionesAprobadas',
          filename:'procesando.gif',
          path: path.join(publicImagesPath, 'procesando.gif'),
          cid: 'procesando',

    }];
    const templatePath = path.join(__dirname, "../templates/correo_Vacaciones_Aprobadas.html");
    let htmlContent = fs.readFileSync(templatePath, 'utf8');
    htmlContent = htmlContent
      .replace('${nombre}', nombre)
      .replace('${fecha_inicio}', fecha_inicio)
      .replace('${fecha_retorno}', fecha_retorno)
      .replace('${dias_vacaciones}', Numero_Dias_Vacaciones);

    const mailOptions = {
      from: '"Intranet Seguros Altamira" <IntranetSegurosAltamira@segurosaltamira.com>',
      to: 'alejandro.salas@segurosaltamira.com'/* correo */,
      subject: 'Vacaciones aprobadas por tu supervisor',
      html: htmlContent,
      attachments:attachments
    };

    const emailResult = await sendEmail(mailOptions);
    if (!emailResult.success) {
      console.error('Error enviando correo de vacaciones aprobadas:', emailResult.error);
      throw new Error(`Error enviando correo: ${emailResult.message || 'Error desconocido'}`);
    }
  } catch (error) {
    console.error('Error enviando correo de vacaciones aprobadas:', error);
    throw error;
  }
}

export async function enviarCorreoPermisosAprobados(PermisoID) {
  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input('PermisoID', sql.Int, PermisoID)
      .query('SELECT dbo.ftCorreoPermisosAprobados(@PermisoID) AS result');

    const { PermisosID,nombre, correo, fecha_inicio, fecha_fin,titulo, motivo } = JSON.parse(result.recordset[0].result);

    const templatePath = path.join(__dirname, "../templates/correo_Permiso_Aprobado.html");
    let htmlContent = fs.readFileSync(templatePath, 'utf8');
    htmlContent = htmlContent
      .replace('${nombre}', nombre)
      .replace('${PermisosID}', PermisosID)
      .replace('${fecha_inicio}', fecha_inicio)
      .replace('${fecha_fin}', fecha_fin)
      .replace('${titulo}', titulo)
      .replace('${Motivo}', motivo)
      
    
    const mailOptions = {
      from: '"Intranet Seguros Altamira" <IntranetSegurosAltamira@segurosaltamira.com>',
      to: 'alejandro.salas@segurosaltamira.com'/* correo */,
      subject: 'Permiso aprobado por tu supervisor',
      html: htmlContent,
      attachments:[
        {
          filename: 'logo.png', // Nombre del archivo
          path: path.join(publicImagesPath, 'logo.png'), // Ruta completa al archivo
          cid: 'logoEmpresa' 
        },
        {
          file:'permiso_aprobado.gif',
          path:path.join(publicImagesPath,'permiso_aprobado.gif'),
          cid:'imagenPermisoAprobado'
        },
        {
          filename: 'procesando.gif',
          path: path.join(publicImagesPath, 'procesando.gif'),
          cid: 'Procesando'
        }
      ]
    };

    const emailResult = await sendEmail(mailOptions);
    if (!emailResult.success) {
      console.error('Error enviando correo de vacaciones aprobadas:', emailResult.error);
      throw new Error(`Error enviando correo: ${emailResult.message || 'Error desconocido'}`);
    }
  } catch (error) {
    console.error('Error enviando correo de vacaciones aprobadas:', error);
    throw error;
  }
}
/**
 * Envía un correo al empleado notificando que sus vacaciones han sido rechazadas.
 * @param {number} VacacionID
 */
export async function enviarCorreoVacacionesRechazadas(VacacionID) {
  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input('VacacionID', sql.Int, VacacionID)
      .query('SELECT dbo.ftCorreoVacacionesRechazadas(@VacacionID) AS result');

    const { nombre, correo, fecha_inicio, fecha_retorno, Numero_Dias_Vacaciones } = JSON.parse(result.recordset[0].result);
    const attachments = [
    {
      filename: 'logo.png',
      path: path.join(publicImagesPath, 'logo.png'),
      cid: 'logoEmpresa',
      filename: 'failed.gif',
      path: path.join(publicImagesPath, 'failed.gif'),
      cid: 'failedImage'
    }];
    const templatePath = path.join(__dirname, "../templates/correo_Vacaciones_Rechazadas.html");
    let htmlContent = fs.readFileSync(templatePath, 'utf8');
    htmlContent = htmlContent
      .replace('${nombre}', nombre)
      .replace('${fecha_inicio}', fecha_inicio)
      .replace('${fecha_retorno}', fecha_retorno)
      .replace('${dias_vacaciones}', Numero_Dias_Vacaciones);

    const mailOptions = {
      from: '"Intranet Seguros Altamira" <IntranetSegurosAltamira@segurosaltamira.com>',
      to: 'alejandro.salas@segurosaltamira.com' /* correo */,
      subject: 'Vacaciones rechazadas',
      html: htmlContent,
      attachments:attachments
    };

    const emailResult = await sendEmail(mailOptions);
    if (!emailResult.success) {
      console.error('Error enviando correo de vacaciones rechazadas:', emailResult.error);
      throw new Error(`Error enviando correo: ${emailResult.message || 'Error desconocido'}`);
    }
  } catch (error) {
    console.error('Error enviando correo de vacaciones rechazadas:', error);
    throw error;
  }
}

/**
 * Envía un correo al empleado notificando que sus vacaciones han sido rechazadas.
 * @param {number} VacacionID
 */
export async function enviarCorreoPermisoRechazado(PermisoID) {
  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input('PermisoID', sql.Int, PermisoID)
      .query('SELECT dbo.ftCorreoPermisoRechazado(@PermisoID) AS result');

    const { nombre, correo, fecha_inicio, fecha_fin, motivo } = JSON.parse(result.recordset[0].result);
    const attachments = [
    {
      filename: 'logo.png',
      path: path.join(publicImagesPath, 'logo.png'),
      cid: 'logoEmpresa',
      filename: 'failed.gif',
      path: path.join(publicImagesPath, 'failed.gif'),
      cid: 'failedImage'
    }];
    const templatePath = path.join(__dirname, "../templates/correo_Permiso_Rechazado.html");
    let htmlContent = fs.readFileSync(templatePath, 'utf8');
    htmlContent = htmlContent
      .replace('${nombre}', nombre)
      .replace('${fecha_inicio}', fecha_inicio)
      .replace('${fecha_fin}', fecha_fin)
      .replace('${motivo}', motivo);

    const mailOptions = {
      from: '"Intranet Seguros Altamira" <IntranetSegurosAltamira@segurosaltamira.com>',
      to:  'alejandro.salas@segurosaltamira.com'/* correo */,
      subject: 'Permiso rechazado',
      html: htmlContent,
      attachments:attachments
    };

    const emailResult = await sendEmail(mailOptions);
    if (!emailResult.success) {
      console.error('Error enviando correo de permisos rechazados:', emailResult.error);
      throw new Error(`Error enviando correo: ${emailResult.message || 'Error desconocido'}`);
    }
  } catch (error) {
    console.error('Error enviando correo de permisos rechazados:', error);
    throw error;
  }
}

/**
 * Envía un correo al empleado notificando que sus vacaciones han sido procesadas,
 * usando la plantilla correo_Vacaciones_procesadas.html y la función dbo.ftCorreoVacacionesAprobadas.
 * @param {number} VacacionID
 */
export async function enviarCorreoVacacionesProcesadas(VacacionID) {
  try {
    const pool = await getConnection();
    // Llama a la función que retorna nombre, correo, fecha_inicio y fecha_retorno
    const result = await pool.request()
      .input('VacacionID', sql.Int, VacacionID)
      .query('SELECT dbo.ftCorreoVacacionesProcesadas(@VacacionID) AS result');

    const { nombre, correo,  fecha_inicio, fecha_retorno, Numero_Dias_Vacaciones_Disfrutadas, Numero_Dias_Vacaciones_Pagadas } = JSON.parse(result.recordset[0].result);
    const attachments = [
    {
      filename: 'logo.png',
      path: path.join(publicImagesPath, 'logo.png'),
      cid: 'logoEmpresa',
      filename:'vacaciones_procesada.gif',
      path: path.join(publicImagesPath, 'vacaciones_procesada.gif'),
      cid:'vacacionesProcesadas'
    }];
    const templatePath = path.join(__dirname, "../templates/correo_Vacaciones_procesadas.html");
    let htmlContent = fs.readFileSync(templatePath, 'utf8');
    htmlContent = htmlContent
      .replace('${nombre}', nombre)
      .replace('${VacacionID}', VacacionID)
      .replace('${fecha_inicio}', fecha_inicio)
      .replace('${fecha_retorno}', fecha_retorno)
      .replace('${dias_vacaciones}',Numero_Dias_Vacaciones_Disfrutadas)
      .replace('${dias_vacaciones_pagadas}', Numero_Dias_Vacaciones_Pagadas)
      .replace('${BASE_URL}', process.env.BASE_URL);
    const mailOptions = {
      from: '"Intranet Seguros Altamira" <IntranetSegurosAltamira@segurosaltamira.com>',
      to: 'alejandro.salas@segurosaltamira.com'/* correo */,
      subject: 'Vacaciones procesadas',
      html: htmlContent,
      attachments:attachments
    };

    const emailResult = await sendEmail(mailOptions);
    if (!emailResult.success) {
      console.error('Error enviando correo de vacaciones procesadas:', emailResult.error);
      throw new Error(`Error enviando correo: ${emailResult.message || 'Error desconocido'}`);
    }
  } catch (error) {
    console.error('Error enviando correo de vacaciones procesadas:', error);
    throw error;
  }
}

export async function enviarCorreoPermisosProcesados(PermisoID) {
  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input('PermisoID', sql.Int, PermisoID)
      .query('SELECT dbo.ftCorreoPermisosProcesados(@PermisoID) AS result');
    const { PermisosID,nombre, correo, fecha_inicio, fecha_fin,titulo, motivo } = JSON.parse(result.recordset[0].result);
    const attachments = [
    {
      filename: 'logo.png',
      path: path.join(publicImagesPath, 'logo.png'),
      cid: 'logoEmpresa',
      filename:'vacaciones_procesada.gif',
      path: path.join(publicImagesPath, 'vacaciones_procesada.gif'),
      cid:'vacacionesProcesadas'
    }];
    const templatePath = path.join(__dirname, "../templates/correo_Permisos_procesados.html");
    let htmlContent = fs.readFileSync(templatePath, 'utf8');
    const anioActual = new Date().getFullYear();
    htmlContent = htmlContent
      .replace('${nombre}', nombre)
      .replace('${PermisosID}', PermisosID)
      .replace('${fecha_inicio}', fecha_inicio)
      .replace('${fecha_fin}', fecha_fin)
      .replace('${titulo}', titulo)
      .replace('${Motivo}', motivo)
      .replace('${anioActual}', anioActual);
      
    const mailOptions = {
      from: '"Intranet Seguros Altamira" <IntranetSegurosAltamira@segurosaltamira.com>',
      to: 'alejandro.salas@segurosaltamira.com'/* correo */,
      subject: 'Permiso procesado',
      html: htmlContent,
      attachments:attachments
    };
    const emailResult = await sendEmail(mailOptions);
    if (!emailResult.success) {
      console.error('Error enviando correo de permisos procesados:', emailResult.error);
      throw new Error(`Error enviando correo: ${emailResult.message || 'Error desconocido'}`);
    }
  } catch (error) {
    console.error('Error enviando correo de permisos procesados:', error);
    throw error;
  }
}

export async function enviarCorreoRutograma({ tipo, destinatario, subject, body }) {
  const attachments = [
    {
      filename: 'logo.png',
      path: path.join(publicImagesPath, 'logo.png'),
      cid: 'logoEmpresa'
    },
    {
      filename: 'footer_rutas.png',
      path: path.join(publicImagesPath, 'footer_rutas.png'),
      cid: 'footerRutas'
    }
  ];
  let templateFile = '';
  // Seleccionar template y agregar la imagen específica según el tipo
   switch (tipo) {
    case 'nuevo':
      templateFile = path.join(__dirname, '../templates/correo_Rutograma_Nuevo.html');
      attachments.push({
        filename: 'Revision_Rutograma.gif',
        path: path.join(publicImagesPath, 'Revision_Rutograma.gif'),
        cid: 'RevisarRutograma'
      });
      break;

    case 'aprobado':
      templateFile = path.join(__dirname, '../templates/correo_Rutograma_Aprobado.html');
      attachments.push({
        filename: 'Rutograma_aprobado.gif',
        path: path.join(publicImagesPath, 'Rutograma_aprobado.gif'),
        cid: 'RutogramaAprobado'
      });
      break;

    case 'devuelto':
      templateFile = path.join(__dirname, '../templates/correo_Rutograma_Devuelto.html');
      attachments.push({
        filename: 'failed.gif',
        path: path.join(publicImagesPath, 'failed.gif'),
        cid: 'RutogramaDevuelto'
      });
      break;

    default:
      throw new Error(`Tipo de correo de rutograma no soportado: ${tipo}`);
  }

  // Validar datos obligatorios
  if (!destinatario || !subject || !body) {
    throw new Error(`Faltan datos obligatorios para enviar el correo de rutograma (${tipo}): destinatario, subject o body`);
  }

  // Leer y armar el HTML
  let htmlContent = fs.readFileSync(templateFile, 'utf8');
  htmlContent = htmlContent.replace('${cuerpo}', body)
  .replace(/\${BASE_URL}/g, process.env.BASE_URL);
  const mailOptions = {
    from: '"Intranet Seguros Altamira" <IntranetSegurosAltamira@segurosaltamira.com>',
    to:  'alejandro.salas@segurosaltamira.com'/* destinatario */,
    subject,
    html: htmlContent,
    attachments: attachments
  };

  const emailResult = await sendEmail(mailOptions);
  if (!emailResult.success) {
    console.error('Error enviando correo de rutograma:', emailResult.error);
    throw new Error(`Error enviando correo: ${emailResult.message || 'Error desconocido'}`);
  }
}