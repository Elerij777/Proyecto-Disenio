import { Router } from 'express'
import {
    getAvailability,
    createBooking,
    getMyBookings,
    getAllBookings,
    cancelBooking
} from '../controllers/booking.controller.js'
import { isAuth, hasRole, optionalAuth } from '../middlewares/auth.middleware.js'
import { validateSchema, validateQuery, validateIdParam } from '../middlewares/validate.middleware.js'
import { validateCreateBooking, validateAvailabilityQuery } from '../schemas/booking.schema.js'

const bookingRouter = Router()

// =========================================================================
// IMPORTANTE: las rutas con segmentos fijos (/availability, /my-bookings)
// deben declararse ANTES de cualquier ruta con parametro (/:id).
// Express evalua las rutas en orden, y si /:id estuviera primero capturaria
// la palabra "availability" como si fuera un identificador.
// =========================================================================

// Publica o autenticada
bookingRouter.get(
    '/availability',
    optionalAuth,
    validateQuery(validateAvailabilityQuery),
    getAvailability
)

// Reservas del usuario del token
bookingRouter.get(
    '/my-bookings',
    isAuth,
    hasRole('CLIENT', 'ADMIN'),
    getMyBookings
)

// Listado global: solo ADMIN
bookingRouter.get(
    '/',
    isAuth,
    hasRole('ADMIN'),
    getAllBookings
)

// Crear reserva
bookingRouter.post(
    '/',
    isAuth,
    hasRole('CLIENT', 'ADMIN'),
    validateSchema(validateCreateBooking),
    createBooking
)

// Cancelar reserva
bookingRouter.patch(
    '/:id/cancel',
    isAuth,
    hasRole('CLIENT', 'ADMIN'),
    validateIdParam,
    cancelBooking
)

export default bookingRouter
