import express from 'express';
import app from './app.js';
import { getConnection } from './database/connection.js';
import dotenv from 'dotenv';
import './jobs/enviarCumpleanos.js'; 
import { sincronizarDocumentosBD } from './jobs/sincronizarDocumentosBD.js';
import { notificarDocumentosVencidos } from './jobs/notificarDocumentosVencidos.js';

app.use(express.json());
dotenv.config();
// Servir archivos estáticos desde la carpeta 'public'
app.use('/public', express.static('public'));

getConnection();

app.listen(3001, () => {
  console.log('Server is running ');
});
// Inicia la importación automática diaria
sincronizarDocumentosBD();
notificarDocumentosVencidos();
enviarCumpleanos();

app.get("/", (req, res) => {
  res.json({ message: "Hola desde el servidor!" });
});

console.log('Starting server...');