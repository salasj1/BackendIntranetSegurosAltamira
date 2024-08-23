import express from 'express';

import app from './app.js';
import { getConnection} from './database/connection.js';
import ad from './adconfig.js'; 


app.use(express.json());


getConnection();

app.listen(3001, () => {
  console.log('Server is running ');
});
app.get("/", (req, res) => {
  res.json({ message: "Hola desde el servidor!" });
});

console.log('Starting server...');