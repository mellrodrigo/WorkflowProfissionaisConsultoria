const express = require('express');
const db = require('../db');
const { newId, nowIso } = require('../lib/ids');

const router = express.Router();

// Cria uma entrevista associada a um caso.
router.post('/cases/:id/interviews', (req, res) => {
  const c = db.prepare('SELECT id FROM cases WHERE id = ?').get(req.params.id);
  if (!c) return res.status(404).json({ error: 'Caso não encontrado.' });
  const b = req.body || {};
  const id = newId('itw_');
  db.prepare(`
    INSERT INTO interviews (id, case_id, kind, scheduled_at, location, interviewer, result, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, req.params.id, b.kind || null, b.scheduled_at || null, b.location || null,
    b.interviewer || null, b.result || 'pendente', b.notes || null, nowIso(),
  );
  res.status(201).json(db.prepare('SELECT * FROM interviews WHERE id = ?').get(id));
});

// Atualiza uma entrevista.
router.patch('/interviews/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM interviews WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Entrevista não encontrada.' });
  const fields = ['kind', 'scheduled_at', 'location', 'interviewer', 'result', 'notes'];
  const sets = [];
  const args = [];
  const b = req.body || {};
  for (const f of fields) {
    if (Object.prototype.hasOwnProperty.call(b, f)) { sets.push(`${f} = ?`); args.push(b[f]); }
  }
  if (sets.length) {
    args.push(req.params.id);
    db.prepare(`UPDATE interviews SET ${sets.join(', ')} WHERE id = ?`).run(...args);
  }
  res.json(db.prepare('SELECT * FROM interviews WHERE id = ?').get(req.params.id));
});

router.delete('/interviews/:id', (req, res) => {
  db.prepare('DELETE FROM interviews WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
