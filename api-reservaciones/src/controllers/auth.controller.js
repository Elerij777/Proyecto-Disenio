import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import AuthModel from '../models/auth.model.js'
import { jsonResponse } from '../helpers/json_response.js'

// Coste de bcrypt. 10 rondas es el valor por defecto recomendado: cada
// incremento duplica el tiempo de calculo, lo que encarece un ataque de
// fuerza bruta sin que el login se sienta lento.
const SALT_ROUNDS = 10

/**
 * POST /api/v1/auth/register  (publico)
 * Crea siempre un usuario con rol CLIENT.
 */
export const register = async (req, res, next) => {

    try {
        const { name, email, password } = req.validatedData

        // El correo es UNIQUE en la base de datos, asi que el INSERT fallaria
        // igual; se comprueba antes para devolver un 409 claro en lugar de un
        // error 500 originado por la restriccion de MySQL.
        if (await AuthModel.emailExists(email)) {
            return res.status(409).json(jsonResponse({
                status: 409,
                message: 'Ya existe una cuenta registrada con ese correo',
                data: null
            }))
        }

        const password_hash = await bcrypt.hash(password, SALT_ROUNDS)

        const user = await AuthModel.register({ name, email, password_hash })

        return res.status(201).json(jsonResponse({
            status: 201,
            message: 'Usuario registrado correctamente',
            data: user
        }))

    } catch (e) {
        next(e)
    }
}

/**
 * POST /api/v1/auth/login  (publico)
 * Devuelve un token JWT con el payload { id, email, role }.
 */
export const login = async (req, res, next) => {

    try {
        const { email, password } = req.validatedData

        const user = await AuthModel.findByEmail(email)

        // Se responde exactamente el mismo mensaje si el correo no existe y si
        // la contrasena es incorrecta. Distinguirlos le permitiria a un atacante
        // averiguar que correos estan registrados en el sistema.
        const credencialesInvalidas = () => res.status(401).json(jsonResponse({
            status: 401,
            message: 'Credenciales invalidas',
            data: null
        }))

        if (!user) return credencialesInvalidas()

        const passwordCorrecta = await bcrypt.compare(password, user.password_hash)

        if (!passwordCorrecta) return credencialesInvalidas()

        // Payload del token, tal como lo pide el enunciado.
        // Nunca debe incluir la contrasena ni su hash: el contenido de un JWT
        // va codificado en base64, no cifrado, y cualquiera puede leerlo.
        const payload = {
            id: user.id,
            email: user.email,
            role: user.role
        }

        const token = jwt.sign(payload, process.env.JWT_KEY, {
            expiresIn: process.env.JWT_EXPIRES_IN || '8h'
        })

        return res.status(200).json(jsonResponse({
            status: 200,
            message: 'Bienvenido',
            data: {
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role
                },
                token
            }
        }))

    } catch (e) {
        next(e)
    }
}
