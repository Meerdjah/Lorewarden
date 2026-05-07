const express = require('express');
const router  = express.Router();
const db      = require('../config/db');

// GET all pemain with total karakter count
router.get('/', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT p.*, COUNT(k.id)::int AS total_karakter
      FROM pemain p
      LEFT JOIN karakter k ON p.id = k.pemain_id
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET pemain by id
router.get('/:id', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT p.*, COUNT(k.id)::int AS total_karakter
      FROM pemain p
      LEFT JOIN karakter k ON p.id = k.pemain_id
      WHERE p.id = $1
      GROUP BY p.id
    `, [req.params.id]);

    if (!result.rows.length)
      return res.status(404).json({ success: false, error: 'Pemain tidak ditemukan' });

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

    res.json({ success: true, message: 'Pemain berhasil dihapus' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
