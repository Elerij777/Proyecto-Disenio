import { Router } from 'express'
import { register, login } from '../controllers/auth.controller.js'
import { validateSchema } from '../middlewares/validate.middleware.js'
import { validateRegister, validateLogin } from '../schemas/auth.schema.js'

const authRouter = Router()

// Ambas rutas son publicas: no llevan isAuth porque son justamente
// las que permiten obtener el token.
authRouter.post('/register', validateSchema(validateRegister), register)
authRouter.post('/login', validateSchema(validateLogin), login)

export default authRouter
