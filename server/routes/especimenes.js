const express = require('express');
const router = express.Router();
const pool = require('../db');
const { requireAuth, requireAdmin } = require('./auth');
const multer = require('multer');
const xlsx = require('xlsx');

const uploadExcel = multer({ storage: multer.memoryStorage() });

// Helper: builds the complete specimen object (general + detail + images + custom fields)
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

// ------------------------------------------------------------
// GET /api/especimenes/campos-unicos -> Nombres de atributos universales por tipo
// ------------------------------------------------------------
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
    const nombres = rows.map(r => r.nombre_campo);
    res.json(nombres);
  } catch (err) {
    console.error('Error al obtener campos universales:', err);
    res.status(500).json({ error: 'Error al obtener campos universales' });
  }
});

// ------------------------------------------------------------
// GET /api/especimenes/exportar/excel -> Exportar catálogo en dos hojas con campos extra
// ------------------------------------------------------------
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
      SELECT 
        e.id,
        e.numero_registro,
        e.familia,
        e.nombre_cientifico,
        e.nombre_comun,
        e.distribucion,
        e.otras_caracteristicas,
        a.hojas,
        a.filotaxia,
        a.flor,
        a.fruto,
        a.sexualidad
      FROM especimenes e
      LEFT JOIN angiospermas_detalle a ON e.id = a.especimen_id
      WHERE e.tipo LIKE '%Angio%'
      ORDER BY CAST(e.numero_registro AS UNSIGNED) ASC, e.numero_registro ASC
    `);

    const [gimnos] = await pool.query(`
      SELECT 
        e.id,
        e.numero_registro,
        e.familia,
        e.nombre_cientifico,
        e.nombre_comun,
        e.distribucion,
        e.otras_caracteristicas,
        g.altitud,
        g.subgenero,
        g.seccion,
        g.cono,
        g.longitud_cono,
        g.color_cono,
        g.umbo,
        g.largo_pedunculo,
        g.tipo_semilla,
        g.forma_aciculas,
        g.numero_aciculas,
        g.longitud_aciculas,
        g.vaina,
        g.bractea_foliar
      FROM especimenes e
      LEFT JOIN gimnospermas_detalle g ON e.id = g.especimen_id
      WHERE e.tipo LIKE '%Gimno%'
      ORDER BY CAST(e.numero_registro AS UNSIGNED) ASC, e.numero_registro ASC
    `);

    const angioData = angios.map(r => {
      const filaBase = {
        'CLAVE': r.numero_registro || '',
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
      };
      return Object.assign(filaBase, extrasPorEspecimen[r.id] || {});
    });

    const gimnoData = gimnos.map(r => {
      const filaBase = {
        'CLAVE': r.numero_registro || '',
        'FAMILIA': r.familia || '',
        'NOMBRE CIENTÍFICO': r.nombre_cientifico || '',
        'NOMBRE COMÚN': r.nombre_comun || '',
        'DISTRIBUCIÓN NATURAL EN MÉXICO': r.distribucion || '',
        'ALTITUD': r.altitud || '',
        'SUBGÉNERO': r.subgenero || '',
        'SECCIÓN': r.seccion || '',
        'CONO': r.cono || '',
        'LONGITUD DEL CONO': r.longitud_cono || '',
        'COLOR DE CONO': r.color_cono || '',
        'UMBO': r.umbo || '',
        'LARGO DE PEDÚNCULO': r.largo_pedunculo || '',
        'TIPO DE SEMILLA': r.tipo_semilla || '',
        'FORMA DE LAS ACÍCULAS': r.forma_aciculas || '',
        'NÚMERO DE ACÍCULAS': r.numero_aciculas || '',
        'LONGITUD DE ACÍCULAS': r.longitud_aciculas || '',
        'VAINA': r.vaina || '',
        'BRACTEA FOLIAR': r.bractea_foliar || '',
        'OTRAS CARACTERÍSTICAS': r.otras_caracteristicas || ''
      };
      return Object.assign(filaBase, extrasPorEspecimen[r.id] || {});
    });

    const libro = xlsx.utils.book_new();

    const hojaAngio = xlsx.utils.json_to_sheet(angioData.length > 0 ? angioData : [{ 'AVISO': 'Sin registros' }]);
    xlsx.utils.book_append_sheet(libro, hojaAngio, 'ANGIOSPERMAS');

    const hojaGimno = xlsx.utils.json_to_sheet(gimnoData.length > 0 ? gimnoData : [{ 'AVISO': 'Sin registros' }]);
    xlsx.utils.book_append_sheet(libro, hojaGimno, 'GIMNOSBD');

    const buffer = xlsx.write(libro, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', 'attachment; filename="Herbario_DICIFO_Catalogo.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    return res.send(buffer);
  } catch (err) {
    console.error('Error al exportar catálogo a Excel:', err);
    return res.status(500).json({ error: 'No se pudo generar el archivo Excel' });
  }
});

// ------------------------------------------------------------
// GET /api/especimenes -> list / search (Flexible y compatible con ambas clases)
// ------------------------------------------------------------
router.get('/', requireAuth, async (req, res) => {
  const { q, tipo, familia, numero_registro } = req.query;
  let sql = 'SELECT id, numero_registro, tipo, familia, nombre_cientifico, nombre_comun FROM especimenes WHERE 1=1';
  const params = [];

  if (numero_registro) {
    const regLimpio = String(numero_registro).replace(/[* \r\n\t]/g, '').trim();
    sql += ' AND (TRIM(numero_registro) = ? OR numero_registro LIKE ?)';
    params.push(regLimpio, `%${regLimpio}%`);
  }
  if (tipo) {
    sql += ' AND tipo LIKE ?';
    params.push(`%${tipo.trim()}%`);
  }
  if (familia) {
    sql += ' AND familia LIKE ?';
    params.push(`%${familia.trim()}%`);
  }
  if (q) {
    const qLimpio = q.trim();
    sql += ' AND (nombre_cientifico LIKE ? OR nombre_comun LIKE ? OR familia LIKE ? OR numero_registro LIKE ?)';
    params.push(`%${qLimpio}%`, `%${qLimpio}%`, `%${qLimpio}%`, `%${qLimpio}%`);
  }

  sql += ' ORDER BY CAST(numero_registro AS UNSIGNED) ASC, familia ASC';

  try {
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error('Error al consultar especímenes:', err);
    res.status(500).json({ error: 'Error al consultar especímenes' });
  }
});

// GET /api/especimenes/:id -> complete detail
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const especimen = await getEspecimenCompleto(req.params.id);
    if (!especimen) return res.status(404).json({ error: 'No encontrado' });
    res.json(especimen);
  } catch (err) {
    console.error('Error al obtener el espécimen:', err);
    res.status(500).json({ error: 'Error al obtener el espécimen' });
  }
});

// ------------------------------------------------------------
// POST /api/especimenes -> create
// ------------------------------------------------------------
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  const {
    numero_registro, tipo, familia,
    nombre_cientifico, nombre_comun, distribucion,
    otras_caracteristicas, detalle, campos_personalizados
  } = req.body;

  if (!numero_registro || !tipo) {
    return res.status(400).json({ error: 'numero_registro y tipo son obligatorios' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [result] = await conn.query(
      `INSERT INTO especimenes
       (numero_registro, tipo, familia, nombre_cientifico, nombre_comun, distribucion, otras_caracteristicas, creado_por)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [numero_registro.trim(), tipo, familia, nombre_cientifico, nombre_comun, distribucion, otras_caracteristicas, req.user.id]
    );

    const especimenId = result.insertId;
    const tipoNorm = (tipo || '').toLowerCase();

    if (tipoNorm.includes('angio') && detalle) {
      await conn.query(
        `INSERT INTO angiospermas_detalle (especimen_id, hojas, filotaxia, flor, fruto, sexualidad)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [especimenId, detalle.hojas || null, detalle.filotaxia || null, detalle.flor || null, detalle.fruto || null, detalle.sexualidad || null]
      );
    } else if (tipoNorm.includes('gimno') && detalle) {
      await conn.query(
        `INSERT INTO gimnospermas_detalle
         (especimen_id, subgenero, seccion, cono, longitud_cono, color_cono, umbo, largo_pedunculo,
          tipo_semilla, forma_aciculas, numero_aciculas, longitud_aciculas, vaina, bractea_foliar, altitud)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [especimenId, detalle.subgenero || null, detalle.seccion || null, detalle.cono || null,
         detalle.longitud_cono || null, detalle.color_cono || null, detalle.umbo || null,
         detalle.largo_pedunculo || null, detalle.tipo_semilla || null, detalle.forma_aciculas || null,
         detalle.numero_aciculas || null, detalle.longitud_aciculas || null, detalle.vaina || null,
         detalle.bractea_foliar || null, detalle.altitud || null]
      );
    }

    // --- SAVE CUSTOM FIELDS ---
    if (Array.isArray(campos_personalizados)) {
      for (const item of campos_personalizados) {
        if (item.nombre_campo && item.valor) {
          let [campoRow] = await conn.query('SELECT id FROM campos_personalizados WHERE nombre_campo = ?', [item.nombre_campo.trim()]);
          let campoId;
          
          if (campoRow.length === 0) {
            const [nuevoCampo] = await conn.query('INSERT INTO campos_personalizados (nombre_campo) VALUES (?)', [item.nombre_campo.trim()]);
            campoId = nuevoCampo.insertId;
          } else {
            campoId = campoRow[0].id;
          }

          await conn.query(
            'INSERT INTO valores_personalizados (especimen_id, campo_id, valor) VALUES (?, ?, ?)',
            [especimenId, campoId, item.valor.trim()]
          );
        }
      }
    }

    await conn.commit();
    const completo = await getEspecimenCompleto(especimenId);
    res.status(201).json(completo);
  } catch (err) {
    await conn.rollback();
    console.error(err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Ya existe un ejemplar con ese número de registro' });
    }
    res.status(500).json({ error: 'Error al crear el espécimen' });
  } finally {
    conn.release();
  }
});

// ------------------------------------------------------------
// PUT /api/especimenes/:id -> update
// ------------------------------------------------------------
router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const {
    familia, nombre_cientifico, nombre_comun,
    distribucion, otras_caracteristicas, detalle, campos_personalizados
  } = req.body;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [[existing]] = await conn.query('SELECT tipo FROM especimenes WHERE id = ?', [id]);
    if (!existing) {
      await conn.rollback();
      return res.status(404).json({ error: 'No encontrado' });
    }

    await conn.query(
      `UPDATE especimenes SET familia=?, nombre_cientifico=?, nombre_comun=?,
       distribucion=?, otras_caracteristicas=? WHERE id=?`,
      [familia, nombre_cientifico, nombre_comun, distribucion, otras_caracteristicas, id]
    );

    if (detalle) {
      const tipoExistente = (existing.tipo || '').toLowerCase();
      if (tipoExistente.includes('angio')) {
        await conn.query(
          `UPDATE angiospermas_detalle SET hojas=?, filotaxia=?, flor=?, fruto=?, sexualidad=? WHERE especimen_id=?`,
          [detalle.hojas || null, detalle.filotaxia || null, detalle.flor || null, detalle.fruto || null, detalle.sexualidad || null, id]
        );
      } else {
        await conn.query(
          `UPDATE gimnospermas_detalle SET subgenero=?, seccion=?, cono=?, longitud_cono=?, color_cono=?,
           umbo=?, largo_pedunculo=?, tipo_semilla=?, forma_aciculas=?, numero_aciculas=?,
           longitud_aciculas=?, vaina=?, bractea_foliar=?, altitud=? WHERE especimen_id=?`,
          [detalle.subgenero || null, detalle.seccion || null, detalle.cono || null, detalle.longitud_cono || null,
           detalle.color_cono || null, detalle.umbo || null, detalle.largo_pedunculo || null,
           detalle.tipo_semilla || null, detalle.forma_aciculas || null, detalle.numero_aciculas || null,
           detalle.longitud_aciculas || null, detalle.vaina || null, detalle.bractea_foliar || null,
           detalle.altitud || null, id]
        );
      }
    }

    // --- UPDATE CUSTOM FIELDS ---
    await conn.query('DELETE FROM valores_personalizados WHERE especimen_id = ?', [id]);

    if (Array.isArray(campos_personalizados)) {
      for (const item of campos_personalizados) {
        if (item.nombre_campo && item.valor) {
          let [campoRow] = await conn.query('SELECT id FROM campos_personalizados WHERE nombre_campo = ?', [item.nombre_campo.trim()]);
          let campoId;
          
          if (campoRow.length === 0) {
            const [nuevoCampo] = await conn.query('INSERT INTO campos_personalizados (nombre_campo) VALUES (?)', [item.nombre_campo.trim()]);
            campoId = nuevoCampo.insertId;
          } else {
            campoId = campoRow[0].id;
          }

          await conn.query(
            'INSERT INTO valores_personalizados (especimen_id, campo_id, valor) VALUES (?, ?, ?)',
            [id, campoId, item.valor.trim()]
          );
        }
      }
    }

    await conn.commit();
    const completo = await getEspecimenCompleto(id);
    res.json(completo);
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar el espécimen' });
  } finally {
    conn.release();
  }
});

// DELETE /api/especimenes/:id -> delete
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM especimenes WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'No encontrado' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar el espécimen' });
  }
});

// ------------------------------------------------------------
// POST /api/especimenes/importar -> Import Excel
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
        const claveLimpia = clave.replace(/[\r\n\-]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();
        filaLimpia[claveLimpia] = fila[clave];
      }
      return filaLimpia;
    };

    try {
      for (const nombreHoja of workbook.SheetNames) {
        const hojaUpper = nombreHoja.trim().toUpperCase();
        
        let tipo = null;
        if (hojaUpper === 'GIMNOSBD') {
          tipo = 'Gimnosperma';
        } else if (hojaUpper.startsWith('ANGIO')) {
          tipo = 'Angiosperma';
        }

        if (!tipo) continue;

        const datosExcel = xlsx.utils.sheet_to_json(workbook.Sheets[nombreHoja]);

        for (const filaCruda of datosExcel) {
          const fila = normalizarFila(filaCruda);
          
          const numero_registro = String(fila['CLAVE'] || '').trim();
          if (!numero_registro) continue; 

          const familia = fila['FAMILIA'] || '';
          const especie = fila['NOMBRE CIENTÍFICO'] || '';
          const nombre_comun = fila['NOMBRE COMÚN'] || '';
          const otras_caracteristicas = fila['OTRAS CARACTERÍSTICAS'] || '';
          
          const distribucion = tipo === 'Angiosperma' 
            ? (fila['DISTRIBUCIÓN'] || '') 
            : (fila['DISTRIBUCIÓN NATURAL EN MÉXICO'] || '');

          const [[existe]] = await conn.query('SELECT id FROM especimenes WHERE TRIM(numero_registro) = ?', [numero_registro]);
          
          if (!existe) {
            const [result] = await conn.query(
              `INSERT INTO especimenes (numero_registro, tipo, familia, nombre_cientifico, nombre_comun, distribucion, otras_caracteristicas, creado_por) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [numero_registro, tipo, familia, especie, nombre_comun, distribucion, otras_caracteristicas, req.user.id]
            );
            const especimenId = result.insertId;

            if (tipo === 'Angiosperma') {
              await conn.query(
                `INSERT INTO angiospermas_detalle (especimen_id, hojas, filotaxia, flor, fruto, sexualidad) VALUES (?, ?, ?, ?, ?, ?)`,
                [especimenId, fila['HOJAS'] || null, fila['FILOTAXIA'] || null, fila['FLORES'] || null, fila['FRUTO'] || null, fila['SEXUALIDAD'] || null]
              );
            } else {
              await conn.query(
                `INSERT INTO gimnospermas_detalle 
                 (especimen_id, subgenero, seccion, cono, longitud_cono, color_cono, umbo, largo_pedunculo, tipo_semilla, forma_aciculas, numero_aciculas, longitud_aciculas, vaina, bractea_foliar, altitud) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  especimenId, fila['SUBGÉNERO'] || null, fila['SECCIÓN'] || null, fila['CONO'] || null, 
                  fila['LONGITUD DEL CONO'] || null, fila['COLOR DE CONO'] || null, fila['UMBO'] || null, 
                  fila['LARGO DE PEDÚNCULO'] || null, fila['TIPO DE SEMILLA'] || null, fila['FORMA DE LAS ACÍCULAS'] || null, 
                  fila['NÚMERO DE ACÍCULAS'] || null, fila['LONGITUD DE ACÍCULAS'] || null, fila['VAINA'] || null, 
                  fila['BRACTEA FOLIAR'] || null, fila['ALTITUD'] || null
                ]
              );
            }
            creados++;
          } else {
            const especimenId = existe.id;

            await conn.query(
              `UPDATE especimenes 
               SET tipo = ?, familia = ?, nombre_cientifico = ?, nombre_comun = ?, distribucion = ?, otras_caracteristicas = ?
               WHERE id = ?`,
              [tipo, familia, especie, nombre_comun, distribucion, otras_caracteristicas, especimenId]
            );

            if (tipo === 'Angiosperma') {
              await conn.query(
                `UPDATE angiospermas_detalle 
                 SET hojas = ?, filotaxia = ?, flor = ?, fruto = ?, sexualidad = ?
                 WHERE especimen_id = ?`,
                [fila['HOJAS'] || null, fila['FILOTAXIA'] || null, fila['FLORES'] || null, fila['FRUTO'] || null, fila['SEXUALIDAD'] || null, especimenId]
              );
            } else {
              await conn.query(
                `UPDATE gimnospermas_detalle 
                 SET subgenero = ?, seccion = ?, cono = ?, longitud_cono = ?, color_cono = ?, umbo = ?, largo_pedunculo = ?, tipo_semilla = ?, forma_aciculas = ?, numero_aciculas = ?, longitud_aciculas = ?, vaina = ?, bractea_foliar = ?, altitud = ?
                 WHERE especimen_id = ?`,
                [
                  fila['SUBGÉNERO'] || null, fila['SECCIÓN'] || null, fila['CONO'] || null, 
                  fila['LONGITUD DEL CONO'] || null, fila['COLOR DE CONO'] || null, fila['UMBO'] || null, 
                  fila['LARGO DE PEDÚNCULO'] || null, fila['TIPO DE SEMILLA'] || null, fila['FORMA DE LAS ACÍCULAS'] || null, 
                  fila['NÚMERO DE ACÍCULAS'] || null, fila['LONGITUD DE ACÍCULAS'] || null, fila['VAINA'] || null, 
                  fila['BRACTEA FOLIAR'] || null, fila['ALTITUD'] || null,
                  especimenId
                ]
              );
            }
            actualizados++;
          }
        }
      }
      res.json({ mensaje: `Procesamiento completado: ${creados} ejemplares nuevos agregados, ${actualizados} actualizados.` });
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error('Error al procesar Excel:', err);
    res.status(500).json({ error: 'Error al leer el archivo Excel. Verifica el formato.' });
  }
});

module.exports = router;