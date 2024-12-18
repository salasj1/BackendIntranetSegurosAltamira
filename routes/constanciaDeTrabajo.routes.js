import express from 'express';
import multer from 'multer';
import nodemailer from 'nodemailer';
import { getConnection, sql } from '../database/connection.js'; 
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import numeroPalabra from 'numero-palabra';  
const router = express.Router();
const upload = multer();


// Obtener el directorio actual utilizando import.meta.url
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ruta para obtener datos del ARC de un empleado específico
router.get('/constancia/:cod_emp', async (req, res) => {
    let { cod_emp } = req.params;
    const {  mostrarsueldo } = req.query;
    console.log(`Request GET received for constancia data: cod_emp=${cod_emp}, mostrarsueldo=${mostrarsueldo}`);

    try {
      const pool = await getConnection();
      const result = await pool.request()
        .input('cod_emp', sql.Char, cod_emp)
        .input('mostrarsueldo', sql.Char, mostrarsueldo)
        .execute('spSARepConstanciaDeTrabajo');
        console.log(result.recordset[0].sueldoBase);

    
      if (result.recordset[0].sueldoBase!==null) {
        const [entero, decimal] = result.recordset[0].sueldoBase.toString().split('.');
        const enteroEnPalabras = numeroPalabra(entero);
        let decimalEnPalabras = '';
        if (decimal) {
          decimalEnPalabras = `con ${decimal}/100 `;
          const sueldoBaseEnPalabras = `${enteroEnPalabras.toUpperCase()} ${decimalEnPalabras.toUpperCase()}`;
          result.recordset[0].sueldoBase = sueldoBaseEnPalabras+` (Bs. ${result.recordset[0].sueldoBase})`;
        }
      }
      
      

      
      res.json(result.recordset);
    } catch (error) {
      console.error('Error fetching constancia data:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch data', error });
    }
});

export default router;