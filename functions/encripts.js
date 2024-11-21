export async function encryptPassword(password) {
    return  await bcrypt.hash(password, 10);
}
export async function comparePassword(password, hashedPassword) {
    return await bcrypt.compare(password, hashedPassword);
}
