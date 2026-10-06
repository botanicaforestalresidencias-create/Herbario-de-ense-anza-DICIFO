const fs = require('fs');
const path = require('path');
const pool = require('./server/db'); // Conexión a tu base de datos

const RUTA_IMAGENES = 'F:\\Imagenes';
const RUTA_DESTINO_UPLOADS = path.join(__dirname, 'uploads');

const MAPEO_CAMPOS = {
  'distribucion': 'distribucion',
  'flores': 'flor',
  'frutos': 'fruto',
  'arboles': 'arbol',
  'conos': 'cono'
};

async function limpiarImagenesAnteriores() {
  console.log('[🧹] Limpiando registros anteriores de imágenes en la base de datos...');
  await pool.query('DELETE FROM imagenes');

  console.log('[🧹] Limpiando archivos físicos anteriores de la carpeta uploads...');
  if (fs.existsSync(RUTA_DESTINO_UPLOADS)) {
    const archivos = fs.readdirSync(RUTA_DESTINO_UPLOADS);
    for (const archivo of archivos) {
      fs.unlinkSync(path.join(RUTA_DESTINO_UPLOADS, archivo));
    }
  } else {
    fs.mkdirSync(RUTA_DESTINO_UPLOADS, { recursive: true });
  }
  console.log('[✔] ¡Pizarra limpia!');
}

async function importarCarpeta(directorio) {
  if (!fs.existsSync(directorio)) {
    console.log(`[!] La ruta no existe: ${directorio}`);
    return;
  }
  
  const subcarpetas = fs.readdirSync(directorio, { withFileTypes: true });

  for (const sub of subcarpetas) {
    if (sub.isDirectory()) {
      const nombreCarpeta = sub.name.toLowerCase();
      const campoDb = MAPEO_CAMPOS[nombreCarpeta] || 'general';
      const rutaSubCarpeta = path.join(directorio, sub.name);
      
      const archivos = fs.readdirSync(rutaSubCarpeta);

      for (const archivo of archivos) {
        if (/\.(jpg|jpeg|png|webp)$/i.test(archivo)) {
          const nombreIdentificador = path.parse(archivo).name.trim();
          
          // Búsqueda estricta y exacta
          const [rows] = await pool.query(
            `SELECT id FROM especimenes WHERE TRIM(nombre_cientifico) = ? OR TRIM(numero_registro) = ?`,
            [nombreIdentificador, nombreIdentificador]
          );

          if (rows.length > 0) {
            const especimenId = rows[0].id;
            const ext = path.extname(archivo);
            const nuevoNombreArchivo = `img_${especimenId}_${Date.now()}${ext}`;
            const origen = path.join(rutaSubCarpeta, archivo);
            const destino = path.join(RUTA_DESTINO_UPLOADS, nuevoNombreArchivo);

            fs.copyFileSync(origen, destino);

            await pool.query(
              `INSERT INTO imagenes (especimen_id, ruta_archivo, campo) VALUES (?, ?, ?)`,
              [especimenId, nuevoNombreArchivo, campoDb]
            );

            console.log(`[✔] Asignada: ${archivo} -> Espécimen ID ${especimenId} [${campoDb}]`);
          } else {
            console.log(`[✖] Sin coincidencia exacta en BD para: ${archivo}`);
          }
        }
      }
    }
  }
}

async function iniciarProceso() {
  try {
    await limpiarImagenesAnteriores();
    console.log('\nIniciando importación masiva exacta...');
    await importarCarpeta(path.join(RUTA_IMAGENES, 'Angiospermas'));
    await importarCarpeta(path.join(RUTA_IMAGENES, 'Gimnospermas'));
    console.log('\n¡Proceso finalizado con éxito!');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

iniciarProceso();