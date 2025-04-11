import { getConnection, sql } from '../database/connection.js';
import { parseISO } from 'date-fns';

export async function enviarReporteCorreo(cod_emp, ip, accion, statusLogrado, fecha) {
    console.clear();
    console.log("fecha: ", fecha);

    try {
        const pool = await getConnection();
        console.log("Conectado a la base de datos para enviar el reporte de correo");

        const query = `
            INSERT INTO [db_accessadmin].[LOGSCORREOS] ([Cod_emp],[ip],[accion],[Fecha],[Status])
            VALUES (@cod_emp, @ip, @accion, @fecha, @status)
        `;

        // Convertir la fecha a un objeto Date válido
        const fechaValida = parseISO(fecha);

        // Ejecutar la consulta en la base de datos
        await pool.request()
            .input('cod_emp', sql.VarChar, cod_emp)
            .input('ip', sql.VarChar, ip)
            .input('accion', sql.VarChar, accion)
            .input('status', sql.VarChar, statusLogrado ? 'Logrado' : 'No Logrado')
            .input('fecha', sql.DateTime2, fechaValida) 
            .query(query);

        console.log('Reporte enviado correctamente a la base de datos.');
    } catch (error) {
        console.error('Error al enviar el reporte a la base de datos:', error);
        throw error;
    }
}