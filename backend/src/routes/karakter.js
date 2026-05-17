const express = require('express');
const router = express.Router();
const db = require('../config/db');
const redis = require('../config/redis');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const CACHE_TTL = 300; // 5 minutes

async function invalidateCache() {
  const keys = await redis.keys('lorewarden:cache:karakter:*');
  if (keys.length) await redis.del(...keys);
  // Also invalidate pemain cache since it includes character counts
  const pemainKeys = await redis.keys('lorewarden:cache:pemain:*');
  if (pemainKeys.length) await redis.del(...pemainKeys);
}

const UPLOAD_DIR = path.join(__dirname, '../../uploads');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const suffix = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    cb(null, `karakter-${suffix}${path.extname(file.originalname).toLowerCase()}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/\.(jpe?g|png|gif|webp)$/i.test(file.originalname)) cb(null, true);
    else cb(new Error('Hanya file gambar yang diperbolehkan'));
  },
});

// GET all karakter (optionally filter by pemain_id)
router.get('/', async (req, res) => {
  try {
    const { pemain_id } = req.query;
    const cacheKey = `lorewarden:cache:karakter:list:${pemain_id || 'all'}`;

    const cached = await redis.get(cacheKey);
    if (cached) {
      console.log(`[Cache HIT] karakter list (pemain=${pemain_id || 'all'})`);
      return res.json({ success: true, data: JSON.parse(cached) });
    }

    console.log(`[Cache MISS] karakter list (pemain=${pemain_id || 'all'})`);
    const params = [];
    let where = '';
    if (pemain_id) {
      params.push(pemain_id);
      where = 'WHERE k.pemain_id = $1';
    }

    const result = await db.query(`
      SELECT k.*,
             p.username AS pemain_username,
             a.strength, a.dexterity, a.constitution,
             a.intelligence, a.wisdom, a.charisma
      FROM karakter k
      JOIN pemain p ON k.pemain_id = p.id
      LEFT JOIN atribut_stat a ON k.id = a.karakter_id
      ${where}
      ORDER BY k.created_at DESC
    `, params);

    await redis.set(cacheKey, JSON.stringify(result.rows), 'EX', CACHE_TTL);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET karakter by id
router.get('/:id', async (req, res) => {
  try {
    const cacheKey = `lorewarden:cache:karakter:${req.params.id}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      console.log(`[Cache HIT] karakter:${req.params.id}`);
      return res.json({ success: true, data: JSON.parse(cached) });
    }

    console.log(`[Cache MISS] karakter:${req.params.id}`);
    const result = await db.query(`
      SELECT k.*,
             p.username AS pemain_username,
             a.id AS atribut_id,
             a.strength, a.dexterity, a.constitution,
             a.intelligence, a.wisdom, a.charisma
      FROM karakter k
      JOIN pemain p ON k.pemain_id = p.id
      LEFT JOIN atribut_stat a ON k.id = a.karakter_id
      WHERE k.id = $1
    `, [req.params.id]);

    if (!result.rows.length)
      return res.status(404).json({ success: false, error: 'Karakter tidak ditemukan' });

    await redis.set(cacheKey, JSON.stringify(result.rows[0]), 'EX', CACHE_TTL);
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST create karakter
router.post('/', upload.single('gambar'), async (req, res) => {
  try {
    const { pemain_id, nama_karakter, race, class: cls, level, max_hp, background, alignment } = req.body;
    if (!pemain_id || !nama_karakter || !race || !cls)
      return res.status(400).json({ success: false, error: 'pemain_id, nama_karakter, race, dan class wajib diisi' });

    const gambar_url = req.file ? `/uploads/${req.file.filename}` : null;

    const result = await db.query(`
      INSERT INTO karakter (pemain_id, nama_karakter, race, class, level, gambar_url, max_hp, background, alignment)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [pemain_id, nama_karakter, race, cls, level || 1, gambar_url, max_hp || 10, background || null, alignment || null]);

    await invalidateCache();
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT update karakter
router.put('/:id', upload.single('gambar'), async (req, res) => {
  try {
    const existing = await db.query('SELECT * FROM karakter WHERE id = $1', [req.params.id]);
    if (!existing.rows.length)
      return res.status(404).json({ success: false, error: 'Karakter tidak ditemukan' });

    let gambar_url = existing.rows[0].gambar_url;
    if (req.file) {
      if (gambar_url) {
        const oldPath = path.join(__dirname, '../..', gambar_url);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      gambar_url = `/uploads/${req.file.filename}`;
    }

    const { pemain_id, nama_karakter, race, class: cls, level, max_hp, background, alignment } = req.body;

    const result = await db.query(`
      UPDATE karakter SET
        pemain_id     = COALESCE($1, pemain_id),
        nama_karakter = COALESCE($2, nama_karakter),
        race          = COALESCE($3, race),
        class         = COALESCE($4, class),
        level         = COALESCE($5::int, level),
        gambar_url    = $6,
        max_hp        = COALESCE($7::int, max_hp),
        background    = COALESCE($8, background),
        alignment     = COALESCE($9, alignment)
      WHERE id = $10
      RETURNING *
    `, [pemain_id, nama_karakter, race, cls, level, gambar_url, max_hp, background, alignment, req.params.id]);

    await invalidateCache();
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE karakter
router.delete('/:id', async (req, res) => {
  try {
    const existing = await db.query('SELECT * FROM karakter WHERE id = $1', [req.params.id]);
    if (!existing.rows.length)
      return res.status(404).json({ success: false, error: 'Karakter tidak ditemukan' });

    if (existing.rows[0].gambar_url) {
      const imgPath = path.join(__dirname, '../..', existing.rows[0].gambar_url);
      if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
    }

    await db.query('DELETE FROM karakter WHERE id = $1', [req.params.id]);
    await invalidateCache();
    res.json({ success: true, message: 'Karakter berhasil dihapus' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
