import { jsonResponse } from '../helpers/json_response.js'

// Higher-Order Function: recibe una funcion de validacion de Zod y devuelve
// el middleware que interceptara la peticion. Asi un mismo middleware sirve
// para cualquier esquema, sin duplicar codigo en cada ruta.

/** Valida req.body */
export const validateSchema = (validatorFn) => {

    return (req, res, next) => {

        const { success, data, error } = validatorFn(req.body)

        if (!success) {
            return res.status(400).json(jsonResponse({
                status: 400,
                message: 'No paso las validaciones',
                data: JSON.parse(error.message)
            }))
        }

        // Se guarda el resultado ya validado y transformado (con defaults
        // aplicados y fechas normalizadas) en una propiedad aparte.
        // Los controladores deben leer req.validatedData y NUNCA req.body,
        // porque req.body sigue conteniendo lo que envio el cliente sin filtrar.
        req.validatedData = data

        next()
    }
}

/** Valida req.query (para query params como ?resource_id=1&date=2026-08-01) */
export const validateQuery = (validatorFn) => {

    return (req, res, next) => {

        const { success, data, error } = validatorFn(req.query)

        if (!success) {
            return res.status(400).json(jsonResponse({
                status: 400,
                message: 'Parametros de consulta invalidos',
                data: JSON.parse(error.message)
            }))
        }

        req.validatedQuery = data

        next()
    }
}

/**
 * Valida que el :id de la URL sea un entero positivo.
 *
 * Sin esto, una peticion a /api/v1/bookings/abc/cancel llegaria al modelo
 * con id = 'abc'. MySQL convierte esa cadena a 0 en lugar de fallar, y el
 * resultado seria un 404 confuso en vez de un 400 que explique el problema.
 */
export const validateIdParam = (req, res, next) => {

    const { id } = req.params

    if (!/^\d+$/.test(id) || Number(id) <= 0) {
        return res.status(400).json(jsonResponse({
            status: 400,
            message: 'El id debe ser un numero entero positivo',
            data: null
        }))
    }

    req.params.id = Number(id)

    next()
}
