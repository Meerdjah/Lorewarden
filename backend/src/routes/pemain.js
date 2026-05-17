const express = require('express');
const router = express.Router();
const db = require('../config/db');
const redis = require('../config/redis');

const CACHE_KEY_LIST = 'lorewarden:cache:pemain:list';
const CACHE_TTL = 300; // 5 minutes

async function invalidateCache() {
  const keys = await redis.keys('lorewarden:cache:pemain:*');
  if (keys.length) await redis.del(...keys);
}

// GET all pemain with total karakter count
router.get('/', async (req, res) => {
  try {
    const cached = await redis.get(CACHE_KEY_LIST);
    if (cached) {
      console.log('[Cache HIT] pemain list');
      return res.json({ success: true, data: JSON.parse(cached) });
    }

    console.log('[Cache MISS] pemain list');
    const result = await db.query(`
      SELECT p.*, COUNT(k.id)::int AS total_karakter
      FROM pemain p
      LEFT JOIN karakter k ON p.id = k.pemain_id
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `);
    await redis.set(CACHE_KEY_LIST, JSON.stringify(result.rows), 'EX', CACHE_TTL);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET pemain by id
router.get('/:id', async (req, res) => {
  try {
    const cacheKey = `lorewarden:cache:pemain:${req.params.id}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      console.log(`[Cache HIT] pemain:${req.params.id}`);
      return res.json({ success: true, data: JSON.parse(cached) });
    }

    console.log(`[Cache MISS] pemain:${req.params.id}`);
    const result = await db.query(`
      SELECT p.*, COUNT(k.id)::int AS total_karakter
      FROM pemain p
      LEFT JOIN karakter k ON p.id = k.pemain_id
      WHERE p.id = $1
      GROUP BY p.id
    `, [req.params.id]);

    if (!result.rows.length)
      return res.status(404).json({ success: false, error: 'Pemain tidak ditemukan' });

    await redis.set(cacheKey, JSON.stringify(result.rows[0]), 'EX', CACHE_TTL);
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST create pemain
router.post('/', async (req, res) => {
  try {
    const { username, discord_id } = req.body;
    if (!username)
      return res.status(400).json({ success: false, error: 'Username wajib diisi' });

    const result = await db.query(
      'INSERT INTO pemain (username, discord_id) VALUES ($1, $2) RETURNING *',
      [username.trim(), discord_id?.trim() || null]
    );
    await invalidateCache();
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    if (err.code === '23505')
      return res.status(400).json({ success: false, error: 'Username atau Discord ID sudah digunakan' });
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT update pemain
router.put('/:id', async (req, res) => {
  try {
    const { username, discord_id } = req.body;
    if (!username)
      return res.status(400).json({ success: false, error: 'Username wajib diisi' });

    const result = await db.query(
      'UPDATE pemain SET username = $1, discord_id = $2 WHERE id = $3 RETURNING *',
      [username.trim(), discord_id?.trim() || null, req.params.id]
    );
    if (!result.rows.length)
      return res.status(404).json({ success: false, error: 'Pemain tidak ditemukan' });

    await invalidateCache();
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    if (err.code === '23505')
      return res.status(400).json({ success: false, error: 'Username atau Discord ID sudah digunakan' });
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE pemain
router.delete('/:id', async (req, res) => {
  try {
    const result = await db.query('DELETE FROM pemain WHERE id = $1 RETURNING *', [req.params.id]);
    if (!result.rows.length)
      return res.status(404).json({ success: false, error: 'Pemain tidak ditemukan' });

    await invalidateCache();
    res.json({ success: true, message: 'Pemain berhasil dihapus' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
