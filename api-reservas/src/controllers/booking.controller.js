import BookingModel from '../models/booking.model.js'
import ResourceModel from '../models/resource.model.js'
import { jsonResponse } from '../helpers/json_response.js'
import { parseLocalDateTime, calculateTotalPrice, hoursBetween } from '../helpers/datetime.js'

// Horas minimas de anticipacion que necesita un CLIENT para cancelar.
// Se lee del entorno para poder ajustar la politica sin tocar el codigo.
const VENTANA_CANCELACION_HORAS = Number(process.env.CANCELLATION_WINDOW_HOURS ?? 12)

/**
 * GET /api/v1/bookings/availability?resource_id=1&date=YYYY-MM-DD
 * (publico o autenticado)
 *
 * Devuelve las franjas OCUPADAS del recurso en esa fecha.
 */
export const getAvailability = async (req, res, next) => {

    try {
        const { resource_id, date } = req.validatedQuery

        const resource = await ResourceModel.getById(resource_id)

        if (!resource) {
            return res.status(404).json(jsonResponse({
                status: 404,
                message: 'Recurso no encontrado',
                data: null
            }))
        }

        const ocupadas = await BookingModel.getOccupiedSlots({ resource_id, date })

        return res.json(jsonResponse({
            message: `Franjas ocupadas del recurso el ${date}`,
            data: {
                resource: {
                    id: resource.id,
                    name: resource.name,
                    price_per_hour: resource.price_per_hour,
                    is_active: resource.is_active
                },
                date,
                occupied_slots: ocupadas.map((slot) => ({
                    booking_id: slot.id,
                    start_time: slot.start_time,
                    end_time: slot.end_time
                }))
            }
        }))

    } catch (e) {
        next(e)
    }
}

/**
 * POST /api/v1/bookings  (CLIENT o ADMIN)
 *
 * Las validaciones de formato y las reglas temporales (inicio < fin, no
 * reservar en el pasado) ya las aplico el esquema de Zod. Aqui se resuelve
 * lo que necesita consultar la base de datos: que el recurso exista y este
 * activo, el calculo del precio y la prevencion de solapamientos.
 */
export const createBooking = async (req, res, next) => {

    try {
        const { resource_id, start_time, end_time } = req.validatedData

        const resource = await ResourceModel.getById(resource_id)

        if (!resource) {
            return res.status(404).json(jsonResponse({
                status: 404,
                message: 'El recurso indicado no existe',
                data: null
            }))
        }

        if (!resource.is_active) {
            return res.status(409).json(jsonResponse({
                status: 409,
                message: 'El recurso no esta disponible para reservas',
                data: null
            }))
        }

        // REGLA DE NEGOCIO 3: el precio lo calcula SIEMPRE el servidor a
        // partir de la duracion y la tarifa vigente del recurso. Nunca se
        // acepta un precio enviado por el cliente.
        const start = parseLocalDateTime(start_time)
        const end = parseLocalDateTime(end_time)

        const total_price = calculateTotalPrice({
            start,
            end,
            pricePerHour: resource.price_per_hour
        })

        // REGLA DE NEGOCIO 2: prevencion de solapamiento.
        // La comprobacion se hace dentro de una transaccion en el modelo
        // para que no pueda colarse otra reserva entre la verificacion y
        // la insercion.
        const { conflict, conflicts, booking } = await BookingModel.create({
            user_id: req.user.id,
            resource_id,
            start_time,
            end_time,
            total_price
        })

        if (conflict) {
            return res.status(409).json(jsonResponse({
                status: 409,
                message: 'El recurso ya esta reservado en ese horario',
                data: {
                    conflicting_bookings: conflicts.map((c) => ({
                        booking_id: c.id,
                        start_time: c.start_time,
                        end_time: c.end_time
                    }))
                }
            }))
        }

        return res.status(201).json(jsonResponse({
            status: 201,
            message: 'Reserva creada correctamente',
            data: booking
        }))

    } catch (e) {
        next(e)
    }
}

/**
 * GET /api/v1/bookings/my-bookings  (CLIENT o ADMIN)
 * Devuelve unicamente las reservas del usuario del token.
 */
export const getMyBookings = async (req, res, next) => {

    try {
        const { status } = req.query

        if (status && !['CONFIRMED', 'CANCELLED'].includes(status)) {
            return res.status(400).json(jsonResponse({
                status: 400,
                message: 'El filtro status debe ser CONFIRMED o CANCELLED',
                data: null
            }))
        }

        const bookings = await BookingModel.getByUser({ user_id: req.user.id, status })

        return res.json(jsonResponse({
            message: 'Listado de mis reservas',
            data: bookings
        }))

    } catch (e) {
        next(e)
    }
}

/**
 * GET /api/v1/bookings  (solo ADMIN)
 * Listado global, con filtros opcionales por estado, recurso y usuario.
 */
export const getAllBookings = async (req, res, next) => {

    try {
        const { status, resource_id, user_id } = req.query

        if (status && !['CONFIRMED', 'CANCELLED'].includes(status)) {
            return res.status(400).json(jsonResponse({
                status: 400,
                message: 'El filtro status debe ser CONFIRMED o CANCELLED',
                data: null
            }))
        }

        for (const [nombre, valor] of [['resource_id', resource_id], ['user_id', user_id]]) {
            if (valor !== undefined && !/^\d+$/.test(valor)) {
                return res.status(400).json(jsonResponse({
                    status: 400,
                    message: `El filtro ${nombre} debe ser un numero entero`,
                    data: null
                }))
            }
        }

        const bookings = await BookingModel.getAll({
            status,
            resource_id: resource_id ? Number(resource_id) : undefined,
            user_id: user_id ? Number(user_id) : undefined
        })

        return res.json(jsonResponse({
            message: 'Listado global de reservas',
            data: bookings
        }))

    } catch (e) {
        next(e)
    }
}

/**
 * PATCH /api/v1/bookings/:id/cancel  (CLIENT o ADMIN)
 *
 * REGLA DE NEGOCIO 4 (politica de cancelacion):
 *  - Un CLIENT solo puede cancelar reservas propias.
 *  - Un CLIENT necesita al menos 12 horas de anticipacion.
 *  - Un ADMIN puede cancelar cualquier reserva sin esa restriccion: el
 *    enunciado condiciona la ventana de 12 horas al cliente, y un
 *    administrador sin capacidad de anular perderia el control operativo
 *    del sistema (por ejemplo, ante una sala averiada el mismo dia).
 */
export const cancelBooking = async (req, res, next) => {

    try {
        const { id } = req.params

        const booking = await BookingModel.getById(id)

        if (!booking) {
            return res.status(404).json(jsonResponse({
                status: 404,
                message: 'Reserva no encontrada',
                data: null
            }))
        }

        if (booking.status === 'CANCELLED') {
            return res.status(409).json(jsonResponse({
                status: 409,
                message: 'La reserva ya se encuentra cancelada',
                data: null
            }))
        }

        const esAdmin = req.user.role === 'ADMIN'

        // Propiedad de la reserva
        if (!esAdmin && booking.user_id !== req.user.id) {
            return res.status(403).json(jsonResponse({
                status: 403,
                message: 'Solo puedes cancelar tus propias reservas',
                data: null
            }))
        }

        // Ventana de anticipacion (no aplica a ADMIN)
        if (!esAdmin) {
            const inicio = parseLocalDateTime(booking.start_time)
            const horasRestantes = hoursBetween(new Date(), inicio)

            if (horasRestantes < VENTANA_CANCELACION_HORAS) {
                return res.status(409).json(jsonResponse({
                    status: 409,
                    message: `Las cancelaciones requieren al menos ${VENTANA_CANCELACION_HORAS} horas de anticipacion. Faltan ${horasRestantes.toFixed(1)} horas para el inicio de la reserva`,
                    data: null
                }))
            }
        }

        const cancelada = await BookingModel.cancel(id)

        if (!cancelada) {
            // Otra peticion la cancelo entre la lectura y la actualizacion
            return res.status(409).json(jsonResponse({
                status: 409,
                message: 'La reserva ya se encuentra cancelada',
                data: null
            }))
        }

        return res.json(jsonResponse({
            message: 'Reserva cancelada correctamente',
            data: cancelada
        }))

    } catch (e) {
        next(e)
    }
}
