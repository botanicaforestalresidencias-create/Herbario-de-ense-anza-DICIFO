const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const pool = require('../db');
const { requireAuth, requireAdmin } = require('./auth');

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Lista blanca actualizada: se quita 'aciculas' y se agrega 'arbol'
const CAMPOS_VALIDOS = new Set([
  'general', 'hojas', 'flor', 'fruto', 'sexualidad',
  'cono', 'semilla', 'arbol', 'distribucion'
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /jpeg|jpg|png|webp/.test(file.mimetype);
    cb(ok ? null : new Error('Solo se permiten imágenes JPG, PNG o WEBP'), ok);
  }
});

// POST /api/imagenes/:especimenId -> subir imagen (solo admin autenticado)
router.post(
  '/:especimenId',
  requireAuth,
  requireAdmin,
  upload.single('imagen'),
  async (req, res) => {
    try {
      const especimenId = parseInt(req.params.especimenId, 10);
      if (!Number.isInteger(especimenId)) {
        return res.status(400).json({ error: 'ID de espécimen inválido.' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No se envió ninguna imagen.' });
      }

      const campo = CAMPOS_VALIDOS.has(req.body.campo) ? req.body.campo : 'general';

      const [[existe]] = await pool.query(
        'SELECT id FROM especimenes WHERE id = ?', [especimenId]
      );
      if (!existe) {
        return res.status(404).json({ error: 'Espécimen no encontrado.' });
      }

      const filename = `specimen-${especimenId}-${campo}-${Date.now()}.webp`;
      const outputPath = path.join(UPLOAD_DIR, filename);

      await sharp(req.file.buffer)
        .rotate()
        .resize({ width: 1400, height: 1400, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toFile(outputPath);

      const [result] = await pool.query(
        'INSERT INTO imagenes (especimen_id, campo, ruta_archivo) VALUES (?, ?, ?)',
        [especimenId, campo, filename]
      );

      res.status(201).json({
        id: result.insertId,
        especimen_id: especimenId,
        campo,
        ruta_archivo: filename
      });
    } catch (error) {
      console.error('Error al procesar y guardar imagen:', error);
      res.status(500).json({ error: 'No se pudo optimizar ni guardar la imagen.' });
    }
  }
);

router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const [[img]] = await pool.query(
      'SELECT ruta_archivo FROM imagenes WHERE id = ?', [req.params.id]
    );
    if (!img) return res.status(404).json({ error: 'No encontrada' });

    await pool.query('DELETE FROM imagenes WHERE id = ?', [req.params.id]);

    const filePath = path.join(UPLOAD_DIR, path.basename(img.ruta_archivo));
    fs.unlink(filePath, (err) => {
      if (err && err.code !== 'ENOENT') console.error('No se pudo borrar el archivo:', err);
    });

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar la imagen' });
  }
});

router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err.message?.startsWith('Solo se permiten')) {
    return res.status(400).json({ error: err.message });
  }
  next(err);
});

module.exports = router;