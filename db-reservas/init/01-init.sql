-- =========================================================================
-- PROYECTO 1: API DE GESTION DE RESERVAS Y ESPACIOS (CO-WORKING / EVENTOS)
-- Script de inicializacion de la base de datos
-- =========================================================================
-- Este archivo lo ejecuta MySQL automaticamente la PRIMERA vez que se crea
-- el volumen del contenedor (ver docker-compose.yml). Si lo modificas, debes
-- recrear el volumen con: docker compose down --volumes && docker compose up -d
-- =========================================================================

USE `db_reservas_proyecto`;

-- =========================================================================
-- 1. TABLAS
-- =========================================================================

-- Usuarios del sistema (clientes y administradores)
CREATE TABLE IF NOT EXISTS `users` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(100) NOT NULL,
    `email` VARCHAR(150) NOT NULL UNIQUE,
    `password_hash` VARCHAR(255) NOT NULL,
    `role` ENUM('CLIENT', 'ADMIN') NOT NULL DEFAULT 'CLIENT',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Espacios reservables (salas, oficinas, auditorios)
CREATE TABLE IF NOT EXISTS `resources` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(100) NOT NULL,
    `description` TEXT,
    `capacity` INT NOT NULL,
    `price_per_hour` DECIMAL(10, 2) NOT NULL,
    `is_active` BOOLEAN DEFAULT TRUE,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Reservas
CREATE TABLE IF NOT EXISTS `bookings` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT NOT NULL,
    `resource_id` INT NOT NULL,
    `start_time` DATETIME NOT NULL,
    `end_time` DATETIME NOT NULL,
    `total_price` DECIMAL(10, 2) NOT NULL,
    `status` ENUM('CONFIRMED', 'CANCELLED') NOT NULL DEFAULT 'CONFIRMED',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`resource_id`) REFERENCES `resources`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================================
-- 2. INDICES
-- =========================================================================
-- La consulta mas frecuente y mas critica del sistema es la de solapamiento:
--   WHERE resource_id = ? AND status = 'CONFIRMED' AND start_time < ? AND end_time > ?
-- Este indice compuesto permite que MySQL resuelva esa busqueda sin recorrer
-- toda la tabla, algo que importa cada vez mas conforme crecen las reservas.

CREATE INDEX `idx_bookings_overlap`
    ON `bookings` (`resource_id`, `status`, `start_time`, `end_time`);

-- Para GET /my-bookings (reservas de un usuario, ordenadas por fecha)
CREATE INDEX `idx_bookings_user`
    ON `bookings` (`user_id`, `start_time`);

-- =========================================================================
-- 3. DATOS INICIALES DE PRUEBA (SEMILLA)
-- =========================================================================
-- IMPORTANTE: los password_hash corresponden a la contrasena "123456"
-- y estan generados con bcrypt (prefijo $2b$). Por eso la API usa bcrypt
-- y no argon2: asi estos usuarios pueden iniciar sesion sin regenerar nada.
--
-- NOTA SOBRE UNA CORRECCION AL ENUNCIADO:
-- El hash que aparece en el documento del proyecto
--   $2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6L6s58G8L85aY6Ke
-- es un hash de ejemplo muy difundido en tutoriales, y NO corresponde
-- realmente a "123456" (se verifico con bcrypt.compare y da false).
-- Si se dejara tal cual, ningun usuario semilla podria iniciar sesion,
-- incluido el ADMIN, y seria imposible probar POST/PUT /resources.
-- Por eso aqui se usan hashes bcrypt generados y verificados localmente,
-- que si corresponden a la contrasena "123456".

INSERT INTO `users` (`id`, `name`, `email`, `password_hash`, `role`) VALUES
(1, 'Admin CoWork',  'admin@cowork.com',   '$2b$10$TOlgsYOOBlQTnIJfK8NpWOQ5AhyttjPRdfx2Y7kh1Wrevfs.DUxVa', 'ADMIN'),
(2, 'Carlos Mendoza', 'carlos@cliente.com', '$2b$10$TOlgsYOOBlQTnIJfK8NpWOQ5AhyttjPRdfx2Y7kh1Wrevfs.DUxVa', 'CLIENT'),
(3, 'Ana Gomez',      'ana@cliente.com',    '$2b$10$TOlgsYOOBlQTnIJfK8NpWOQ5AhyttjPRdfx2Y7kh1Wrevfs.DUxVa', 'CLIENT');

INSERT INTO `resources` (`id`, `name`, `description`, `capacity`, `price_per_hour`, `is_active`) VALUES
(1, 'Sala de Juntas A',   'Equipada con proyector 4K, pizarra y videoconferencia.', 10, 25.00, TRUE),
(2, 'Oficina Privada B',  'Espacio individual insonorizado ideal para llamadas.',    2, 12.50, TRUE),
(3, 'Auditorio Principal','Auditorio amplio para presentaciones y talleres.',       50, 80.00, TRUE);

INSERT INTO `bookings` (`id`, `user_id`, `resource_id`, `start_time`, `end_time`, `total_price`, `status`) VALUES
(1, 2, 1, '2026-08-01 10:00:00', '2026-08-01 12:00:00', 50.00, 'CONFIRMED');
