import * as z from 'zod'

// Definiciones reutilizables de cada campo
const nameField = z
    .string('El nombre debe ser un texto')
    .trim()
    .min(3, 'El nombre debe tener minimo 3 caracteres')
    .max(100, 'El nombre debe tener maximo 100 caracteres')

const descriptionField = z
    .string('La descripcion debe ser un texto')
    .trim()
    .max(1000, 'La descripcion debe tener maximo 1000 caracteres')

const capacityField = z
    .number('La capacidad debe ser un numero')
    .int('La capacidad debe ser un numero entero')
    .min(1, 'La capacidad debe ser minimo 1')
    .max(10000, 'La capacidad debe ser maximo 10000')

const pricePerHourField = z
    .number('El precio por hora debe ser un numero')
    .positive('El precio por hora debe ser mayor a 0')
    .max(99999999.99, 'El precio por hora excede el maximo permitido')
    // El tope viene de la columna DECIMAL(10,2): 8 digitos enteros + 2 decimales.
    // Sin esta validacion, MySQL rechazaria el INSERT con un error crudo.

const isActiveField = z.boolean('El campo is_active debe ser verdadero o falso')

// POST /api/v1/resources  (solo ADMIN)
const createResourceSchema = z.object({
    name: nameField,
    description: descriptionField.optional(),
    capacity: capacityField,
    price_per_hour: pricePerHourField,
    is_active: isActiveField.optional().default(true)
}).strict('No se permiten campos adicionales')

// PUT /api/v1/resources/:id  (solo ADMIN)
//
// Se declara por separado en lugar de usar createResourceSchema.partial()
// a proposito: .partial() conservaria el .default(true) de is_active, y
// entonces actualizar solo el nombre de un recurso desactivado lo volveria
// a activar sin que el administrador lo pidiera. Aqui ningun campo tiene
// default, asi que solo se modifica lo que el cliente envia explicitamente.
const updateResourceSchema = z.object({
    name: nameField.optional(),
    description: descriptionField.optional(),
    capacity: capacityField.optional(),
    price_per_hour: pricePerHourField.optional(),
    is_active: isActiveField.optional()
}).strict('No se permiten campos adicionales')
    .refine((data) => Object.keys(data).length > 0, {
        message: 'Debe enviar al menos un campo para actualizar'
    })

export const validateCreateResource = (data) => createResourceSchema.safeParse(data)
export const validateUpdateResource = (data) => updateResourceSchema.safeParse(data)
