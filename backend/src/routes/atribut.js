const express = require('express');
const router  = express.Router();
const db      = require('../config/db');

const mod = (score) => Math.floor((score - 10) / 2);
const fmtMod = (m) => (m >= 0 ? `+${m}` : `${m}`);

function withModifiers(row) {
  return {
    ...row,
    str_mod: mod(row.strength),    str_mod_fmt: fmtMod(mod(row.strength)),
    dex_mod: mod(row.dexterity),   dex_mod_fmt: fmtMod(mod(row.dexterity)),
    con_mod: mod(row.constitution),con_mod_fmt: fmtMod(mod(row.constitution)),
    int_mod: mod(row.intelligence),int_mod_fmt: fmtMod(mod(row.intelligence)),
    wis_mod: mod(row.wisdom),      wis_mod_fmt: fmtMod(mod(row.wisdom)),
    cha_mod: mod(row.charisma),    cha_mod_fmt: fmtMod(mod(row.charisma)),
  };
}

// GET atribut by karakter_id
router.get('/:karakter_id', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM atribut_stat WHERE karakter_id = $1',
      [req.params.karakter_id]
    );
    if (!result.rows.length)
      return res.status(404).json({ success: false, error: 'Atribut tidak ditemukan' });

    res.json({ success: true, data: withModifiers(result.rows[0]) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST create atribut
router.post('/', async (req, res) => {
  try {
    const { karakter_id, strength, dexterity, constitution, intelligence, wisdom, charisma } = req.body;
    if (!karakter_id)
      return res.status(400).json({ success: false, error: 'karakter_id wajib diisi' });

    const result = await db.query(`
      INSERT INTO atribut_stat (karakter_id, strength, dexterity, constitution, intelligence, wisdom, charisma)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [karakter_id, strength||10, dexterity||10, constitution||10, intelligence||10, wisdom||10, charisma||10]);

    res.status(201).json({ success: true, data: withModifiers(result.rows[0]) });
  } catch (err) {
    if (err.code === '23505')
      return res.status(400).json({ success: false, error: 'Atribut untuk karakter ini sudah ada' });
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT update atribut
router.put('/:karakter_id', async (req, res) => {
  try {
    const { strength, dexterity, constitution, intelligence, wisdom, charisma } = req.body;
    const result = await db.query(`
      UPDATE atribut_stat SET
        strength     = COALESCE($1::int, strength),
        dexterity    = COALESCE($2::int, dexterity),
        constitution = COALESCE($3::int, constitution),
        intelligence = COALESCE($4::int, intelligence),
        wisdom       = COALESCE($5::int, wisdom),
        charisma     = COALESCE($6::int, charisma)
      WHERE karakter_id = $7
      RETURNING *
    `, [strength, dexterity, constitution, intelligence, wisdom, charisma, req.params.karakter_id]);

    if (!result.rows.length)
      return res.status(404).json({ success: false, error: 'Atribut tidak ditemukan' });

    res.json({ success: true, data: withModifiers(result.rows[0]) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
