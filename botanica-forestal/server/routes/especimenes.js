/* ============================================================
   HERBARIO DIGITAL - ESPECIMENES.JS (LIMPIO - SIN CLAVE EXTRA)
   ============================================================ */
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { requireAuth, requireAdmin } = require('./auth');
const multer = require('multer');
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

const uploadExcel = multer({ storage: multer.memoryStorage() });

const storageCarpeta = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../public/uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname.replace(/\s+/g, '_'));
  }
});
const uploadCarpeta = multer({ storage: storageCarpeta });

async function getEspecimenCompleto(id) {
  const [[especimen]] = await pool.query(
    'SELECT * FROM especimenes WHERE id = ?',
    [id]
  );
  if (!especimen) return null;

  let detalle = {};
  const tipoNorm = (especimen.tipo || '').trim().toLowerCase();

  if (tipoNorm.includes('angio')) {
    const [rows] = await pool.query(
      'SELECT * FROM angiospermas_detalle WHERE especimen_id = ?',
      [id]
    );
    detalle = rows[0] || {};
  } else {
    const [rows] = await pool.query(
      'SELECT * FROM gimnospermas_detalle WHERE especimen_id = ?',
      [id]
    );
    detalle = rows[0] || {};
  }

  const [imagenes] = await pool.query(
    'SELECT id, ruta_archivo, campo, descripcion FROM imagenes WHERE especimen_id = ?',
    [id]
  );

  const [personalizados] = await pool.query(
    `SELECT cp.nombre_campo, vp.valor
     FROM valores_personalizados vp
     JOIN campos_personalizados cp ON cp.id = vp.campo_id
     WHERE vp.especimen_id = ?`,
    [id]
  );

  return { ...especimen, detalle, imagenes, campos_personalizados: personalizados || [] };
}

router.post('/upload-folder', requireAuth, requireAdmin, uploadCarpeta.array('imagenes'), async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No se seleccionó ninguna imagen.' });
  }

  const conn = await pool.getConnection();
  let procesadas = 0;

  try {
    await conn.beginTransaction();

    for (const file of req.files) {
      const nombreOriginal = file.originalname;
      const nombreLimpio = path.parse(nombreOriginal).name.trim();

      let [rows] = await conn.query(
        'SELECT id, tipo FROM especimenes WHERE TRIM(nombre_cientifico) = ?', 
        [nombreLimpio]
      );

      if (rows.length === 0) {
        [rows] = await conn.query(
          'SELECT id, tipo FROM especimenes WHERE nombre_cientifico LIKE ?', 
          [`%${nombreLimpio}%`]
        );
      }

      if (rows.length > 0) {
        const especimen = rows[0];
        const especimenId = especimen.id;

        let campoAsignado = 'Árboles';
        const rutaRelativaOriginal = (file.webkitRelativePath || '').toLowerCase();
        
        if (rutaRelativaOriginal.includes('flor')) campoAsignado = 'Flores';
        else if (rutaRelativaOriginal.includes('fruto')) campoAsignado = 'Frutos';
        else if (rutaRelativaOriginal.includes('cono')) campoAsignado = 'Conos';
        else if (rutaRelativaOriginal.includes('semilla')) campoAsignado = 'Semilla';
        else if (rutaRelativaOriginal.includes('distribucion')) campoAsignado = 'Distribución';

        const rutaRelativaServidor = `/uploads/${file.filename}`;

        const [imagenExistente] = await conn.query(
          'SELECT id FROM imagenes WHERE especimen_id = ? AND ruta_archivo LIKE ?',
          [especimenId, `%${path.basename(file.filename).split('-').slice(1).join('-')}%`]
        );

        if (imagenExistente.length === 0) {
          await conn.query(
            'INSERT INTO imagenes (especimen_id, ruta_archivo, campo) VALUES (?, ?, ?)',
            [especimenId, rutaRelativaServidor, campoAsignado]
          );
          procesadas++;
        } else {
          try {
            fs.unlinkSync(file.path);
          } catch (e) {}
        }
      } else {
        try {
          fs.unlinkSync(file.path);
        } catch (e) {}
      }
    }

    await conn.commit();
    res.json({ ok: true, procesadas });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: 'Error interno al procesar los archivos.' });
  } finally {
    conn.release();
  }
});

router.get('/campos-unicos', requireAuth, async (req, res) => {
  try {
    const { tipo } = req.query;
    const query = `
      SELECT DISTINCT cp.nombre_campo 
      FROM campos_personalizados cp
      JOIN valores_personalizados vp ON cp.id = vp.campo_id
      JOIN especimenes e ON vp.especimen_id = e.id
      WHERE (? IS NULL OR e.tipo = ?) 
        AND cp.nombre_campo IS NOT NULL 
        AND cp.nombre_campo != ''
    `;
    const [rows] = await pool.query(query, [tipo || null, tipo || null]);
    res.json(rows.map(r => r.nombre_campo));
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener campos universales' });
  }
});

router.get('/exportar/excel', requireAuth, async (req, res) => {
  try {
    const [valoresPersonalizados] = await pool.query(`
      SELECT vp.especimen_id, cp.nombre_campo, vp.valor
      FROM valores_personalizados vp
      JOIN campos_personalizados cp ON cp.id = vp.campo_id
      WHERE cp.nombre_campo IS NOT NULL AND cp.nombre_campo != ''
    `);

    const extrasPorEspecimen = {};
    for (const fila of valoresPersonalizados) {
      if (!extrasPorEspecimen[fila.especimen_id]) {
        extrasPorEspecimen[fila.especimen_id] = {};
      }
      extrasPorEspecimen[fila.especimen_id][fila.nombre_campo.trim().toUpperCase()] = fila.valor || '';
    }

    const [angios] = await pool.query(`
      SELECT e.id, e.numero_registro, e.familia, e.nombre_cientifico, e.nombre_comun, e.distribucion, e.otras_caracteristicas, a.hojas, a.filotaxia, a.flor, a.fruto, a.sexualidad
      FROM especimenes e
      LEFT JOIN angiospermas_detalle a ON e.id = a.especimen_id
      WHERE e.tipo LIKE '%Angio%'
      ORDER BY CAST(e.numero_registro AS UNSIGNED) ASC, e.numero_registro ASC
    `);

    const [gimnos] = await pool.query(`
      SELECT e.id, e.numero_registro, e.familia, e.nombre_cientifico, e.nombre_comun, e.distribucion, e.otras_caracteristicas, g.altitud, g.subgenero, g.seccion, g.cono, g.umbo, g.tipo_semilla, g.forma_aciculas, g.bractea_foliar
      FROM especimenes e
      LEFT JOIN gimnospermas_detalle g ON e.id = g.especimen_id
      WHERE e.tipo LIKE '%Gimno%'
      ORDER BY CAST(e.numero_registro AS UNSIGNED) ASC, e.numero_registro ASC
    `);

    const angioData = angios.map(r => Object.assign({
      'CODIGO': r.numero_registro || '',
      'FAMILIA': r.familia || '',
      'NOMBRE CIENTÍFICO': r.nombre_cientifico || '',
      'NOMBRE COMÚN': r.nombre_comun || '',
      'DISTRIBUCIÓN': r.distribucion || '',
      'HOJAS': r.hojas || '',
      'FILOTAXIA': r.filotaxia || '',
      'FLORES': r.flor || '',
      'FRUTO': r.fruto || '',
      'SEXUALIDAD': r.sexualidad || '',
      'OTRAS CARACTERÍSTICAS': r.otras_caracteristicas || ''
    }, extrasPorEspecimen[r.id] || {}));

    const gimnoData = gimnos.map(r => Object.assign({
      'CODIGO': r.numero_registro || '',
      'FAMILIA': r.familia || '',
      'NOMBRE CIENTÍFICO': r.nombre_cientifico || '',
      'NOMBRE COMÚN': r.nombre_comun || '',
      'DISTRIBUCIÓN NATURAL EN MÉXICO': r.distribucion || '',
      'ALTITUD': r.altitud || '',
      'SUBGÉNERO': r.subgenero || '',
      'SECCIÓN': r.seccion || '',
      'CONO': r.cono || '',
      'UMBO': r.umbo || '',
      'TIPO DE SEMILLA': r.tipo_semilla || '',
      'ACÍCULAS': r.forma_aciculas || '',
      'BRACTEA FOLIAR': r.bractea_foliar || '',
      'OTRAS CARACTERÍSTICAS': r.otras_caracteristicas || ''
    }, extrasPorEspecimen[r.id] || {}));

    const libro = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(libro, xlsx.utils.json_to_sheet(angioData), 'ANGIOSPERMAS');
    xlsx.utils.book_append_sheet(libro, xlsx.utils.json_to_sheet(gimnoData), 'GIMNOSBD');

    const buffer = xlsx.write(libro, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename="Herbario_DICIFO_Catalogo.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    return res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: 'No se pudo generar el archivo Excel' });
  }
});

router.get('/', requireAuth, async (req, res) => {
  const { q, tipo, familia, numero_registro, CODIGO, page = 1, limit = 20 } = req.query;
  const codigoBuscado = numero_registro || CODIGO;

  let sql = 'SELECT id, numero_registro, tipo, familia, nombre_cientifico, nombre_comun FROM especimenes WHERE 1=1';
  let countSql = 'SELECT COUNT(*) as total FROM especimenes WHERE 1=1';
  const params = [];
  const countParams = [];

  const aplicarFiltros = (baseQuery, targetParams) => {
    let qStr = baseQuery;
    if (codigoBuscado) {
      const regLimpio = String(codigoBuscado).replace(/[* \r\n\t]/g, '').trim();
      qStr += ' AND (TRIM(numero_registro) = ? OR numero_registro LIKE ?)';
      targetParams.push(regLimpio, `%${regLimpio}%`);
    }
    if (tipo) {
      qStr += ' AND tipo LIKE ?';
      targetParams.push(`%${tipo.trim()}%`);
    }
    if (familia) {
      qStr += ' AND familia LIKE ?';
      targetParams.push(`%${familia.trim()}%`);
    }
    if (q) {
      const qLimpio = q.trim();
      qStr += ' AND (nombre_cientifico LIKE ? OR nombre_comun LIKE ? OR familia LIKE ? OR numero_registro LIKE ?)';
      targetParams.push(`%${qLimpio}%`, `%${qLimpio}%`, `%${qLimpio}%`, `%${qLimpio}%`);
    }
    return qStr;
  };

  const finalCountSql = aplicarFiltros(countSql, countParams);
  sql = aplicarFiltros(sql, params);

  sql += ' ORDER BY CAST(numero_registro AS UNSIGNED) ASC, familia ASC LIMIT ? OFFSET ?';
  const limitNum = parseInt(limit, 10) || 20;
  const offsetNum = (parseInt(page, 10) - 1) * limitNum;
  params.push(limitNum, offsetNum);

  try {
    const [[{ total }]] = await pool.query(finalCountSql, countParams);
    const [rows] = await pool.query(sql, params);
    res.json({ datos: rows, total, paginaActual: parseInt(page, 10), porPagina: limitNum });
  } catch (err) {
    res.status(500).json({ error: 'Error al consultar especímenes' });
  }
});

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const especimen = await getEspecimenCompleto(req.params.id);
    if (!especimen) return res.status(404).json({ error: 'No encontrado' });
    res.json(especimen);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener el espécimen' });
  }
});

router.post('/', requireAuth, requireAdmin, async (req, res) => {
  const { numero_registro, CODIGO, tipo, familia, nombre_cientifico, nombre_comun, distribucion, otras_caracteristicas, detalle, campos_personalizados } = req.body;
  const codigoFinal = numero_registro || CODIGO;

  if (!codigoFinal || !tipo) return res.status(400).json({ error: 'El código y el tipo son obligatorios' });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [result] = await conn.query(
      `INSERT INTO especimenes (numero_registro, tipo, familia, nombre_cientifico, nombre_comun, distribucion, otras_caracteristicas, creado_por) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [codigoFinal.trim(), tipo, familia, nombre_cientifico, nombre_comun, distribucion, otras_caracteristicas, req.user.id]
    );
    const especimenId = result.insertId;
    const tipoNorm = (tipo || '').toLowerCase();

    if (tipoNorm.includes('angio') && detalle) {
      await conn.query(`INSERT INTO angiospermas_detalle (especimen_id, hojas, filotaxia, flor, fruto, sexualidad) VALUES (?, ?, ?, ?, ?, ?)`,
        [especimenId, detalle.hojas || null, detalle.filotaxia || null, detalle.flor || null, detalle.fruto || null, detalle.sexualidad || null]);
    } else if (tipoNorm.includes('gimno') && detalle) {
      await conn.query(`INSERT INTO gimnospermas_detalle (especimen_id, subgenero, seccion, cono, umbo, tipo_semilla, forma_aciculas, bractea_foliar, altitud) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [especimenId, detalle.subgenero || null, detalle.seccion || null, detalle.cono || null, detalle.umbo || null, detalle.tipo_semilla || null, detalle.forma_aciculas || null, detalle.bractea_foliar || null, detalle.altitud || null]);
    }

    await conn.commit();
    res.status(201).json(await getEspecimenCompleto(especimenId));
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: 'Error al crear el espécimen' });
  } finally {
    conn.release();
  }
});

router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { familia, nombre_cientifico, nombre_comun, distribucion, otras_caracteristicas, detalle } = req.body;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(`UPDATE especimenes SET familia=?, nombre_cientifico=?, nombre_comun=?, distribucion=?, otras_caracteristicas=? WHERE id=?`,
      [familia, nombre_cientifico, nombre_comun, distribucion, otras_caracteristicas, id]);
    await conn.commit();
    res.json(await getEspecimenCompleto(id));
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: 'Error al actualizar el espécimen' });
  } finally {
    conn.release();
  }
});

router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM especimenes WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'No encontrado' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar el espécimen' });
  }
});

// ------------------------------------------------------------
// POST /api/especimenes/importar -> Import Excel leyendo CODIGO sin registrar clave extra
// ------------------------------------------------------------
router.post('/importar', requireAuth, requireAdmin, uploadExcel.single('documento'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se subió ningún archivo' });

  try {
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    let creados = 0;
    let actualizados = 0;
    const conn = await pool.getConnection();

    const normalizarFila = (fila) => {
      const filaLimpia = {};
      for (let clave in fila) {
        const claveLimpia = clave
          .normalize('NFD').replace(/[\u0300-\u036f]/g, "")
          .replace(/[\r\n\-]/g, '')
          .replace(/\s+/g, ' ')
          .trim()
          .toUpperCase();
        filaLimpia[claveLimpia] = fila[clave];
      }
      return filaLimpia;
    };

    try {
      for (const nombreHoja of workbook.SheetNames) {
        const hojaUpper = nombreHoja.trim().toUpperCase();
        
        let tipo = null;
        if (hojaUpper === 'GIMNOSBD' || hojaUpper === 'PINOS') {
          tipo = 'Gimnosperma';
        } else if (hojaUpper.startsWith('ANGIO')) {
          tipo = 'Angiosperma';
        }

        if (!tipo) continue;

        const datosExcel = xlsx.utils.sheet_to_json(workbook.Sheets[nombreHoja]);

        for (const filaCruda of datosExcel) {
          const fila = normalizarFila(filaCruda);
          
          // Tomamos únicamente el valor de la columna CODIGO (o REGISTRO) como el código oficial
          const codigoExcel = String(fila['CODIGO'] || fila['REGISTRO'] || '').trim();
          if (!codigoExcel) continue; 

          const familia = fila['FAMILIA'] || '';
          const especie = fila['NOMBRE CIENTIFICO'] || '';
          const nombre_comun = fila['NOMBRE COMUN'] || '';
          const otras_caracteristicas = fila['OTRAS CARACTERISTICAS'] || '';
          const distribucion = fila['DISTRIBUCION'] || fila['DISTRIBUCION NATURAL EN MEXICO'] || '';

          const [rowsExiste] = await conn.query(
            `SELECT id FROM especimenes 
             WHERE TRIM(numero_registro) = ? AND ? != ''`,
            [codigoExcel, codigoExcel]
          );
          
          const subgenero = fila['SUBGENERO'] || null;
          const seccion = fila['SECCION'] || null;
          const cono = fila['CONO'] || null;
          const umbo = fila['UMBO'] || null;
          const tipo_semilla = fila['SEMILLA'] || fila['TIPO DE SEMILLA'] || null;
          const forma_aciculas = fila['ACICULAS'] || fila['HOJAS'] || fila['FORMA DE LAS ACICULAS'] || null;
          const bractea_foliar = fila['BRACTEA FOLIAR'] || null;
          const altitud = fila['ALTITUD'] || null;

          const hojas_angio = fila['HOJAS'] || null;
          const filotaxia = fila['FILOTAXIA'] || null;
          const flor = fila['FLORES'] || fila['FLOR'] || null;
          const fruto = fila['FRUTO'] || null;
          const sexualidad = fila['SEXUALIDAD'] || null;

          let especimenId;

          if (rowsExiste.length === 0) {
            const [result] = await conn.query(
              `INSERT INTO especimenes (numero_registro, tipo, familia, nombre_cientifico, nombre_comun, distribucion, otras_caracteristicas, creado_por) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [codigoExcel, tipo, familia, especie, nombre_comun, distribucion, otras_caracteristicas, req.user.id]
            );
            especimenId = result.insertId;

            if (tipo === 'Angiosperma') {
              await conn.query(
                `INSERT INTO angiospermas_detalle (especimen_id, hojas, filotaxia, flor, fruto, sexualidad) VALUES (?, ?, ?, ?, ?, ?)`,
                [especimenId, hojas_angio, filotaxia, flor, fruto, sexualidad]
              );
            } else {
              await conn.query(
                `INSERT INTO gimnospermas_detalle 
                 (especimen_id, subgenero, seccion, cono, umbo, tipo_semilla, forma_aciculas, bractea_foliar, altitud) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [especimenId, subgenero, seccion, cono, umbo, tipo_semilla, forma_aciculas, bractea_foliar, altitud]
              );
            }
            creados++;
          } else {
            especimenId = rowsExiste[0].id;

            await conn.query(
              `UPDATE especimenes 
               SET numero_registro = ?, tipo = ?, familia = ?, nombre_cientifico = ?, nombre_comun = ?, distribucion = ?, otras_caracteristicas = ?
               WHERE id = ?`,
              [codigoExcel, tipo, familia, especie, nombre_comun, distribucion, otras_caracteristicas, especimenId]
            );

            if (tipo === 'Angiosperma') {
              await conn.query(
                `UPDATE angiospermas_detalle 
                 SET hojas = ?, filotaxia = ?, flor = ?, fruto = ?, sexualidad = ?
                 WHERE especimen_id = ?`,
                [hojas_angio, filotaxia, flor, fruto, sexualidad, especimenId]
              );
            } else {
              await conn.query(
                `UPDATE gimnospermas_detalle 
                 SET subgenero = ?, seccion = ?, cono = ?, umbo = ?, tipo_semilla = ?, forma_aciculas = ?, bractea_foliar = ?, altitud = ?
                 WHERE especimen_id = ?`,
                [subgenero, seccion, cono, umbo, tipo_semilla, forma_aciculas, bractea_foliar, altitud, especimenId]
              );
            }
            actualizados++;
          }
        }
      }
      res.json({ mensaje: `Procesamiento completado: ${creados} nuevos, ${actualizados} actualizados correctamente.` });
    } finally {
      conn.release();
    }
  } catch (err) {
    res.status(500).json({ error: `Error técnico: ${err.message}` });
  }
});

module.exports = router;