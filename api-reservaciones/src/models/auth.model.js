import { pool } from '../db/db.js'

export default class AuthModel {

    /**
     * Registra un usuario nuevo. El rol siempre es CLIENT: no se recibe como
     * parametro para que ninguna capa superior pueda crear un ADMIN por error.
     */
    static register = async ({ name, email, password_hash }) => {

        const conn = await pool.getConnection()

        try {
            const [result] = await conn.execute(
                `INSERT INTO users (name, email, password_hash, role)
                 VALUES (:name, :email, :password_hash, 'CLIENT')`,
                { name, email, password_hash }
            )

            // Se devuelve el usuario recien creado SIN el hash de la contrasena.
            return {
                id: result.insertId,
                name,
                email,
                role: 'CLIENT'
            }

        } finally {
            conn.release()
        }
    }

    /**
     * Busca un usuario por correo, incluyendo el password_hash.
     * Este es el unico metodo que expone el hash, y solo lo usa el login
     * para compararlo con bcrypt.
     */
    static findByEmail = async (email) => {

        const conn = await pool.getConnection()

        try {
            const [rows] = await conn.execute(
                `SELECT id, name, email, password_hash, role
                 FROM users
                 WHERE email = :email`,
                { email }
            )

            return rows[0]

        } finally {
            conn.release()
        }
    }

    /** Comprueba si un correo ya esta registrado (sin traer datos sensibles) */
    static emailExists = async (email) => {

        const conn = await pool.getConnection()

        try {
            const [rows] = await conn.execute(
                `SELECT id FROM users WHERE email = :email`,
                { email }
            )

            return rows.length > 0

        } finally {
            conn.release()
        }
    }
}
