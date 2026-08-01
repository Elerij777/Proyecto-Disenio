
//formato de mensaje de respuesta de la API
export const jsonResponse = ({ status = 200, message = 'Informacion no encontrada', data = null }) => {

    return {
        success: status >= 200 && status < 300,
        message,
        data
    }
}