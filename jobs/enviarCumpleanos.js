import cron from 'node-cron';
import fs from 'fs';
import path from 'path';
import dayjs from 'dayjs';
import { getConnection } from '../database/connection.js';
import { sendMailWithRetry } from '../functions/transporter.js';

// Consulta cumpleañeros del día
const getCumpleanerosHoy = async () => {
  const pool = await getConnection();
  const hoy = dayjs().format('MM-DD');
  console.log(hoy)
  const result = await pool.request()
    .query(`
      SELECT 
        CONCAT(
          LEFT(V.nombres, CHARINDEX(' ', V.nombres + ' ') - 1),
          ' ',
          LEFT(V.apellidos, CHARINDEX(' ', V.apellidos + ' ') - 1)
        ) AS nombre,
        V.correo_e AS correo
      FROM VSNEMPLE V
      WHERE FORMAT(V.fecha_nac, 'MM-dd') = '${hoy}'
    `);
  return result.recordset;
};

const imagenes = [
  '<img src="https://i.ibb.co/nsVvkMkb/Happy-birthday-bro.png" alt="Happy-birthday-bro" style="display:inline-block;border:none;height:auto;max-width:250px;" width="250"/>',
  '<img src="https://i.ibb.co/tpd7kmHh/Happy-birthday-cuate.png" alt="Happy-birthday-cuate" style="display:inline-block;border:none;height:auto;max-width:250px;" width="250"/>',
  '<img src="https://i.ibb.co/fGHptQn1/Happy-birthday-amico.png" alt="Happy-birthday-amico" style="display:inline-block;border:none;height:auto;max-width:250px;" width="250"/>',
  '<img src="https://i.ibb.co/XZHcBjkn/Happy-birthday-rafiki.png" alt="Happy-birthday-rafiki" style="display:inline-block;border:none;height:auto;max-width:250px;" width="250"/>',
  '<img src="https://i.ibb.co/0dvNsvK/Blowing-out-Birthday-candles-bro.png" alt="Birthday Cake" style="display:inline-block;border:none;height:auto;max-width:250px;" width="250"/>',
  '<img src="https://i.ibb.co/pvtYbS63/cumpleanos.png" alt="cumpleanos" border="0" style="display:inline-block;border:none;height:auto;max-width:250px;" width="250">'
];
// Envía el correo usando la plantilla
const enviarCorreoCumpleanos = async (nombre, correo) => {
  const templatePath = path.join(process.cwd(), 'templates', 'correo_cumpleanos.html');
  let html = fs.readFileSync(templatePath, 'utf8');
  html = html.replace('${nombre}', nombre);
  const imagenAleatoria = imagenes[Math.floor(Math.random() * imagenes.length)];
  html = html.replace('${Imagen}', imagenAleatoria);

  console.log(`Enviando correo de cumpleaños a: ${nombre} <${correo}>`);
  const mailOptions = {
    from: `"Seguros Altamira" <intranet@segurosaltamira.com.ve>`,
    to: 'alejandro.salas@segurosaltamira.com'/* correo */,
    subject: '¡Feliz Cumpleaños!',
    html
  };
  await sendMailWithRetry(mailOptions);
};


export const ejecutarEnvioCumpleanos = async () => {
  const cumpleaneros = await getCumpleanerosHoy();
  for (const persona of cumpleaneros) {
    await enviarCorreoCumpleanos(persona.nombre, persona.correo);
  }
  console.log(`Correos de cumpleaños enviados: ${cumpleaneros.length}`);
};

cron.schedule('15 8 * * *', async () => {
  try {
    await ejecutarEnvioCumpleanos();
  } catch (error) {
    console.error('Error enviando correos de cumpleaños:', error);
  }
});