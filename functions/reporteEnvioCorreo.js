import { getConnection, sql } from '../database/connection.js';
export async function enviarReporteCorreo(cod_emp, ip, accion, statusLogrado,fecha) {
    try {
        const pool = await getConnection();
        console.log("Conectado a la base de datos para enviar el reporte de correo");
        console.log("IP", ip);
        /* const query = `
            INSERT INTO logs (cod_emp, ip, accion, status, fecha)
            VALUES (@cod_emp, @ip, @accion, @status, @fecha)
        `;

        // Ejecutar la consulta en la base de datos
        await pool.request()
            .input('cod_emp', sql.VarChar, cod_emp)
            .input('ip', sql.VarChar, ip)
            .input('accion', sql.VarChar, accion)
            .input('status', sql.VarChar, statusLogrado ? 'Logrado' : 'No Logrado')
            .input('fecha', sql.DateTime, fecha)
            .query(query); */

        console.log('Reporte enviado correctamente a la base de datos.');
    } catch (error) {
        console.error('Error al enviar el reporte a la base de datos:', error);
        throw error;
    }
}