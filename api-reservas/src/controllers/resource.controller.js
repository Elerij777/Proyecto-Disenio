import ResourceModel from '../models/resource.model.js'
import { jsonResponse } from '../helpers/json_response.js'

/**
 * GET /api/v1/resources  (publico o autenticado)
 *
 * Lista los recursos activos. Un ADMIN autenticado puede pedir tambien los
 * desactivados con ?includeInactive=true, algo que necesita para poder
 * reactivar un recurso que el mismo dio de baja; para un cliente ese
 * parametro se ignora, porque no debe ver espacios que no puede reservar.
 */
export const getAllResources = async (req, res, next) => {

    try {
        const esAdmin = req.user?.role === 'ADMIN'
        const pidioInactivos = req.query.includeInactive === 'true'

        const resources = await ResourceModel.getAll({
            includeInactive: esAdmin && pidioInactivos
        })

        return res.json(jsonResponse({
            message: 'Listado de recursos',
            data: resources
        }))

    } catch (e) {
        next(e)
    }
}

/**
 * GET /api/v1/resources/:id  (publico o autenticado)
 *
 * No aparece en el enunciado, pero se incluye porque es la contraparte
 * natural del listado y evita que el cliente tenga que descargar todos los
 * recursos para consultar uno.
 */
export const getResourceById = async (req, res, next) => {

    try {
        const resource = await ResourceModel.getById(req.params.id)

        if (!resource) {
            return res.status(404).json(jsonResponse({
                status: 404,
                message: 'Recurso no encontrado',
                data: null
            }))
        }

        // Un recurso inactivo solo es visible para un ADMIN
        if (!resource.is_active && req.user?.role !== 'ADMIN') {
            return res.status(404).json(jsonResponse({
                status: 404,
                message: 'Recurso no encontrado',
                data: null
            }))
        }

        return res.json(jsonResponse({
            message: 'Informacion del recurso',
            data: resource
        }))

    } catch (e) {
        next(e)
    }
}

/**
 * POST /api/v1/resources  (solo ADMIN)
 */
export const createResource = async (req, res, next) => {

    try {
        const resource = await ResourceModel.create(req.validatedData)

        return res.status(201).json(jsonResponse({
            status: 201,
            message: 'Recurso creado correctamente',
            data: resource
        }))

    } catch (e) {
        next(e)
    }
}

/**
 * PUT /api/v1/resources/:id  (solo ADMIN)
 */
export const updateResource = async (req, res, next) => {

    try {
        const { id } = req.params

        const existe = await ResourceModel.getById(id)

        if (!existe) {
            return res.status(404).json(jsonResponse({
                status: 404,
                message: 'Recurso no encontrado',
                data: null
            }))
        }

        const resource = await ResourceModel.update({ id, data: req.validatedData })

        return res.json(jsonResponse({
            message: 'Recurso actualizado correctamente',
            data: resource
        }))

    } catch (e) {
        next(e)
    }
}
