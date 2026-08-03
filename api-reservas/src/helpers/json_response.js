// Formato uniforme de respuesta para toda la API.
// Mantener una sola forma de respuesta le facilita la vida a quien consuma
// la API: siempre sabe que va a recibir success, message y data.

export const jsonResponse = ({ status = 200, message = 'Informacion no encontrada', data = null }) => {

    return {
        success: status >= 200 && status < 300,
        message,
        data
    }
}
