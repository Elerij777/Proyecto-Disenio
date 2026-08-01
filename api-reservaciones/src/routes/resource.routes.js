import { Router } from 'express'
import {
    getAllResources,
    getResourceById,
    createResource,
    updateResource
} from '../controllers/resource.controller.js'
import { isAuth, hasRole, optionalAuth } from '../middlewares/auth.middleware.js'
import { validateSchema, validateIdParam } from '../middlewares/validate.middleware.js'
import { validateCreateResource, validateUpdateResource } from '../schemas/resource.schema.js'

const resourceRouter = Router()

// Publicas (con autenticacion opcional: si viene token se identifica al
// usuario, y si es ADMIN puede ver ademas los recursos desactivados)
resourceRouter.get('/', optionalAuth, getAllResources)
resourceRouter.get('/:id', optionalAuth, validateIdParam, getResourceById)

// Protegidas: solo ADMIN.
// El orden de los middlewares importa: primero isAuth (para saber quien es),
// luego hasRole (para decidir si puede), luego la validacion del body y por
// ultimo el controlador.
resourceRouter.post(
    '/',
    isAuth,
    hasRole('ADMIN'),
    validateSchema(validateCreateResource),
    createResource
)

resourceRouter.put(
    '/:id',
    isAuth,
    hasRole('ADMIN'),
    validateIdParam,
    validateSchema(validateUpdateResource),
    updateResource
)

export default resourceRouter
