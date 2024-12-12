import bcrypt from 'bcrypt';

export async function encryptPassword(password) {
    return await bcrypt.hash(password, 10);
}

export async function comparePassword(password, hashedPassword) {
    if (!password || !hashedPassword) {
        throw new Error('data and hash arguments required');
    }
    return await bcrypt.compare(password, hashedPassword);
}