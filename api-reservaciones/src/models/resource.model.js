import { pool } from '../db/db.js'

// Columnas que el metodo update puede modificar.
// Es una lista blanca: el nombre de una columna no puede parametrizarse en
// una sentencia preparada, se concatena al SQL. Al construir el UPDATE solo
// con claves que esten en esta lista, se elimina cualquier posibilidad de
// inyeccion de SQL aunque el esquema de Zod cambiara en el futuro.
const COLUMNAS_ACTUALIZABLES = ['name', 'description', 'capacity', 'price_per_hour', 'is_active']

export default class ResourceModel {

    /**
     * Lista recursos.
     * Por defecto solo los activos (is_active = TRUE), como pide el enunciado.
     * Un ADMIN puede pedir todos con includeInactive = true.
     */
    static getAll = async ({ includeInactive = false } = {}) => {

        const conn = await pool.getConnection()

        try {
            const sql = includeInactive
                ? `SELECT id, name, description, capacity, price_per_hour, is_active, created_at
                   FROM resources
                   ORDER BY id`
                : `SELECT id, name, description, capacity, price_per_hour, is_active, created_at
                   FROM resources
                   WHERE is_active = TRUE
                   ORDER BY id`

            const [rows] = await conn.query(sql)

            return rows.map(normalizarRecurso)

        } finally {
            conn.release()
        }
    }

    static getById = async (id) => {

        const conn = await pool.getConnection()

        try {
            const [rows] = await conn.execute(
                `SELECT id, name, description, capacity, price_per_hour, is_active, created_at
                 FROM resources
                 WHERE id = :id`,
                { id }
            )

            return rows[0] ? normalizarRecurso(rows[0]) : undefined

        } finally {
            conn.release()
        }
    }

    static create = async ({ name, description = null, capacity, price_per_hour, is_active = true }) => {

        const conn = await pool.getConnection()

        try {
            const [result] = await conn.execute(
                `INSERT INTO resources (name, description, capacity, price_per_hour, is_active)
                 VALUES (:name, :description, :capacity, :price_per_hour, :is_active)`,
                { name, description, capacity, price_per_hour, is_active }
            )

            return await ResourceModel.getById(result.insertId)

        } finally {
            conn.release()
        }
    }

    /**
     * Actualiza solo los campos recibidos, construyendo el SET dinamicamente.
     * Los VALORES siempre viajan como parametros de la sentencia preparada;
     * lo unico que se concatena son nombres de columna ya filtrados por la
     * lista blanca de arriba.
     */
    static update = async ({ id, data }) => {

        const entradas = Object.entries(data).filter(([key]) => COLUMNAS_ACTUALIZABLES.includes(key))

        if (entradas.length === 0) return await ResourceModel.getById(id)

        const conn = await pool.getConnection()

        try {
            const asignaciones = entradas.map(([key]) => `${key} = ?`)
            const valores = [...entradas.map(([, value]) => value), id]

            await conn.execute(
                `UPDATE resources SET ${asignaciones.join(', ')} WHERE id = ?`,
                valores
            )

            return await ResourceModel.getById(id)

        } finally {
            conn.release()
        }
    }
}

/**
 * Ajusta los tipos que devuelve MySQL para que el JSON de la API sea coherente:
 *  - DECIMAL(10,2) llega como texto ('25.00') porque en JavaScript un numero
 *    de punto flotante no puede representar decimales exactos; se convierte a
 *    numero para que el cliente reciba 25 y no "25.00".
 *  - BOOLEAN en MySQL es en realidad TINYINT(1), asi que llega como 1 o 0;
 *    se convierte a true/false.
 */
const normalizarRecurso = (row) => ({
    ...row,
    price_per_hour: Number(row.price_per_hour),
    is_active: Boolean(row.is_active)
})
