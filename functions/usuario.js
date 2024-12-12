import { getConnection, sql } from '../database/connection.js';

async function buscarUsuario(username) {
    try {
        const pool = await getConnection();
        if (!pool) {
            throw new Error('No se pudo conectar a la base de datos');
        }
        const result = await pool.request()
            .input('username', sql.NVarChar, username)
            .execute('spBuscarUsuario');
        
        if (result.recordset.length === 0) {
            return null;
        }
        return result.recordset[0];
    } catch (error) {
        console.error('Error al buscar usuario:', error);
        throw error;
    }
}

export { buscarUsuario };