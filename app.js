import express from 'express';
import cors from 'cors';
import empleadosRouter from './routes/empleados.routes.js';
import login from './routes/login.routes.js';
import reciboDePagoRoutes from './routes/recibodepago.routes.js';
import signupRouter from './routes/signup.routes.js';
import prestacionesRouter from './routes/prestaciones.routes.js';
import arc from './routes/arc.routes.js';
import vacacionesRouter from './routes/vacaciones.routes.js'; 
import permisosRouter from './routes/permisos.routes.js';
import chatbotRouter from './routes/chatbot.routes.js';

const app = express();
app.use(express.json()); 
app.use(express.urlencoded({ extended: true })); 
app.use(cors({
    origin: '*', // Permitir cualquier origen
    credentials: true
}));

app.use(empleadosRouter);
app.use(signupRouter);
app.use(login);
app.use(reciboDePagoRoutes);
app.use(prestacionesRouter);
app.use(arc);
app.use(vacacionesRouter);
app.use(permisosRouter);
app.use(chatbotRouter);

export default app;