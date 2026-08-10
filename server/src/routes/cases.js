const express = require('express');
const db = require('../db');
const { newId, nowIso } = require('../lib/ids');
const wf = require('../workflow');

const router = express.Router();

const CASE_FIELDS = [
  'cand_name', 'cand_email', 'cand_phone', 'cand_linkedin',
  'role', 'manager', 'area', 'notes', 'title',
];

function getCaseRow(id) {
  return db.prepare('SELECT * FROM cases WHERE id = ?').get(id);
}

function fullCase(id) {
  const c = getCaseRow(id);
  if (!c) return null;
  c.history = db.prepare('SELECT * FROM stage_history WHERE case_id = ? ORDER BY created_at ASC').all(id);
  c.emails = db.prepare('SELECT * FROM emails WHERE case_id = ? ORDER BY COALESCE(sent_date, created_at) DESC').all(id);
  c.attachments = db.prepare('SELECT * FROM attachments WHERE case_id = ? ORDER BY created_at DESC').all(id);
  c.interviews = db.prepare('SELECT * FROM interviews WHERE case_id = ? ORDER BY scheduled_at ASC').all(id);
  const stage = wf.getStage(c.type, c.current_stage);
  c.stage_label = stage ? stage.label : c.current_stage;
  return c;
}

// Lista de casos, com filtro opcional por tipo e status.
router.get('/', (req, res) => {
  const { type, status } = req.query;
  const conds = [];
  const args = [];
  if (type) { conds.push('type = ?'); args.push(type); }
  if (status) { conds.push('status = ?'); args.push(status); }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const rows = db.prepare(`SELECT * FROM cases ${where} ORDER BY updated_at DESC`).all(...args);
  rows.forEach((r) => {
    const stage = wf.getStage(r.type, r.current_stage);
    r.stage_label = stage ? stage.label : r.current_stage;
  });
  res.json(rows);
});

// Cria um novo caso na primeira etapa da trilha escolhida.
router.post('/', (req, res) => {
  const body = req.body || {};
  const type = body.type;
  if (!wf.getWorkflow(type)) {
    return res.status(400).json({ error: 'Tipo inválido. Use CONTRATACAO ou NTT.' });
  }
  const id = newId('case_');
  const now = nowIso();
  const first = wf.firstStage(type);
  const title = (body.title || body.cand_name || 'Novo caso').trim();

  db.prepare(`
    INSERT INTO cases (id, type, title, current_stage, status,
      cand_name, cand_email, cand_phone, cand_linkedin, role, manager, area, notes,
      created_at, updated_at)
    VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, type, title, first,
    body.cand_name || null, body.cand_email || null, body.cand_phone || null,
    body.cand_linkedin || null, body.role || null, body.manager || null,
    body.area || null, body.notes || null, now, now,
  );

  db.prepare(`
    INSERT INTO stage_history (id, case_id, from_stage, to_stage, outcome, note, created_at)
    VALUES (?, ?, NULL, ?, 'created', 'Caso criado', ?)
  `).run(newId('hist_'), id, first, now);

  res.status(201).json(fullCase(id));
});

// Detalhe completo de um caso.
router.get('/:id', (req, res) => {
  const c = fullCase(req.params.id);
  if (!c) return res.status(404).json({ error: 'Caso não encontrado.' });
  res.json(c);
});

// Atualiza dados do candidato/profissional.
router.patch('/:id', (req, res) => {
  const c = getCaseRow(req.params.id);
  if (!c) return res.status(404).json({ error: 'Caso não encontrado.' });
  const body = req.body || {};
  const sets = [];
  const args = [];
  for (const f of CASE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, f)) {
      sets.push(`${f} = ?`);
      args.push(body[f]);
    }
  }
  if (!sets.length) return res.json(fullCase(req.params.id));
  sets.push('updated_at = ?');
  args.push(nowIso());
  args.push(req.params.id);
  db.prepare(`UPDATE cases SET ${sets.join(', ')} WHERE id = ?`).run(...args);
  res.json(fullCase(req.params.id));
});

// Avança / move a etapa do caso.
// Body: { toStage?, outcome?: 'advance'|'approved'|'rejected'|'set', note? }
router.post('/:id/advance', (req, res) => {
  const c = getCaseRow(req.params.id);
  if (!c) return res.status(404).json({ error: 'Caso não encontrado.' });
  const { toStage, outcome, note } = req.body || {};
  const now = nowIso();

  let target = toStage;
  let resolvedOutcome = outcome || 'set';
  let status = c.status;

  if (!target) {
    if (outcome === 'rejected') {
      target = 'reprovado';
    } else {
      target = wf.nextStage(c.type, c.current_stage); // avanço normal
      resolvedOutcome = outcome || 'advance';
    }
  }

  if (!target) return res.status(400).json({ error: 'Não há próxima etapa.' });

  const stageDef = wf.getStage(c.type, target);
  if (!stageDef) return res.status(400).json({ error: `Etapa inválida: ${target}` });

  if (stageDef.terminal) {
    status = stageDef.kind === 'rejected' ? 'rejected' : 'done';
  } else {
    status = 'active';
  }

  db.prepare('UPDATE cases SET current_stage = ?, status = ?, updated_at = ? WHERE id = ?')
    .run(target, status, now, req.params.id);

  db.prepare(`
    INSERT INTO stage_history (id, case_id, from_stage, to_stage, outcome, note, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(newId('hist_'), req.params.id, c.current_stage, target, resolvedOutcome, note || null, now);

  res.json(fullCase(req.params.id));
});

// Remove um caso (e, em cascata, histórico/emails/anexos/entrevistas).
router.delete('/:id', (req, res) => {
  const c = getCaseRow(req.params.id);
  if (!c) return res.status(404).json({ error: 'Caso não encontrado.' });
  db.prepare('DELETE FROM cases WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = { router, fullCase, getCaseRow };
