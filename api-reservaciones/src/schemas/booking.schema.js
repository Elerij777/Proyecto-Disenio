import * as z from 'zod'
import { DATETIME_REGEX, DATE_REGEX, parseLocalDateTime, normalizeDateTime } from '../helpers/datetime.js'

// Campo de fecha/hora reutilizable.
// Se valida en dos pasos:
//   1. .regex()  -> comprueba el FORMATO ('2026-08-01T10:00' o '2026-08-01 10:00:00')
//   2. .refine() -> comprueba que sea una FECHA REAL (rechaza 2026-02-30, 2026-13-01)
// y finalmente .transform() la normaliza al formato que espera MySQL.
const dateTimeField = (label) => z
    .string(`${label} debe ser un texto`)
    .regex(DATETIME_REGEX, `${label} debe tener el formato YYYY-MM-DD HH:mm:ss`)
    .refine((value) => parseLocalDateTime(value) !== null, {
        message: `${label} no corresponde a una fecha valida`
    })
    .transform((value) => normalizeDateTime(value))

// POST /api/v1/bookings
//
// Nota: aqui NO se aceptan user_id, total_price ni status.
// - user_id      lo determina el token JWT, no el cliente
// - total_price  lo calcula el servidor (regla de negocio 3)
// - status       siempre nace como CONFIRMED
// Gracias a .strict(), si alguien intenta enviar { "total_price": 0 } para
// reservar gratis, la peticion se rechaza con 400.
const createBookingSchema = z.object({
    resource_id: z
        .number('El id del recurso debe ser un numero')
        .int('El id del recurso debe ser un numero entero')
        .positive('El id del recurso debe ser mayor a 0'),

    start_time: dateTimeField('La fecha de inicio'),
    end_time: dateTimeField('La fecha de fin')
}).strict('No se permiten campos adicionales. El precio, el usuario y el estado los asigna el servidor')

    // REGLA DE NEGOCIO 1a: start_time debe ser estrictamente menor que end_time
    //
    // Nota: si alguna de las dos fechas no se pudo interpretar, este refine
    // devuelve true. No es que la regla se cumpla, sino que el campo ya tiene
    // su propio mensaje de error de formato y volver a marcarlo aqui solo
    // agregaria ruido a la respuesta.
    .refine((data) => {
        const start = parseLocalDateTime(data.start_time)
        const end = parseLocalDateTime(data.end_time)
        if (!start || !end) return true
        return start.getTime() < end.getTime()
    }, {
        message: 'La fecha de inicio debe ser anterior a la fecha de fin',
        path: ['start_time']
    })

    // REGLA DE NEGOCIO 1b: no se permiten reservas en el pasado
    .refine((data) => {
        const start = parseLocalDateTime(data.start_time)
        if (!start) return true
        return start.getTime() > Date.now()
    }, {
        message: 'No se puede reservar en una fecha u hora que ya paso',
        path: ['start_time']
    })

// GET /api/v1/bookings/availability?resource_id=1&date=YYYY-MM-DD
//
// Los query params siempre llegan como texto ('1', no 1), por eso
// resource_id se valida como string numerico y se convierte con .transform().
const availabilityQuerySchema = z.object({
    resource_id: z
        .string('El parametro resource_id es obligatorio')
        .regex(/^\d+$/, 'El parametro resource_id debe ser un numero entero')
        .transform(Number)
        .refine((n) => n > 0, 'El parametro resource_id debe ser mayor a 0'),

    date: z
        .string('El parametro date es obligatorio')
        .regex(DATE_REGEX, 'El parametro date debe tener el formato YYYY-MM-DD')
        .refine((value) => parseLocalDateTime(`${value}T00:00:00`) !== null, {
            message: 'El parametro date no corresponde a una fecha valida'
        })
})

export const validateCreateBooking = (data) => createBookingSchema.safeParse(data)
export const validateAvailabilityQuery = (data) => availabilityQuerySchema.safeParse(data)
