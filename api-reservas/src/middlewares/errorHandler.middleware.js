import { jsonResponse } from '../helpers/json_response.js'

// Middleware global de manejo de errores.
// Debe declararse DESPUES de todas las rutas y recibir 4 argumentos:
// Express identifica a los manejadores de error por la cantidad de parametros.

export const errorHandler = (err, req, res, next) => {

    // El detalle tecnico se registra en el servidor...
    console.error('Error no controlado:', err)

    // ...pero no se le devuelve al cliente. Un stack trace o un mensaje crudo
    // de MySQL puede revelar nombres de tablas, rutas del sistema de archivos
    // o fragmentos de consultas, que son informacion util para un atacante.
    res.status(500).json(jsonResponse({
        status: 500,
        message: 'Error interno del servidor',
        data: null
    }))
}
