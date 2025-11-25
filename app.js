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
import changepassword from './routes/changepassword.routes.js';
import constancideTrabajoRouter from './routes/constanciaDeTrabajo.routes.js';
import googleDriveRoutes from './routes/GoogleDrive.routes.js';
import notificacionRouter from './routes/notificaciones.routes.js';
import expedienteRouter from './routes/expediente.routes.js';
import estadisticasRouter from './routes/stadistic.routes.js';
import adminRouter from './routes/admin.routes.js';
const app = express();
app.use(express.json()); 
app.use(express.urlencoded({ extended: true })); 
app.use(cors({
    origin: '*', // Permitir cualquier origen
    credentials: true
}));

app.use('/google-drive', googleDriveRoutes);
app.use('/notificaciones', notificacionRouter);
app.use(changepassword);
app.use('/expediente', expedienteRouter);
app.use(empleadosRouter);
app.use(signupRouter);
app.use(login);
app.use(reciboDePagoRoutes);
app.use(prestacionesRouter);
app.use(constancideTrabajoRouter);
app.use(arc);
app.use(vacacionesRouter);
app.use(permisosRouter);
app.use('/admin', adminRouter); // Rutas de administración
app.use('/estadisticas', estadisticasRouter);

export default app;