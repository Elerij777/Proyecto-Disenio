import jwt from 'jsonwebtoken'
import { jsonResponse } from '../helpers/json_response.js'

// =========================================================================
// AUTENTICACION: "quien eres"
// =========================================================================
/**
 * Lee el encabezado Authorization, valida el token JWT y deja los datos del
 * usuario en req.user para que los controladores posteriores los usen.
 *
 * Formato esperado del encabezado:
 *   Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *
 * Si el token falta, esta mal formado, expiro o fue alterado -> 401.
 */
export const isAuth = (req, res, next) => {

    const authHeader = req.headers.authorization

    if (!authHeader) {
        return res.status(401).json(jsonResponse({
            status: 401,
            message: 'No se envio el token de autenticacion',
            data: null
        }))
    }

    // Se separa "Bearer" del token y se valida el esquema.
    const [scheme, token] = authHeader.split(' ')

    if (scheme !== 'Bearer' || !token) {
        return res.status(401).json(jsonResponse({
            status: 401,
            message: 'Formato de token invalido. Se espera: Bearer <token>',
            data: null
        }))
    }

    try {
        // jwt.verify hace dos cosas: comprueba la FIRMA (que el token no haya
        // sido modificado ni fabricado sin la clave secreta) y comprueba la
        // EXPIRACION. Si cualquiera falla, lanza una excepcion.
        const payload = jwt.verify(token, process.env.JWT_KEY)

        req.user = {
            id: payload.id,
            email: payload.email,
            role: payload.role
        }

        next()

    } catch (e) {

        // Se distingue el token expirado del invalido porque son situaciones
        // distintas para quien consume la API: expirado significa "vuelve a
        // iniciar sesion", invalido significa "algo esta mal con tu token".
        const message = e.name === 'TokenExpiredError'
            ? 'El token expiro, inicia sesion nuevamente'
            : 'Token invalido'

        return res.status(401).json(jsonResponse({
            status: 401,
            message,
            data: null
        }))
    }
}

// =========================================================================
// AUTORIZACION: "que puedes hacer"
// =========================================================================
/**
 * Higher-Order Function que restringe una ruta a ciertos roles.
 * Se usa SIEMPRE despues de isAuth, porque necesita req.user.
 *
 *   router.post('/', isAuth, hasRole('ADMIN'), createResource)
 *   router.get('/', isAuth, hasRole('CLIENT', 'ADMIN'), getMyBookings)
 *
 * Diferencia clave entre 401 y 403:
 *   401 Unauthorized -> no se quien eres (falta o falla el token)
 *   403 Forbidden    -> se quien eres, pero no tienes permiso para esto
 */
export const hasRole = (...rolesPermitidos) => {

    return (req, res, next) => {

        if (!req.user) {
            return res.status(401).json(jsonResponse({
                status: 401,
                message: 'Debes iniciar sesion para acceder a este recurso',
                data: null
            }))
        }

        if (!rolesPermitidos.includes(req.user.role)) {
            return res.status(403).json(jsonResponse({
                status: 403,
                message: 'No tienes permisos suficientes para realizar esta accion',
                data: null
            }))
        }

        next()
    }
}

/**
 * Autenticacion OPCIONAL.
 *
 * El enunciado marca algunos endpoints como "Public/Autenticado"
 * (GET /resources y GET /bookings/availability): deben funcionar sin token,
 * pero si viene un token valido conviene saber quien es el usuario.
 *
 * A diferencia de isAuth, aqui un token ausente o invalido NO corta la
 * peticion; simplemente se continua con req.user = null.
 */
export const optionalAuth = (req, res, next) => {

    const authHeader = req.headers.authorization

    if (!authHeader) {
        req.user = null
        return next()
    }

    const [scheme, token] = authHeader.split(' ')

    if (scheme !== 'Bearer' || !token) {
        req.user = null
        return next()
    }

    try {
        const payload = jwt.verify(token, process.env.JWT_KEY)
        req.user = {
            id: payload.id,
            email: payload.email,
            role: payload.role
        }
    } catch (e) {
        req.user = null
    }

    next()
}
