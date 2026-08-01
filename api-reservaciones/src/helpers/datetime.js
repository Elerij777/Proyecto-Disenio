// Acepta separador 'T' o espacio, y segundos opcionales
export const DATETIME_REGEX = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?$/

export const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

const pad = (n) => String(n).padStart(2, '0')

/**
 * Convierte una cadena de fecha/hora en un objeto Date interpretandola
 * como hora LOCAL (no UTC).
 */
export const parseLocalDateTime = (value) => {

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
 */
export const calculateTotalPrice = ({ start, end, pricePerHour }) => {

    const hours = hoursBetween(start, end)
    const total = hours * Number(pricePerHour)

    return Math.round(total * 100) / 100
}
