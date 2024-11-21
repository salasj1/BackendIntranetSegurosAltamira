export interface Usuario {
    id: number;
    username: string;
    password: string;
    status : string;
}

export async function buscarUsuario(cod_emp: string): Promise<Usuario[]> {
    const pool = await getConnection();
    try {
        
        const result = await pool.request()
        .input('cod_emp', sql.NVarChar, cod_emp)
        .execute('spBuscarUsuario');        
        


    }catch{
        console.error('Error al buscar el usuario:', error);
        return error;
    }
    
}