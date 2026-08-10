const express = require('express');
const path = require('node:path');
const fs = require('node:fs');
const multer = require('multer');
const db = require('../db');
const { newId, nowIso } = require('../lib/ids');

const router = express.Router();
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB por arquivo
});

function saveBuffer(buffer, originalName) {
  const stored = `${newId('f_')}${path.extname(originalName || '')}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, stored), buffer);
  return stored;
}

// Upload de anexos genéricos (ex.: currículo). Campo multipart: "files".
router.post('/cases/:id/attachments', upload.array('files', 10), (req, res) => {
  const c = db.prepare('SELECT id FROM cases WHERE id = ?').get(req.params.id);
  if (!c) return res.status(404).json({ error: 'Caso não encontrado.' });
  const kind = (req.body && req.body.kind) || 'other';
  const saved = [];
  for (const file of req.files || []) {
    const stored = saveBuffer(file.buffer, file.originalname);
    const id = newId('att_');
    db.prepare(`
      INSERT INTO attachments (id, case_id, email_id, kind, original_name, stored_name, mime, size, created_at)
      VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?)
    `).run(id, req.params.id, kind, file.originalname, stored, file.mimetype, file.size, nowIso());
    saved.push(db.prepare('SELECT * FROM attachments WHERE id = ?').get(id));
  }
  res.status(201).json(saved);
});

// Download de um anexo.
router.get('/attachments/:id/download', (req, res) => {
  const att = db.prepare('SELECT * FROM attachments WHERE id = ?').get(req.params.id);
  if (!att) return res.status(404).json({ error: 'Anexo não encontrado.' });
  const filePath = path.join(UPLOAD_DIR, att.stored_name);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Arquivo ausente no disco.' });
  res.download(filePath, att.original_name);
});

router.delete('/attachments/:id', (req, res) => {
  const att = db.prepare('SELECT * FROM attachments WHERE id = ?').get(req.params.id);
  if (!att) return res.status(404).json({ error: 'Anexo não encontrado.' });
  const filePath = path.join(UPLOAD_DIR, att.stored_name);
  fs.rmSync(filePath, { force: true });
  db.prepare('DELETE FROM attachments WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = { router, upload, saveBuffer, UPLOAD_DIR };
