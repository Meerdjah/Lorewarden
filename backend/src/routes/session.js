const express = require('express');
const router  = express.Router();
const redis   = require('../config/redis');
const db      = require('../config/db');

const TTL = () => parseInt(process.env.SESSION_TTL) || 86400;
const key  = (id) => `lorewarden:session:${id}`;

// D&D 5e spell slot table per class [level-1][slot level-1]
const SPELL_TABLES = {
  Wizard:    [[2,0,0,0,0,0,0,0,0],[3,0,0,0,0,0,0,0,0],[4,2,0,0,0,0,0,0,0],[4,3,0,0,0,0,0,0,0],[4,3,2,0,0,0,0,0,0],[4,3,3,0,0,0,0,0,0],[4,3,3,1,0,0,0,0,0],[4,3,3,2,0,0,0,0,0],[4,3,3,3,1,0,0,0,0],[4,3,3,3,2,0,0,0,0],[4,3,3,3,2,1,0,0,0],[4,3,3,3,2,1,0,0,0],[4,3,3,3,2,1,1,0,0],[4,3,3,3,2,1,1,0,0],[4,3,3,3,2,1,1,1,0],[4,3,3,3,2,1,1,1,0],[4,3,3,3,2,1,1,1,1],[4,3,3,3,3,1,1,1,1],[4,3,3,3,3,2,1,1,1],[4,3,3,3,3,2,2,1,1]],
  Sorcerer:  [[2,0,0,0,0,0,0,0,0],[3,0,0,0,0,0,0,0,0],[4,2,0,0,0,0,0,0,0],[4,3,0,0,0,0,0,0,0],[4,3,2,0,0,0,0,0,0],[4,3,3,0,0,0,0,0,0],[4,3,3,1,0,0,0,0,0],[4,3,3,2,0,0,0,0,0],[4,3,3,3,1,0,0,0,0],[4,3,3,3,2,0,0,0,0],[4,3,3,3,2,1,0,0,0],[4,3,3,3,2,1,0,0,0],[4,3,3,3,2,1,1,0,0],[4,3,3,3,2,1,1,0,0],[4,3,3,3,2,1,1,1,0],[4,3,3,3,2,1,1,1,0],[4,3,3,3,2,1,1,1,1],[4,3,3,3,3,1,1,1,1],[4,3,3,3,3,2,1,1,1],[4,3,3,3,3,2,2,1,1]],
  Cleric:    [[2,0,0,0,0,0,0,0,0],[3,0,0,0,0,0,0,0,0],[4,2,0,0,0,0,0,0,0],[4,3,0,0,0,0,0,0,0],[4,3,2,0,0,0,0,0,0],[4,3,3,0,0,0,0,0,0],[4,3,3,1,0,0,0,0,0],[4,3,3,2,0,0,0,0,0],[4,3,3,3,1,0,0,0,0],[4,3,3,3,2,0,0,0,0],[4,3,3,3,2,1,0,0,0],[4,3,3,3,2,1,0,0,0],[4,3,3,3,2,1,1,0,0],[4,3,3,3,2,1,1,0,0],[4,3,3,3,2,1,1,1,0],[4,3,3,3,2,1,1,1,0],[4,3,3,3,2,1,1,1,1],[4,3,3,3,3,1,1,1,1],[4,3,3,3,3,2,1,1,1],[4,3,3,3,3,2,2,1,1]],
  Druid:     [[2,0,0,0,0,0,0,0,0],[3,0,0,0,0,0,0,0,0],[4,2,0,0,0,0,0,0,0],[4,3,0,0,0,0,0,0,0],[4,3,2,0,0,0,0,0,0],[4,3,3,0,0,0,0,0,0],[4,3,3,1,0,0,0,0,0],[4,3,3,2,0,0,0,0,0],[4,3,3,3,1,0,0,0,0],[4,3,3,3,2,0,0,0,0],[4,3,3,3,2,1,0,0,0],[4,3,3,3,2,1,0,0,0],[4,3,3,3,2,1,1,0,0],[4,3,3,3,2,1,1,0,0],[4,3,3,3,2,1,1,1,0],[4,3,3,3,2,1,1,1,0],[4,3,3,3,2,1,1,1,1],[4,3,3,3,3,1,1,1,1],[4,3,3,3,3,2,1,1,1],[4,3,3,3,3,2,2,1,1]],
  Bard:      [[2,0,0,0,0,0,0,0,0],[3,0,0,0,0,0,0,0,0],[4,2,0,0,0,0,0,0,0],[4,3,0,0,0,0,0,0,0],[4,3,2,0,0,0,0,0,0],[4,3,3,0,0,0,0,0,0],[4,3,3,1,0,0,0,0,0],[4,3,3,2,0,0,0,0,0],[4,3,3,3,1,0,0,0,0],[4,3,3,3,2,0,0,0,0],[4,3,3,3,2,1,0,0,0],[4,3,3,3,2,1,0,0,0],[4,3,3,3,2,1,1,0,0],[4,3,3,3,2,1,1,0,0],[4,3,3,3,2,1,1,1,0],[4,3,3,3,2,1,1,1,0],[4,3,3,3,2,1,1,1,1],[4,3,3,3,3,1,1,1,1],[4,3,3,3,3,2,1,1,1],[4,3,3,3,3,2,2,1,1]],
  Paladin:   [[0,0,0,0,0,0,0,0,0],[2,0,0,0,0,0,0,0,0],[3,0,0,0,0,0,0,0,0],[3,0,0,0,0,0,0,0,0],[4,2,0,0,0,0,0,0,0],[4,2,0,0,0,0,0,0,0],[4,3,0,0,0,0,0,0,0],[4,3,0,0,0,0,0,0,0],[4,3,2,0,0,0,0,0,0],[4,3,2,0,0,0,0,0,0],[4,3,3,0,0,0,0,0,0],[4,3,3,0,0,0,0,0,0],[4,3,3,1,0,0,0,0,0],[4,3,3,1,0,0,0,0,0],[4,3,3,2,0,0,0,0,0],[4,3,3,2,0,0,0,0,0],[4,3,3,3,1,0,0,0,0],[4,3,3,3,1,0,0,0,0],[4,3,3,3,2,0,0,0,0],[4,3,3,3,2,0,0,0,0]],
  Ranger:    [[0,0,0,0,0,0,0,0,0],[2,0,0,0,0,0,0,0,0],[3,0,0,0,0,0,0,0,0],[3,0,0,0,0,0,0,0,0],[4,2,0,0,0,0,0,0,0],[4,2,0,0,0,0,0,0,0],[4,3,0,0,0,0,0,0,0],[4,3,0,0,0,0,0,0,0],[4,3,2,0,0,0,0,0,0],[4,3,2,0,0,0,0,0,0],[4,3,3,0,0,0,0,0,0],[4,3,3,0,0,0,0,0,0],[4,3,3,1,0,0,0,0,0],[4,3,3,1,0,0,0,0,0],[4,3,3,2,0,0,0,0,0],[4,3,3,2,0,0,0,0,0],[4,3,3,3,1,0,0,0,0],[4,3,3,3,1,0,0,0,0],[4,3,3,3,2,0,0,0,0],[4,3,3,3,2,0,0,0,0]],
  Warlock:   [[1,0,0,0,0,0,0,0,0],[2,0,0,0,0,0,0,0,0],[0,2,0,0,0,0,0,0,0],[0,2,0,0,0,0,0,0,0],[0,0,2,0,0,0,0,0,0],[0,0,2,0,0,0,0,0,0],[0,0,0,2,0,0,0,0,0],[0,0,0,2,0,0,0,0,0],[0,0,0,0,2,0,0,0,0],[0,0,0,0,2,0,0,0,0],[0,0,0,0,3,0,0,0,0],[0,0,0,0,3,0,0,0,0],[0,0,0,0,3,0,0,0,0],[0,0,0,0,3,0,0,0,0],[0,0,0,0,3,0,0,0,0],[0,0,0,0,3,0,0,0,0],[0,0,0,0,4,0,0,0,0],[0,0,0,0,4,0,0,0,0],[0,0,0,0,4,0,0,0,0],[0,0,0,0,4,0,0,0,0]],
};

function formatSession(data, id) {
  const spellSlots = {};
  for (let i = 1; i <= 9; i++) {
    const current = parseInt(data[`spell_${i}`] || 0);
    const max     = parseInt(data[`max_spell_${i}`] || 0);
    if (max > 0) spellSlots[i] = { current, max };
  }
  return {
    karakter_id:  parseInt(id),
    nama:         data.nama,
    class:        data.class,
    level:        parseInt(data.level || 1),
    hp: {
      current: parseInt(data.hp || 0),
      max:     parseInt(data.max_hp || 0),
      temp:    parseInt(data.temp_hp || 0),
    },
    spell_slots: spellSlots,
    death_saves: {
      successes: parseInt(data.death_successes || 0),
      failures:  parseInt(data.death_failures  || 0),
    },
    conditions:  data.conditions ? data.conditions.split(',').filter(Boolean) : [],
    inspiration: data.inspiration === '1',
    exhaustion:  parseInt(data.exhaustion || 0),
    started_at:  data.started_at,
  };
}

async function applySpellSlots(id, cls, level) {
  const table = SPELL_TABLES[cls];
  if (!table) return;
  const lvlSlots = table[Math.min(Math.max(1, parseInt(level) || 1), 20) - 1];
  const updates  = {};
  for (let i = 1; i <= 9; i++) {
    updates[`spell_${i}`]     = lvlSlots[i - 1] || 0;
    updates[`max_spell_${i}`] = lvlSlots[i - 1] || 0;
  }
  await redis.hset(key(id), updates);
}

// POST /api/session/:id/start
router.post('/:id/start', async (req, res) => {
  try {
    const { id } = req.params;
    const karResult = await db.query(`
      SELECT k.*, a.constitution
      FROM karakter k
      LEFT JOIN atribut_stat a ON k.id = a.karakter_id
      WHERE k.id = $1
    `, [id]);

    if (!karResult.rows.length)
      return res.status(404).json({ success: false, error: 'Karakter tidak ditemukan' });

    const k   = karResult.rows[0];
    const sk  = key(id);
    const exists = await redis.exists(sk);

    if (exists && !req.body.force_restart) {
      const data = await redis.hgetall(sk);
      await redis.expire(sk, TTL());
      return res.json({ success: true, message: 'Sesi sudah berjalan', data: formatSession(data, id) });
    }

    await redis.hset(sk, {
      karakter_id: id,
      nama:        k.nama_karakter,
      class:       k.class,
      level:       k.level,
      max_hp:      k.max_hp,
      hp:          k.max_hp,
      temp_hp:     0,
      spell_1: 0, spell_2: 0, spell_3: 0, spell_4: 0, spell_5: 0,
      spell_6: 0, spell_7: 0, spell_8: 0, spell_9: 0,
      max_spell_1: 0, max_spell_2: 0, max_spell_3: 0, max_spell_4: 0, max_spell_5: 0,
      max_spell_6: 0, max_spell_7: 0, max_spell_8: 0, max_spell_9: 0,
      death_successes: 0,
      death_failures:  0,
      inspiration: 0,
      exhaustion:  0,
      conditions:  '',
      started_at:  new Date().toISOString(),
    });

    await applySpellSlots(id, k.class, k.level);
    await redis.expire(sk, TTL());

    const data = await redis.hgetall(sk);
    res.status(201).json({ success: true, message: 'Sesi dimulai', data: formatSession(data, id) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/session/:id
router.get('/:id', async (req, res) => {
  try {
    const sk = key(req.params.id);
    if (!(await redis.exists(sk)))
      return res.status(404).json({ success: false, error: 'Tidak ada sesi aktif' });

    const data = await redis.hgetall(sk);
    await redis.expire(sk, TTL());
    res.json({ success: true, data: formatSession(data, req.params.id) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/session  (semua sesi aktif)
router.get('/', async (req, res) => {
  try {
    const keys = await redis.keys('lorewarden:session:*');
    const sessions = await Promise.all(keys.map(async (k) => {
      const data = await redis.hgetall(k);
      const id   = k.split(':')[2];
      return formatSession(data, id);
    }));
    res.json({ success: true, data: sessions, count: sessions.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/session/:id/hp
router.patch('/:id/hp', async (req, res) => {
  try {
    const sk = key(req.params.id);
    if (!(await redis.exists(sk)))
      return res.status(404).json({ success: false, error: 'Tidak ada sesi aktif' });

    const { amount, type } = req.body;
    const d   = await redis.hgetall(sk);
    let hp    = parseInt(d.hp);
    let temp  = parseInt(d.temp_hp);
    const max = parseInt(d.max_hp);
    const amt = parseInt(amount) || 0;

    switch (type) {
      case 'damage':
        if (temp > 0) {
          const absorbed = Math.min(temp, amt);
          temp -= absorbed;
          hp   -= (amt - absorbed);
        } else {
          hp -= amt;
        }
        hp = Math.max(0, hp);
        break;
      case 'heal':
        hp = Math.min(max, hp + amt);
        break;
      case 'temp':
        temp = Math.max(temp, amt);
        break;
      case 'set':
        hp = Math.max(0, Math.min(max, amt));
        break;
      default:
        return res.status(400).json({ success: false, error: 'type: damage | heal | temp | set' });
    }

    await redis.hset(sk, { hp, temp_hp: temp });
    await redis.expire(sk, TTL());
    const data = await redis.hgetall(sk);
    res.json({ success: true, data: formatSession(data, req.params.id) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/session/:id/spell-slots
router.patch('/:id/spell-slots', async (req, res) => {
  try {
    const sk = key(req.params.id);
    if (!(await redis.exists(sk)))
      return res.status(404).json({ success: false, error: 'Tidak ada sesi aktif' });

    const { level, action, amount } = req.body;
    const lvl = parseInt(level);
    if (lvl < 1 || lvl > 9)
      return res.status(400).json({ success: false, error: 'Level spell 1-9' });

    const d       = await redis.hgetall(sk);
    const slotKey = `spell_${lvl}`;
    const maxKey  = `max_spell_${lvl}`;
    let slots     = parseInt(d[slotKey] || 0);
    let maxSlots  = parseInt(d[maxKey]  || 0);
    const amt     = parseInt(amount) || 1;

    switch (action) {
      case 'use':
        slots = Math.max(0, slots - amt); break;
      case 'restore':
        slots = Math.min(maxSlots, slots + amt); break;
      case 'restore_all':
        slots = maxSlots; break;
      case 'set_max':
        maxSlots = Math.max(0, amt);
        slots    = Math.min(slots, maxSlots);
        await redis.hset(sk, { [maxKey]: maxSlots });
        break;
      default:
        return res.status(400).json({ success: false, error: 'action: use | restore | restore_all | set_max' });
    }

    await redis.hset(sk, { [slotKey]: slots });
    await redis.expire(sk, TTL());
    const data = await redis.hgetall(sk);
    res.json({ success: true, data: formatSession(data, req.params.id) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/session/:id/conditions
router.patch('/:id/conditions', async (req, res) => {
  try {
    const sk = key(req.params.id);
    if (!(await redis.exists(sk)))
      return res.status(404).json({ success: false, error: 'Tidak ada sesi aktif' });

    const { condition, action } = req.body;
    const d    = await redis.hgetall(sk);
    let conds  = d.conditions ? d.conditions.split(',').filter(Boolean) : [];

    if (action === 'add' && condition && !conds.includes(condition)) conds.push(condition);
    else if (action === 'remove') conds = conds.filter(c => c !== condition);
    else if (action === 'clear')  conds = [];

    await redis.hset(sk, { conditions: conds.join(',') });
    await redis.expire(sk, TTL());
    const data = await redis.hgetall(sk);
    res.json({ success: true, data: formatSession(data, req.params.id) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/session/:id/death-saves
router.patch('/:id/death-saves', async (req, res) => {
  try {
    const sk = key(req.params.id);
    if (!(await redis.exists(sk)))
      return res.status(404).json({ success: false, error: 'Tidak ada sesi aktif' });

    const { type, action } = req.body;
    const d = await redis.hgetall(sk);
    let s   = parseInt(d.death_successes || 0);
    let f   = parseInt(d.death_failures  || 0);

    if (action === 'reset')                      { s = 0; f = 0; }
    else if (type === 'success' && action === 'add') s = Math.min(3, s + 1);
    else if (type === 'failure' && action === 'add') f = Math.min(3, f + 1);

    await redis.hset(sk, { death_successes: s, death_failures: f });
    await redis.expire(sk, TTL());
    const data = await redis.hgetall(sk);
    res.json({ success: true, data: formatSession(data, req.params.id) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/session/:id/misc
router.patch('/:id/misc', async (req, res) => {
  try {
    const sk = key(req.params.id);
    if (!(await redis.exists(sk)))
      return res.status(404).json({ success: false, error: 'Tidak ada sesi aktif' });

    const updates = {};
    if (req.body.inspiration !== undefined) updates.inspiration = req.body.inspiration ? 1 : 0;
    if (req.body.exhaustion  !== undefined) updates.exhaustion  = Math.max(0, Math.min(6, parseInt(req.body.exhaustion)));

    await redis.hset(sk, updates);
    await redis.expire(sk, TTL());
    const data = await redis.hgetall(sk);
    res.json({ success: true, data: formatSession(data, req.params.id) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/session/:id  (akhiri sesi)
router.delete('/:id', async (req, res) => {
  try {
    await redis.del(key(req.params.id));
    res.json({ success: true, message: 'Sesi berakhir' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
