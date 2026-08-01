import mysql from 'mysql2/promise'

export const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,

    waitForConnections: true,
    connectionLimit: 10,
    namedPlaceholders: true,
    maxIdle: 10,
    idleTimeout: 60000,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    dateStrings: true
})

// Verifica que la base de datos este accesible al arrancar.
export const testConnection = async () => {
    try {
        const conn = await pool.getConnection()
        await conn.ping()
        conn.release()
        console.log(`Conectado a MySQL en ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`)
        return true
    } catch (e) {
        console.error('No se pudo conectar a la base de datos:', e.message)
        console.error('Revisa que el contenedor este corriendo (docker compose up -d) y que el archivo .env tenga las credenciales correctas.')
        return false
    }
}