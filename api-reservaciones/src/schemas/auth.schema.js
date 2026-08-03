import * as z from 'zod'

// POST /api/v1/auth/register
// El rol NO se acepta desde el body: .strict() rechaza cualquier campo extra,
// asi nadie puede registrarse como ADMIN enviando { "role": "ADMIN" }.
// El servidor siempre fuerza CLIENT.
const registerSchema = z.object({
    name: z
        .string('El nombre debe ser un texto')
        .trim()
        .min(3, 'El nombre debe tener minimo 3 caracteres')
        .max(100, 'El nombre debe tener maximo 100 caracteres'),

    email: z
        .email('El correo no tiene un formato valido')
        .max(150, 'El correo debe tener maximo 150 caracteres')
        .toLowerCase(),

    password: z
        .string('La contrasena debe ser un texto')
        .min(6, 'La contrasena debe tener minimo 6 caracteres')
        .max(72, 'La contrasena debe tener maximo 72 caracteres')
        // bcrypt trunca silenciosamente lo que pase de 72 bytes; se rechaza
        // antes para que el usuario no crea que guardo una clave mas larga.
}).strict('No se permiten campos adicionales en el registro')

// POST /api/v1/auth/login
const loginSchema = z.object({
    email: z
        .email('El correo no tiene un formato valido')
        .toLowerCase(),

    password: z
        .string('La contrasena debe ser un texto')
        .min(1, 'La contrasena es obligatoria')
}).strict('No se permiten campos adicionales en el login')

export const validateRegister = (data) => registerSchema.safeParse(data)
export const validateLogin = (data) => loginSchema.safeParse(data)
