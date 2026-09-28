const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const pool = require('../db');
const { requireAuth, requireAdmin } = require('./auth');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '..', '..', 'uploads')),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /jpeg|jpg|png|webp/.test(file.mimetype);
    cb(ok ? null : new Error('Solo se permiten imágenes JPG, PNG o WEBP'), ok);
  }
});

// CORRECCIÓN AQUÍ: Cambié '/imagenes/:especimenId' por '/:especimenId'
router.post('/:especimenId', upload.single('imagen'), async (req, res) => {
  try {
    const { especimenId } = req.params;
    const { campo } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'No se envió ninguna imagen.' });
    }

    const uploadDir = path.join(__dirname, '..', '..', 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filename = `specimen-${especimenId}-${campo || 'general'}-${Date.now()}.webp`;
    const outputPath = path.join(uploadDir, filename);

    await sharp(req.file.buffer)
      .rotate()
      .resize({
        width: 1400,
        height: 1400,
        fit: 'inside',
        withoutEnlargement: true
      })
      .webp({ quality: 80 })
      .toFile(outputPath);

    const [result] = await pool.query(
      'INSERT INTO imagenes (especimen_id, campo, ruta_archivo) VALUES (?, ?, ?)',
      [especimenId, campo || 'general', filename]
    );

    res.status(201).json({
      id: result.insertId,
      especimen_id: especimenId,
      campo: campo || 'general',
      ruta_archivo: filename
    });

  } catch (error) {
    console.error('Error al procesar y comprimir imagen:', error);
    res.status(500).json({ error: 'No se pudo optimizar ni guardar la imagen.' });
  }
});

router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM imagenes WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'No encontrada' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar la imagen' });
  }
});

module.exports = router;