/**
 * Script de prueba: testCumpleanos.js
 *
 * Ejecuta el envío de correos de cumpleaños de forma inmediata,
 * sin esperar al cron. Útil para validar la plantilla y el flujo.
 *
 * Uso:
 *   node scripts/testCumpleanos.js
 *
 * Para forzar una fecha diferente a hoy (útil si hoy no hay cumpleañeros),
 * editar temporalmente SP_ObtenerCumpleanerosHoy en la BD
 * o ajustar la fecha del sistema antes de ejecutar.
 */

import dotenv from 'dotenv';
dotenv.config();

import { ejecutarEnvioCumpleanos } from '../jobs/enviarCumpleanos.js';

console.log('=== TEST: Envío de correos de cumpleaños ===');

console.log('--------------------------------------------');

ejecutarEnvioCumpleanos()
  .then(() => {
    console.log('--------------------------------------------');
    console.log('=== TEST finalizado ===');
    process.exit(0);
  })
  .catch((err) => {
    console.error('=== ERROR inesperado ===', err);
    process.exit(1);
  });
