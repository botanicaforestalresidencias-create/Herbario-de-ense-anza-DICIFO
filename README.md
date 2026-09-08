# Herbario de Enseñanza — Botánica Forestal
### División de Ciencias Forestales (DICIFO) | Universidad Autónoma Chapingo (UACh)

Sistema web progresivo (PWA) diseñado para la digitalización, catalogación taxonómica, consulta interactiva y etiquetado físico mediante códigos de barras para los pliegos botánicos del Herbario de Enseñanza en la División de Ciencias Forestales.

---

## 🌿 Características Principales

* **Portal de Acceso Diferenciado:**
  * **Alumnos y Docentes (Público):** Ingreso directo con un solo clic a la consulta del acervo sin solicitud de credenciales.
  * **Encargados del Herbario (Administración):** Módulo de inicio de sesión seguro y colapsado para la captura, actualización y baja de registros botánicos.
* **Catálogo Digital y Búsqueda Avanzada:**
  * Filtrado dinámico en tiempo real por familia, género, especie, nombre común, colector y número de registro.
  * Fichas técnicas detalladas con datos ecológicos, morfológicos, fenológicos y distribución geográfica.
* **Procesamiento y Optimización de Fotografías:**
  * Pipeline automatizado en el servidor mediante `sharp` y `multer`.
  * Conversión obligatoria a formato **WebP** a 80% de calidad con redimensionamiento máximo a 1400 px y corrección automática de orientación EXIF.
* **Control Físico y Lectura Óptica:**
  * **Etiquetado:** Generación de códigos de barras bajo estándar Code128 con `JsBarcode`, listos para impresión en pliegos de herbario.
  * **Escáner Móvil:** Lector integrado mediante cámara web/móvil para identificación instantánea del ejemplar físico.
* **Arquitectura PWA y Tolerancia a Fallos:**
  * **Service Worker (`sw.js`):** Estrategia híbrida (*Network First* para endpoints de API y *Cache First* para recursos visuales y estructurales).
  * **Manifest Normativo:** Instalable como aplicación de escritorio o móvil con identidad visual oficial de Chapingo y DICIFO.

---

## 🛠️ Stack Tecnológico

| Capa | Tecnologías |
| :--- | :--- |
| **Backend** | Node.js, Express.js |
| **Procesamiento Multimedia** | Multer (memoria), Sharp (WebP / pipeline) |
| **Base de Datos** | MySQL / MariaDB |
| **Frontend** | Vanilla JavaScript (ES6+), HTML5 semántico, CSS3 modular |
| **Capacidades PWA** | Web App Manifest, Service Workers Cache Storage API |
| **Librerías del Cliente** | JsBarcode (etiquetado), SweetAlert2 (notificaciones UI) |

---

## 📁 Estructura del Directorio

```text
herbario-dicifo/
├── package.json              # Dependencias y scripts de Node.js
├── server.js                 # Servidor principal Express
├── .env.example              # Plantilla para variables de entorno
├── .gitignore                # Reglas de exclusión de Git
├── uploads/                  # Directorio local de fotografías procesadas (.webp)
├── server/                   # Arquitectura backend
│   ├── db.js                 # Pool de conexiones MySQL
│   ├── seed.js               # Sembrado inicial de catálogo y taxonomía
│   └── routes/
│       ├── auth.js           # Rutas de autenticación y sesiones
│       ├── especimenes.js    # CRUD de especímenes y consultas taxonómicas
│       └── imagenes.js       # Endpoints de servicio y carga de fotos
└── renderer/                 # Aplicación cliente y PWA
    ├── login.html            # Portal principal de bienvenida y acceso
    ├── consulta.html         # Buscador general, fichas y lector de cámara
    ├── admin.html            # Panel de control, altas y módulo de impresión
    ├── manifest.json         # Declaración institucional de la PWA
    ├── sw.js                 # Service Worker (gestión de red y caché)
    ├── chapingo.png          # Escudo institucional UACh
    ├── forestales.png        # Escudo oficial DICIFO
    ├── css/
    │   └── style.css         # Paleta institucional verde monte y estilos UI
    ├── js/
    │   ├── login.js          # Control de autenticación y redirecciones
    │   ├── consulta.js       # Filtros taxonómicos, modal y escáner
    │   └── admin.js          # Formularios CRUD e impresión de códigos
    └── assets/
        ├── icon-192.png      # Icono PWA estándar (192x192 px)
        └── icon-512.png      # Icono PWA alta definición (512x512 px)
```

---

## ⚙️ Instalación y Configuración Local

### 1. Prerrequisitos
* Node.js v18.x o superior instalado.
* Motor de base de datos MySQL o MariaDB (XAMPP o servicio local).
* Git instalado en el sistema.

### 2. Clonación y dependencias
```bash
git clone [https://github.com/TU_USUARIO/Herbario-de-ense-anza-DICIFO.git](https://github.com/TU_USUARIO/Herbario-de-ense-anza-DICIFO.git)
cd Herbario-de-ense-anza-DICIFO
npm install
```

### 3. Configuración de variables de entorno
Crear un archivo `.env` en la raíz del proyecto tomando como base la siguiente estructura:

```env
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=tu_contraseña
DB_NAME=herbario_dicifo
SESSION_SECRET=clave_secreta_institucional_uach
```

### 4. Inicialización de la base de datos
Importar el esquema SQL base o ejecutar el script de inicialización:

```bash
node server/seed.js
```

### 5. Ejecución del sistema

```bash
# Modo desarrollo con reinicio automático
npm run dev

# Modo producción
npm start
```

Acceso disponible en: `http://localhost:3000/login.html`

---

## 📱 Despliegue en Red Local / Túnel PWA

Para probar la PWA con cámara y capacidades offline en dispositivos móviles:

1. Iniciar el túnel seguro:
   ```bash
   ngrok http 3000
   ```
2. Acceder desde el navegador móvil a la URL HTTPS generada por el túnel.
3. El navegador mostrará la opción nativa de instalación **"Agregar a pantalla de inicio"** o **"Instalar aplicación"**.

---

## 🔒 Consideraciones de Seguridad

* Las rutas administrativas (`admin.html` y sus endpoints REST) requieren validación de sesión activa.
* El archivo `.gitignore` previene la exposición de variables de entorno (`.env`), binarios y la carpeta `node_modules/`.
* Las imágenes cargadas se normalizan a formato `.webp` con nombres sanitizados para prevenir cargas maliciosas.

---

## 👥 Créditos

* **Institución:** División de Ciencias Forestales (DICIFO) — Universidad Autónoma Chapingo.
* **Área:** Herbario de Enseñanza de Botánica Forestal.
