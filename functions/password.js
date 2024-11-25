
import bcrypt from 'bcrypt';
import { buscarUsuario } from './usuario.js';
export async function encryptPassword(password) {
    return  await bcrypt.hash(password, 10);
}
export async function comparePassword(password, usuario) {
    const user = await buscarUsuario(usuario);
    const hashedPassword = user.password;
    return await bcrypt.compare(password, hashedPassword);
}
