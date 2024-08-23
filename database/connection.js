import sql from 'mssql'
import dotenv from 'dotenv';
dotenv.config();
const dbSettings = {
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,

    server: process.env.SQL_SERVER_NAME,
    database: process.env.SQL_DATABASE,
    options: {
      encrypt: true,
      trustServerCertificate: true,
    },
}
export const getConnection = async () => {
    try {
      const pool = await sql.connect(dbSettings);
      console.log("Connected to the database" );
      return pool;
    } catch (error) {
      console.error(error);
    }
  };
  
  export { sql };
export default sql;