import express from 'express';
import empleadosRouter from './routes/empleados.routes.js';
import login from './routes/login.routes.js';
import reciboDePagoRoutes from './routes/recibodepago.routes.js';
import signupRouter from './routes/signup.routes.js';
import prestacionesRouter from './routes/prestaciones.routes.js';
import arc from './routes/arc.routes.js';
import cors from 'cors';
import vacacionesRouter from './routes/vacaciones.routes.js'; 
const app = express();
app.use(express.json()); 
app.use(express.urlencoded({ extended: true })); 
app.use(cors({
    origin: 'http://localhost:5173', // Asegúrate de que esta URL coincide con la del cliente
    credentials: true
  }));
  
app.use(empleadosRouter);
app.use(signupRouter);
app.use(login);
app.use(reciboDePagoRoutes);
app.use(prestacionesRouter);
app.use(arc);
app.use(vacacionesRouter);
export default app;