import express from 'express'
import 'dotenv/config'

import authRouter from './src/routes/auth.routes.js'
import resourceRouter from './src/routes/resource.routes.js'
import bookingRouter from './src/routes/booking.routes.js'

import { requestLogger } from './src/middlewares/logger.middleware.js'
import { errorHandler } from './src/middlewares/errorHandler.middleware.js'
import { jsonResponse } from './src/helpers/json_response.js'
import { testConnection } from './src/db/db.js'

const app = express()

const PORT = process.env.PORT || 3000
const API_PREFIX = '/api/v1'

// =========================================================================
// MIDDLEWARES GLOBALES
// El orden es significativo: express.json() debe ir antes del logger para
// que req.body ya este parseado cuando el logger intente imprimirlo.
// =========================================================================
app.use(express.json())
app.use(requestLogger)

// =========================================================================
// RUTAS
// =========================================================================
app.get('/', (req, res) => {
    res.json(jsonResponse({
        message: 'API de Gestion de Reservas y Espacios - Co-working / Eventos',
        data: {
            version: 'v1',
            endpoints: {
                auth: `${API_PREFIX}/auth`,
                resources: `${API_PREFIX}/resources`,
                bookings: `${API_PREFIX}/bookings`
            }
        }
    }))
})

app.use(`${API_PREFIX}/auth`, authRouter)
app.use(`${API_PREFIX}/resources`, resourceRouter)
app.use(`${API_PREFIX}/bookings`, bookingRouter)

// Ruta no encontrada (debe ir despues de todas las rutas validas)
app.use((req, res) => {
    res.status(404).json(jsonResponse({
        status: 404,
        message: 'Ruta no encontrada',
        data: null
    }))
})

// Manejador global de errores (siempre el ultimo)
app.use(errorHandler)

// =========================================================================
// ARRANQUE
// =========================================================================
const iniciarServidor = async () => {

    // Falta de configuracion critica: es mejor detenerse aqui con un mensaje
    // claro que arrancar y fallar en la primera peticion de login.
    if (!process.env.JWT_KEY) {
        console.error('Falta la variable JWT_KEY en el archivo .env')
        console.error('Copia .env.dev como .env y completa los valores.')
        process.exit(1)
    }

    await testConnection()

    app.listen(PORT, () => {
        console.log(`Servidor en marcha en: http://localhost:${PORT}`)
    })
}

iniciarServidor()
