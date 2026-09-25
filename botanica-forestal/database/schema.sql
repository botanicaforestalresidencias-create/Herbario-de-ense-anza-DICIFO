
CREATE DATABASE IF NOT EXISTS botanica_forestal
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE botanica_forestal;

-- ------------------------------------------------------------
-- Usuarios del sistema (alumno = solo consulta, admin = encargado)
-- ------------------------------------------------------------
CREATE TABLE usuarios (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  nombre         VARCHAR(150) NOT NULL,
  usuario        VARCHAR(50)  NOT NULL UNIQUE,
  password_hash  VARCHAR(255) NOT NULL,
  rol            ENUM('admin', 'alumno') NOT NULL DEFAULT 'alumno',
  creado_en      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- Tabla general: datos comunes a cualquier ejemplar
-- ------------------------------------------------------------
CREATE TABLE especimenes (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  numero_registro     VARCHAR(30) NOT NULL UNIQUE,   -- "Clave" / folio físico y para QR
  tipo                ENUM('Angiosperma', 'Gimnosperma') NOT NULL,
  familia             VARCHAR(100),
  nombre_cientifico   VARCHAR(200),
  nombre_comun        VARCHAR(150),
  distribucion        TEXT,
  otras_caracteristicas TEXT,
  qr_code             VARCHAR(255),                  -- referencia para futura consulta por QR
  creado_por          INT,
  creado_en           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  actualizado_en      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (creado_por) REFERENCES usuarios(id) ON DELETE SET NULL,
  INDEX idx_familia (familia),
  INDEX idx_especie (especie),
  INDEX idx_tipo (tipo)
);

-- ------------------------------------------------------------
-- Detalle exclusivo de Angiospermas (1:1 con especimenes)
-- ------------------------------------------------------------
CREATE TABLE angiospermas_detalle (
  especimen_id  INT PRIMARY KEY,
  hojas         TEXT,
  filotaxia     VARCHAR(150),
  sexualidad    VARCHAR(50),    -- ej. "Hermafrodita", "Dioica", "Monoica"
  flor          TEXT,
  fruto         TEXT,
  sexualidad    VARCHAR(150),
  ubicacion_herbario VARCHAR(100), -- clave física de la cartulina (ej. "T/II/16B")
  FOREIGN KEY (especimen_id) REFERENCES especimenes(id) ON DELETE CASCADE
);

-- ------------------------------------------------------------
-- Detalle exclusivo de Gimnospermas (1:1 con especimenes)
-- ------------------------------------------------------------
CREATE TABLE gimnospermas_detalle (
  especimen_id       INT PRIMARY KEY,
  subgenero          VARCHAR(100),
  seccion             VARCHAR(100),
  cono                VARCHAR(150),
  longitud_cono       VARCHAR(50),
  color_cono          VARCHAR(80),
  umbo                VARCHAR(100),
  largo_pedunculo     VARCHAR(50),
  tipo_semilla        VARCHAR(150),
  forma_aciculas      VARCHAR(150),
  numero_aciculas     VARCHAR(50),
  longitud_aciculas   VARCHAR(50),
  vaina               VARCHAR(100),
  bractea_foliar      VARCHAR(150),
  altitud             VARCHAR(80),
  FOREIGN KEY (especimen_id) REFERENCES especimenes(id) ON DELETE CASCADE
);

-- ------------------------------------------------------------
-- Imágenes (un ejemplar puede tener varias fotos)
-- ------------------------------------------------------------
CREATE TABLE imagenes (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  especimen_id  INT NOT NULL,
  ruta_archivo  VARCHAR(500) NOT NULL,
  campo         VARCHAR(50),    -- a qué campo del formulario pertenece: 'hojas', 'flor', 'fruto', 'sexualidad', 'cono', 'aciculas', 'semilla', 'general', etc.
  descripcion   VARCHAR(255),
  subida_en     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (especimen_id) REFERENCES especimenes(id) ON DELETE CASCADE
);

-- ------------------------------------------------------------
-- Campos personalizados (para que el encargado agregue campos
-- nuevos sin tener que alterar la estructura de la BD)
-- ------------------------------------------------------------
CREATE TABLE campos_personalizados (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  tipo_aplica   ENUM('Angiosperma', 'Gimnosperma', 'Ambos') NOT NULL,
  nombre_campo  VARCHAR(100) NOT NULL,
  creado_en     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE valores_personalizados (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  especimen_id  INT NOT NULL,
  campo_id      INT NOT NULL,
  valor         TEXT,
  FOREIGN KEY (especimen_id) REFERENCES especimenes(id) ON DELETE CASCADE,
  FOREIGN KEY (campo_id) REFERENCES campos_personalizados(id) ON DELETE CASCADE
);

-- ------------------------------------------------------------
-- Usuario administrador por defecto
-- password: admin123  (hash real se genera en primer arranque, ver seed.js)
-- ------------------------------------------------------------
-- INSERT se hace desde server/seed.js con bcrypt, no aquí en texto plano.
