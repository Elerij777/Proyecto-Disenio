# Proyecto 1 — API de Gestión de Reservas y Espacios (Co-working / Eventos)

API REST para la reserva en tiempo real de salas de conferencia y espacios de trabajo. El núcleo del sistema es la validación estricta de disponibilidad por franjas horarias y la **prevención automática de solapamientos**: un mismo espacio no puede reservarse dos veces en el mismo lapso de tiempo.

## Participantes

- **Desarrolladores**
  - Kelvin Fernando Lopez Amaya 202000476
  - Erick Leonel Turcios Euceda 20212021280

---

## Stack tecnológico

| Capa | Tecnología |
| :--- | :--- |
| Servidor | Node.js 18+ · Express 5 |
| Base de datos | MySQL 8.0 (en contenedor Docker) |
| Driver | mysql2 (con promesas y sentencias preparadas) |
| Validación | Zod 4 |
| Autenticación | JWT (jsonwebtoken) |
| Contraseñas | bcrypt |

---

## Estructura del proyecto

```
proyecto-reservas/
├── api-reservas/                    ← la API (Node.js + Express)
│   ├── .env.dev                     ← plantilla de variables de entorno
│   ├── .gitignore
│   ├── index.js                     ← punto de entrada
│   ├── package.json
│   └── src/
│       ├── controllers/             ← reciben la petición, arman la respuesta
│       │   ├── auth.controller.js
│       │   ├── resource.controller.js
│       │   └── booking.controller.js
│       ├── db/
│       │   └── db.js                ← pool de conexiones MySQL
│       ├── helpers/
│       │   ├── json_response.js     ← formato uniforme de respuestas
│       │   └── datetime.js          ← fechas y cálculo de precio
│       ├── middlewares/
│       │   ├── auth.middleware.js   ← isAuth, hasRole, optionalAuth
│       │   ├── validate.middleware.js
│       │   ├── logger.middleware.js
│       │   └── errorHandler.middleware.js
│       ├── models/                  ← SQL puro
│       │   ├── auth.model.js
│       │   ├── resource.model.js
│       │   └── booking.model.js
│       ├── routes/
│       │   ├── auth.routes.js
│       │   ├── resource.routes.js
│       │   └── booking.routes.js
│       └── schemas/                 ← esquemas de validación Zod
│           ├── auth.schema.js
│           ├── resource.schema.js
│           └── booking.schema.js
│
└── db-reservas/                     ← la base de datos (Docker)
    ├── docker-compose.yml
    ├── README.md
    └── init/
        └── 01-init.sql              ← tablas, índices y datos semilla
```

La arquitectura es en capas: **ruta → middlewares → controlador → esquema → modelo → base de datos**. Cada capa solo conoce a la inmediatamente inferior; los controladores nunca escriben SQL y los modelos nunca conocen `req` ni `res`.

---

## Puesta en marcha

### 1. Levantar la base de datos

```bash
cd db-reservas
docker compose up -d
```

Esto crea un contenedor MySQL 8.0 en el puerto **3309** con la base `db_reservas_unah`, las tablas y los datos de prueba.

Para verificar que está corriendo:

```bash
docker compose ps
```

### 2. Configurar la API

```bash
cd ../api-reservas
npm install
cp .env.dev .env        
```

El archivo `.env` ya viene con los valores que coinciden con el contenedor. **Node no lee `.env.dev` automáticamente**, por eso hay que copiarlo como `.env`.

### 3. Arrancar el servidor

```bash
npm run dev
```

Debe mostrarse:

```
Conectado a MySQL en localhost:3309/db_reservas_unah
Servidor en marcha en: http://localhost:3000
```

---

## Usuarios de prueba

Todos usan la contraseña **`123456`**.

| Correo | Rol | Uso |
| :--- | :--- | :--- |
| `admin@cowork.com` | ADMIN | Crear/editar recursos, ver todas las reservas |
| `carlos@cliente.com` | CLIENT | Reservar, ver y cancelar sus propias reservas |
| `ana@cliente.com` | CLIENT | Útil para probar que un cliente no cancela reservas ajenas |

> **Nota sobre los hashes del enunciado:** el documento del proyecto indica que el hash `$2b$10$EixZaYVK1fsbw1ZfbX3OXe...` corresponde a `"123456"`, pero al verificarlo con `bcrypt.compare()` da `false` — es un hash de ejemplo difundido en tutoriales que no coincide con esa contraseña ni con otras comunes. Si se dejara tal cual, **ningún usuario semilla podría iniciar sesión**, incluido el ADMIN, y sería imposible probar los endpoints protegidos. Por eso `01-init.sql` usa hashes bcrypt generados y verificados localmente que sí corresponden a `"123456"`.

---

## Endpoints

Prefijo base: **`/api/v1`**

### Autenticación — `/api/v1/auth`

| Método | Ruta | Acceso | Descripción |
| :--- | :--- | :--- | :--- |
| `POST` | `/register` | Público | Crea un usuario con rol `CLIENT`. Body: `{ name, email, password }` |
| `POST` | `/login` | Público | Devuelve un JWT con payload `{ id, email, role }`. Body: `{ email, password }` |

### Recursos — `/api/v1/resources`

| Método | Ruta | Acceso | Descripción |
| :--- | :--- | :--- | :--- |
| `GET` | `/` | Público | Lista recursos activos. Un ADMIN puede añadir `?includeInactive=true` |
| `GET` | `/:id` | Público | Detalle de un recurso |
| `POST` | `/` | Solo ADMIN | Body: `{ name, description?, capacity, price_per_hour, is_active? }` |
| `PUT` | `/:id` | Solo ADMIN | Campos a actualizar (al menos uno) |

### Reservas — `/api/v1/bookings`

| Método | Ruta | Acceso | Descripción |
| :--- | :--- | :--- | :--- |
| `GET` | `/availability?resource_id=1&date=YYYY-MM-DD` | Público | Franjas ocupadas del recurso ese día |
| `POST` | `/` | CLIENT o ADMIN | Crea reserva. Body: `{ resource_id, start_time, end_time }`. Si hay solapamiento devuelve **409** |
| `GET` | `/my-bookings` | CLIENT o ADMIN | Reservas del usuario del token |
| `GET` | `/` | Solo ADMIN | Listado global. Filtros: `?status=`, `?resource_id=`, `?user_id=` |
| `PATCH` | `/:id/cancel` | CLIENT o ADMIN | Cancela si faltan más de 12 horas |

### Formato de las fechas

`start_time` y `end_time` aceptan estos formatos, sin zona horaria:

```
2026-08-05T14:00:00      2026-08-05 14:00:00      2026-08-05T14:00
```

Se tratan como **hora local del negocio** y se guardan literalmente en MySQL.

---

## Reglas de negocio implementadas

**1. Validación temporal.** `start_time` debe ser estrictamente menor que `end_time`, y no puede estar en el pasado. Se valida además que la fecha exista realmente: `2026-02-30` o `2026-13-01` se rechazan con 400.

**2. Prevención de solapamiento.** Dos franjas `[inicio, fin)` se solapan si `inicio_existente < fin_nuevo AND fin_existente > inicio_nuevo`. Al usar comparaciones estrictas, **las reservas contiguas sí se permiten**: 12:00–14:00 y 14:00–16:00 no chocan.

La comprobación se ejecuta dentro de una **transacción con `SELECT ... FOR UPDATE` sobre la fila del recurso**. Se bloquea el recurso y no las reservas porque las reservas conflictivas todavía no existen: no se puede bloquear una fila que aún no ha sido creada. Bloquear el recurso serializa los intentos de reserva sobre esa sala, mientras que reservas de salas distintas no se bloquean entre sí.

Sin esto, dos peticiones simultáneas podrían ejecutar su comprobación antes de que cualquiera inserte, ver la sala libre, e insertar ambas.

**3. Cálculo de precio.** `total_price` lo calcula siempre el servidor: duración en horas × `price_per_hour` del recurso. Se cobran horas fraccionarias (90 minutos = 1.5 h). El cliente no puede enviar `total_price`: el esquema es `.strict()` y rechaza el campo con 400.

**4. Política de cancelación.** Un CLIENT solo cancela reservas propias (si no, **403**) y con al menos 12 horas de anticipación (si no, **409**, indicando cuántas horas faltan). Un ADMIN puede cancelar cualquier reserva sin la restricción de tiempo, porque el enunciado condiciona esa ventana al cliente y un administrador sin capacidad de anulación perdería el control operativo del sistema.

La ventana es configurable con `CANCELLATION_WINDOW_HOURS` en el `.env`.

---

## Códigos de estado utilizados

| Código | Cuándo |
| :--- | :--- |
| `200` | Operación exitosa |
| `201` | Recurso o reserva creada |
| `400` | Datos inválidos (Zod), id no numérico, filtro incorrecto |
| `401` | Token ausente, mal formado, expirado o inválido; credenciales incorrectas |
| `403` | Autenticado pero sin permiso (CLIENT en ruta de ADMIN, cancelar reserva ajena) |
| `404` | Recurso, reserva o ruta no encontrada |
| `409` | Conflicto: solapamiento, email duplicado, reserva ya cancelada, fuera de la ventana de 12 h |
| `500` | Error interno no controlado |

La diferencia entre 401 y 403 es deliberada: **401** significa "no sé quién eres", **403** significa "sé quién eres, pero no puedes hacer esto".

---

## Formato de respuesta

Todas las respuestas comparten la misma estructura:

```json
{
  "success": true,
  "message": "Reserva creada correctamente",
  "data": { }
}
```

En los errores de validación, `data` contiene el detalle generado por Zod:

```json
{
  "success": false,
  "message": "No paso las validaciones",
  "data": [
    {
      "code": "custom",
      "path": ["start_time"],
      "message": "No se puede reservar en una fecha u hora que ya paso"
    }
  ]
}
```

---

## Middlewares

| Middleware | Tipo | Función |
| :--- | :--- | :--- |
| `requestLogger` | Global | Imprime `[FECHA/HORA] METODO - /ruta - Body: {...}`. Oculta contraseñas y tokens con `***` |
| `errorHandler` | Global | Captura errores no controlados y responde 500 genérico sin filtrar detalles internos |
| `isAuth` | Ruta | Verifica el JWT del header `Authorization: Bearer <token>` y llena `req.user` |
| `hasRole(...roles)` | Ruta | HOF que restringe por rol. Se usa después de `isAuth` |
| `optionalAuth` | Ruta | Identifica al usuario si hay token, pero no bloquea si no lo hay (endpoints públicos/autenticados) |
| `validateSchema(fn)` | Ruta | HOF que valida `req.body` con un esquema de Zod |
| `validateQuery(fn)` | Ruta | Igual pero para query params |
| `validateIdParam` | Ruta | Verifica que `:id` sea entero positivo |

---

## Decisiones de seguridad

- Las contraseñas se almacenan hasheadas con bcrypt (10 rondas). Nunca se devuelven en ninguna respuesta.
- El login responde el **mismo mensaje** si el correo no existe y si la contraseña es incorrecta, para no revelar qué correos están registrados.
- El rol **no se acepta desde el body** en el registro: `.strict()` rechaza `{"role":"ADMIN"}` con 400. El servidor siempre fuerza `CLIENT`.
- El `user_id` de una reserva sale del token, nunca del body.
- Todas las consultas usan **sentencias preparadas**. En el único `UPDATE` con columnas dinámicas se aplica una **lista blanca** de nombres de columna.
- El manejador de errores no expone stack traces ni mensajes crudos de MySQL, que podrían revelar nombres de tablas o rutas del sistema.
- El logger enmascara campos sensibles antes de imprimirlos.

---

## Pruebas

En `api-reservas/insomnia-collection.json` hay una colección lista para importar en Insomnia, con todos los endpoints y los casos de error organizados en carpetas.

**Importar:** Insomnia → Create → Import → File → seleccionar el archivo.

La colección incluye variables de entorno (`base_url`, `admin_token`, `client_token`, `booking_id`) y las peticiones están numeradas en el orden recomendado de ejecución.

### Comandos de la base de datos

```bash
# Detener el contenedor (conserva los datos)
docker compose down

# Reiniciar desde cero, volviendo a ejecutar 01-init.sql
docker compose down --volumes && docker compose up -d
```

El script `init/01-init.sql` solo se ejecuta la **primera vez** que se crea el volumen. Si lo modificas, necesitas el segundo comando.

### Conexión directa a MySQL

```bash
docker exec -it reservas_unah mysql -u unah -punah2026 db_reservas_unah
```
