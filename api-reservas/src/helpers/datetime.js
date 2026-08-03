// =========================================================================
// Utilidades de fecha/hora y calculo de precio
// =========================================================================
// Todas las fechas del sistema se manejan como "hora local del negocio",
// sin zona horaria. Se aceptan del cliente en formato:
//     2026-08-01T10:00:00   o   2026-08-01 10:00:00   (los segundos son opcionales)
// y se guardan en MySQL como DATETIME con el formato 'YYYY-MM-DD HH:mm:ss'.
// =========================================================================

// Acepta separador 'T' o espacio, y segundos opcionales
export const DATETIME_REGEX = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?$/

export const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

const pad = (n) => String(n).padStart(2, '0')

/**
 * Convierte una cadena de fecha/hora en un objeto Date interpretandola
 * como hora LOCAL (no UTC).
 *
 * Se construye el Date componente por componente en lugar de usar
 * new Date(cadena), porque el comportamiento de ese constructor cambia
 * segun el formato: "2026-08-01T10:00:00" se interpreta como local, pero
 * "2026-08-01" se interpreta como UTC. Armarlo manualmente elimina esa
 * ambiguedad.
 */
export const parseLocalDateTime = (value) => {

    // Guarda defensiva: esta funcion tambien se llama desde los .refine() a
    // nivel de objeto del esquema de reservas, y en Zod 4 esos refinements se
    // ejecutan aunque un campo individual ya haya fallado su validacion. En
    // ese escenario aqui llegaria undefined o una cadena con formato invalido.
    // Devolver null en vez de lanzar excepcion permite que la API responda
    // 400 con el detalle del error, y no un 500 generico.
    if (typeof value !== 'string' || !DATETIME_REGEX.test(value)) return null

    const [datePart, timePart] = value.replace(' ', 'T').split('T')

    const [year, month, day] = datePart.split('-').map(Number)
    const [hour, minute, second = 0] = timePart.split(':').map(Number)

    const date = new Date(year, month - 1, day, hour, minute, second, 0)

    // Detecta fechas imposibles como 2026-02-30, que JavaScript "corrige"
    // silenciosamente convirtiendolas en 2026-03-02.
    if (
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day ||
        date.getHours() !== hour ||
        date.getMinutes() !== minute
    ) {
        return null
    }

    return date
}

/** Formatea un Date al formato que espera MySQL: 'YYYY-MM-DD HH:mm:ss' */
export const toMysqlDateTime = (date) => {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
           `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

/** Normaliza cualquier variante aceptada a 'YYYY-MM-DD HH:mm:ss' */
export const normalizeDateTime = (value) => {
    const date = parseLocalDateTime(value)
    return date ? toMysqlDateTime(date) : null
}

/** Diferencia en horas (decimal) entre dos fechas */
export const hoursBetween = (start, end) => {
    return (end.getTime() - start.getTime()) / (1000 * 60 * 60)
}

/**
 * Calcula el precio total de una reserva.
 *
 * Se cobran horas fraccionarias: una reserva de 90 minutos cuesta
 * 1.5 x price_per_hour. El enunciado no especifica que hacer con las
 * fracciones, y redondear hacia arriba significaria cobrarle de mas
 * al cliente por tiempo que no uso.
 *
 * El resultado se redondea a 2 decimales porque la columna total_price
 * es DECIMAL(10,2); si no se redondea, MySQL lo hace igual y el valor
 * que responde la API no coincidiria con el guardado.
 */
export const calculateTotalPrice = ({ start, end, pricePerHour }) => {

    const hours = hoursBetween(start, end)
    const total = hours * Number(pricePerHour)

    return Math.round(total * 100) / 100
}
