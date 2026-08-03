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

    // Devuelve las columnas DATE / DATETIME como texto ('2026-08-01 10:00:00')
    // en vez de objetos Date de JavaScript.
    //
    // Por que importa: si mysql2 las convierte a Date, aplica la zona horaria
    // del proceso de Node. Una reserva guardada como "10:00" podria devolverse
    // como "16:00" o como "2026-08-01T16:00:00.000Z" segun donde corra el
    // servidor. En un sistema de reservas por franjas horarias eso es un error
    // grave. Guardamos y leemos siempre la misma cadena literal, y la tratamos
    // como hora local del negocio.
    dateStrings: true
})

// Verifica que la base de datos este accesible al arrancar.
// Es preferible fallar de inmediato con un mensaje claro que descubrirlo
// hasta que un usuario hace la primera peticion.
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
