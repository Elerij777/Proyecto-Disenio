import { pool } from '../db/db.js'

// Consulta base reutilizada: devuelve la reserva junto con el nombre del
// recurso y del usuario, para que la API responda algo legible en lugar de
// solo identificadores numericos.
const SELECT_BOOKING = `
    SELECT
        b.id,
        b.user_id,
        u.name  AS user_name,
        u.email AS user_email,
        b.resource_id,
        r.name  AS resource_name,
        b.start_time,
        b.end_time,
        b.total_price,
        b.status,
        b.created_at
    FROM bookings b
    JOIN users u     ON u.id = b.user_id
    JOIN resources r ON r.id = b.resource_id
`

export default class BookingModel {

    /**
     * =====================================================================
     * CREAR RESERVA CON PREVENCION DE SOLAPAMIENTO  (regla de negocio 2)
     * =====================================================================
     *
     * El problema: comprobar disponibilidad y luego insertar son dos pasos.
     * Si dos personas reservan la misma sala a la misma hora en el mismo
     * instante, ambas peticiones podrian ejecutar su comprobacion antes de
     * que cualquiera inserte, ver la sala libre, e insertar las dos. Eso es
     * una condicion de carrera, y el resultado es exactamente lo que el
     * sistema debe impedir: una sala reservada dos veces.
     *
     * La solucion aplicada aqui tiene tres partes:
     *
     * 1. TRANSACCION: comprobacion e insercion forman una sola operacion
     *    atomica. O se completan las dos, o no se aplica ninguna.
     *
     * 2. SELECT ... FOR UPDATE sobre la fila del RECURSO: bloquea ese recurso
     *    hasta que la transaccion termine. Si llega una segunda peticion para
     *    la misma sala, MySQL la deja esperando en esta linea; cuando la
     *    primera hace COMMIT, la segunda continua y ya ve la reserva recien
     *    insertada, por lo que detecta el conflicto correctamente.
     *
     *    Se bloquea el recurso y no las reservas porque las reservas
     *    conflictivas todavia no existen: no se puede bloquear una fila que
     *    aun no ha sido creada. Bloquear el recurso serializa todos los
     *    intentos de reserva sobre esa sala, que es justo lo que se necesita.
     *    Reservas de salas distintas no se bloquean entre si.
     *
     * 3. CONDICION DE SOLAPAMIENTO: dos franjas [inicio, fin) se solapan si
     *         inicio_existente < fin_nuevo   Y   fin_existente > inicio_nuevo
     *
     *    Al usar < y > estrictos, dos reservas contiguas SI se permiten:
     *    una de 10:00-12:00 y otra de 12:00-14:00 no chocan, porque el
     *    momento exacto de las 12:00 es el fin de una y el inicio de la otra.
     */
    static create = async ({ user_id, resource_id, start_time, end_time, total_price }) => {

        const conn = await pool.getConnection()

        try {
            await conn.beginTransaction()

            // 1. Bloquear el recurso para serializar las reservas sobre el
            await conn.execute(
                `SELECT id FROM resources WHERE id = ? FOR UPDATE`,
                [resource_id]
            )

            // 2. Ya con el bloqueo, buscar reservas confirmadas que se solapen
            const [conflictos] = await conn.execute(
                `SELECT id, start_time, end_time
                 FROM bookings
                 WHERE resource_id = ?
                   AND status = 'CONFIRMED'
                   AND start_time < ?
                   AND end_time   > ?`,
                [resource_id, end_time, start_time]
            )

            if (conflictos.length > 0) {
                await conn.rollback()
                return { conflict: true, conflicts: conflictos }
            }

            // 3. Sin conflictos: insertar
            const [result] = await conn.execute(
                `INSERT INTO bookings (user_id, resource_id, start_time, end_time, total_price, status)
                 VALUES (?, ?, ?, ?, ?, 'CONFIRMED')`,
                [user_id, resource_id, start_time, end_time, total_price]
            )

            await conn.commit()

            const booking = await BookingModel.getById(result.insertId)

            return { conflict: false, booking }

        } catch (e) {
            await conn.rollback()
            throw e
        } finally {
            conn.release()
        }
    }

    static getById = async (id) => {

        const conn = await pool.getConnection()

        try {
            const [rows] = await conn.execute(`${SELECT_BOOKING} WHERE b.id = ?`, [id])
            return rows[0] ? normalizarReserva(rows[0]) : undefined

        } finally {
            conn.release()
        }
    }

    /** Todas las reservas del sistema (solo ADMIN), con filtros opcionales */
    static getAll = async ({ status, resource_id, user_id } = {}) => {

        const conn = await pool.getConnection()

        try {
            const condiciones = []
            const valores = []

            if (status) {
                condiciones.push('b.status = ?')
                valores.push(status)
            }

            if (resource_id) {
                condiciones.push('b.resource_id = ?')
                valores.push(resource_id)
            }

            if (user_id) {
                condiciones.push('b.user_id = ?')
                valores.push(user_id)
            }

            const where = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : ''

            const [rows] = await conn.execute(
                `${SELECT_BOOKING} ${where} ORDER BY b.start_time DESC`,
                valores
            )

            return rows.map(normalizarReserva)

        } finally {
            conn.release()
        }
    }

    /** Reservas de un usuario concreto (GET /my-bookings) */
    static getByUser = async ({ user_id, status }) => {
        return await BookingModel.getAll({ user_id, status })
    }

    /**
     * Franjas ocupadas de un recurso en una fecha (GET /availability).
     *
     * Se incluyen las reservas que se solapen con el dia consultado, no solo
     * las que empiecen ese dia: una reserva de 23:00 a 01:00 ocupa parte de
     * dos dias y debe aparecer en la consulta de ambos.
     */
    static getOccupiedSlots = async ({ resource_id, date }) => {

        const conn = await pool.getConnection()

        try {
            const inicioDia = `${date} 00:00:00`
            const finDia = `${date} 23:59:59`

            const [rows] = await conn.execute(
                `SELECT id, start_time, end_time, user_id
                 FROM bookings
                 WHERE resource_id = ?
                   AND status = 'CONFIRMED'
                   AND start_time <= ?
                   AND end_time   >  ?
                 ORDER BY start_time`,
                [resource_id, finDia, inicioDia]
            )

            return rows

        } finally {
            conn.release()
        }
    }

    /** Cambia el estado de una reserva a CANCELLED */
    static cancel = async (id) => {

        const conn = await pool.getConnection()

        try {
            const [result] = await conn.execute(
                `UPDATE bookings SET status = 'CANCELLED' WHERE id = ? AND status = 'CONFIRMED'`,
                [id]
            )

            if (result.affectedRows === 0) return null

            return await BookingModel.getById(id)

        } finally {
            conn.release()
        }
    }
}

// DECIMAL llega como texto desde MySQL; se convierte a numero para el JSON.
const normalizarReserva = (row) => ({
    ...row,
    total_price: Number(row.total_price)
})
