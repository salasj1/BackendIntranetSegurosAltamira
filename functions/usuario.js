import { getConnection, sql } from "../database/connection.js";

async function buscarUsuario(username) {
    try {
        const pool = await getConnection();
        if (!pool) {
            throw new Error('No se pudo establecer la conexión con la base de datos');
        }
        const result = await pool.request()
            .input('username', sql.NVarChar, username)
            .execute('spBuscarUsuario');

        if (result.recordset.length > 0) {
            return result.recordset[0];
        } else {
            return null;
        }
    } catch (error) {
        console.error('Error al buscar el usuario:', error);
        throw error;
    }
}

export { buscarUsuario };