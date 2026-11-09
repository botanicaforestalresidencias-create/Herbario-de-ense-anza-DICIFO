/* ============================================================
   IMPORTAR IMÁGENES DESDE CARPETA LOCAL (uso único, por consola)
   Uso:  node importar_imagenes.js            -> solo agrega imágenes
         node importar_imagenes.js --limpiar  -> borra antes las imágenes existentes
   ============================================================ */
const fs = require('fs');
const path = require('path');
const pool = require('./server/db');

const RUTA_IMAGENES = 'F:\\Imagenes';
const RUTA_DESTINO_UPLOADS = path.join(__dirname, 'server', 'public', 'uploads');
const LIMPIAR_ANTES = process.argv.includes('--limpiar');

const normalizarTexto = (t) => String(t || '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

const CAMPO_POR_CARPETA = {
  'arboles': 'arbol', 'flores': 'flor', 'flor': 'flor',
  'frutos': 'fruto', 'fruto': 'fruto',
  'conos': 'cono', 'cono': 'cono',
  'semillas': 'semilla', 'semilla': 'semilla',
  'distribucion': 'distribucion', 'hojas': 'hojas', 'sexualidad': 'sexualidad'
};

async function limpiarImagenesAnteriores() {
  console.log('[!] Borrando imágenes anteriores (base de datos y archivos)...');
  await pool.query('DELETE FROM imagenes');
  if (fs.existsSync(RUTA_DESTINO_UPLOADS)) {
    for (const archivo of fs.readdirSync(RUTA_DESTINO_UPLOADS)) {
      fs.unlinkSync(path.join(RUTA_DESTINO_UPLOADS, archivo));
    }
  }
}

async function importarCarpeta(directorio) {
  if (!fs.existsSync(directorio)) {
    console.log(`[!] La ruta no existe: ${directorio}`);
    return;
  }
  fs.mkdirSync(RUTA_DESTINO_UPLOADS, { recursive: true });

  for (const sub of fs.readdirSync(directorio, { withFileTypes: true })) {
    if (!sub.isDirectory()) continue;
    const campo = CAMPO_POR_CARPETA[normalizarTexto(sub.name)];
    if (!campo) {
      console.log(`[!] Carpeta sin campo asignado, se omite: ${sub.name}`);
      continue;
    }

    const rutaSub = path.join(directorio, sub.name);
    for (const archivo of fs.readdirSync(rutaSub)) {
      if (!/\.(jpg|jpeg|png|webp)$/i.test(archivo)) continue;

      const nombre = path.parse(archivo).name.trim();
      const [rows] = await pool.query(
        'SELECT id FROM especimenes WHERE TRIM(nombre_cientifico) = ? OR TRIM(numero_registro) = ?',
        [nombre, nombre]
      );
      if (rows.length !== 1) {
        console.log(`[✖] Sin coincidencia única en BD para: ${archivo}`);
        continue;
      }

      const especimenId = rows[0].id;
      const nuevoNombre = `img_${especimenId}_${Date.now()}_${Math.round(Math.random() * 1e6)}${path.extname(archivo)}`;
      fs.copyFileSync(path.join(rutaSub, archivo), path.join(RUTA_DESTINO_UPLOADS, nuevoNombre));

      await pool.query(
        'INSERT INTO imagenes (especimen_id, ruta_archivo, campo, descripcion) VALUES (?, ?, ?, ?)',
        [especimenId, nuevoNombre, campo, archivo]
      );
      console.log(`[✔] ${archivo} -> ID ${especimenId} [${campo}]`);
    }
  }
}

async function iniciarProceso() {
  try {
    if (LIMPIAR_ANTES) await limpiarImagenesAnteriores();
    await importarCarpeta(path.join(RUTA_IMAGENES, 'Angiospermas'));
    await importarCarpeta(path.join(RUTA_IMAGENES, 'Gimnospermas'));
    console.log('\n¡Proceso finalizado!');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

iniciarProceso();