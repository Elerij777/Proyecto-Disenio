// Middleware global de logging.
// Imprime cada peticion entrante con el formato:
//   [FECHA/HORA] METODO - /ruta - Body: {...}

// Campos que nunca deben aparecer en los logs.
// Un log con contrasenas en texto plano es una fuga de datos, y los logs
// suelen terminar en archivos, consolas compartidas o servicios externos.
const CAMPOS_SENSIBLES = ['password', 'password_hash', 'token', 'confirmPassword']

const ocultarSensibles = (body) => {

    if (!body || typeof body !== 'object') return body

    const copia = { ...body }

    for (const campo of CAMPOS_SENSIBLES) {
        if (campo in copia) copia[campo] = '***'
    }

    return copia
}

export const requestLogger = (req, res, next) => {

    const fechaHora = new Date().toISOString()
    const body = JSON.stringify(ocultarSensibles(req.body) ?? {})

    console.log(`[${fechaHora}] ${req.method} - ${req.originalUrl} - Body: ${body}`)

    next()
}
