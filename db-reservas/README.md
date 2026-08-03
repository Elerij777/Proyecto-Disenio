# Servidor de Base de Datos — Proyecto de Reservas

Levanta un contenedor MySQL 8.0 con la estructura y los datos de prueba del sistema de reservas de espacios de co-working.

## Prerrequisitos

- [Docker](https://www.docker.com/get-started) y Docker Compose instalados.

## Puesta en marcha

```bash
docker compose up -d
```

## Credenciales

| Parámetro | Valor |
| :--- | :--- |
| Host | `localhost` |
| Puerto | `3309` |
| Usuario | `admin` |
| Contraseña | `admin2026` |
| Base de datos | `db_reservas_proyecto` |

También existe el usuario `root` con contraseña `root`.


## Estructura

| Tabla | Contenido |
| :--- | :--- |
| `users` | Usuarios del sistema (`id`, `name`, `email`, `password_hash`, `role`, `created_at`) |
| `resources` | Espacios reservables (`id`, `name`, `description`, `capacity`, `price_per_hour`, `is_active`, `created_at`) |
| `bookings` | Reservas (`id`, `user_id`, `resource_id`, `start_time`, `end_time`, `total_price`, `status`, `created_at`) |

`role` es un ENUM `CLIENT`/`ADMIN`; `status` es un ENUM `CONFIRMED`/`CANCELLED`. Ambas claves foráneas de `bookings` usan `ON DELETE CASCADE`.

### Índices

```sql
idx_bookings_overlap  (resource_id, status, start_time, end_time)
idx_bookings_user     (user_id, start_time)
```

El primero existe porque la consulta más crítica del sistema es la de solapamiento, que filtra exactamente por esas cuatro columnas. Sin el índice, MySQL tendría que recorrer toda la tabla de reservas en cada intento de reserva.

## Datos de prueba

- **3 usuarios**: 1 ADMIN y 2 CLIENT (contraseña `123456` para todos)
- **3 recursos**: Sala de Juntas A (L 25.00/h), Oficina Privada B (L 12.50/h), Auditorio Principal (L 80.00/h)
- **1 reserva** confirmada: recurso 1, el 2026-08-01 de 10:00 a 12:00

Esa reserva sirve para probar el rechazo por solapamiento sin tener que crear nada primero.

## Consultas útiles

### Ver todas las reservas con usuario y recurso

```sql
SELECT
    b.id,
    u.name  AS usuario,
    r.name  AS recurso,
    b.start_time,
    b.end_time,
    b.total_price,
    b.status
FROM bookings b
JOIN users u     ON u.id = b.user_id
JOIN resources r ON r.id = b.resource_id
ORDER BY b.start_time;
```

### Comprobar solapamientos de un recurso

```sql
SELECT id, start_time, end_time
FROM bookings
WHERE resource_id = 1
  AND status = 'CONFIRMED'
  AND start_time < '2026-08-01 12:00:00'
  AND end_time   > '2026-08-01 10:00:00';
```

### Ocupación por recurso

```sql
SELECT
    r.name,
    COUNT(b.id) AS reservas,
    COALESCE(SUM(b.total_price), 0) AS ingresos
FROM resources r
LEFT JOIN bookings b ON b.resource_id = r.id AND b.status = 'CONFIRMED'
GROUP BY r.id, r.name;
```

## Detener el contenedor

```bash
docker compose down
```

Los datos se conservan en el volumen persistente.

## Reinicio completo

```bash
docker compose down --volumes && docker compose up -d
```

> Este comando **elimina todos los datos**. Es necesario si modificas `init/01-init.sql`, porque Docker solo ejecuta los scripts de inicialización la primera vez que crea el volumen.

## Conectarse desde la terminal

```bash
docker exec -it reservas_unah mysql -u unah -punah2026 db_reservas_unah
```
