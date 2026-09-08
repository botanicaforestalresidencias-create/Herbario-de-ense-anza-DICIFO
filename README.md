# Herbario de Enseñanza — Botánica Forestal
### División de Ciencias Forestales (DICIFO) | Universidad Autónoma Chapingo (UACh)

Sistema web progresivo (PWA) desarrollado para la digitalización, consulta taxonómica y gestión de ejemplares botánicos del Herbario de Enseñanza, optimizado para trabajo en campo y laboratorios.

---

##  Características Principales

* **Portal Institucional de Doble Perfil:** 
  * **Acceso Público:** Consulta inmediata para alumnos y docentes sin requerir registro previo.
  * **Panel de Administración:** Control protegido por credenciales para captura, edición y baja de especímenes botánicos.
* **Procesamiento y Optimización de Imágenes:** Pipeline backend con `sharp` para redimensionar y convertir fotografías botánicas a formato `.webp` de forma automática, reduciendo el consumo de almacenamiento y ancho de banda.
* **Escaneo y Etiquetado Físico:** Generación e impresión de etiquetas con códigos de barras (Code128 vía `JsBarcode`) y módulo de lectura óptica en vivo mediante cámara web/móvil para búsqueda instantánea de pliegos físicos.
* **PWA & Modo Offline:** Service Worker con estrategia de caché híbrida (*Network First* para llamadas a la API y *Cache First* para activos estáticos y fotografías) con soporte de instalación en Windows, Android e iOS con identidad oficial.

---

##  Stack Tecnológico

* **Backend:** Node.js, Express.js, Multer, Sharp.
* **Frontend:** HTML5 semántico, CSS3 modular (paleta institucional verde monte UACh), JavaScript Vanilla.
* **Base de Datos:** MySQL / MariaDB.
* **Librerías Cliente:** JsBarcode, SweetAlert2.

---

##  Estructura del Repositorio

```text
├── renderer/                 # Frontend y recursos de la PWA
│   ├── assets/               # Iconos normativos PWA (192x192 y 512x512)
│   ├── css/                  # Hojas de estilo institucionales
│   ├── js/                   # Controladores (login, consulta y admin)
│   ├── admin.html            # Gestión de ejemplares y etiquetas
│   ├── consulta.html         # Buscador botánico y escáner
│   ├── login.html            # Acceso principal
│   ├── manifest.json         # Configuración PWA
│   └── sw.js                 # Service Worker (Caché y soporte offline)
├── server/                   # Lógica backend y rutas de la API
│   ├── routes/               # Endpoints REST (auth, especímenes, imágenes)
│   └── db.js                 # Pool de conexiones a base de datos
├── uploads/                  # Directorio de imágenes optimizadas (.webp)
├── .gitignore                # Exclusión de archivos locales y dependencias
├── package.json              # Manifiesto de dependencias npm
└── README.md                 # Documentación técnica
