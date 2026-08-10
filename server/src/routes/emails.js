const express = require('express');
const db = require('../db');
const { newId, nowIso } = require('../lib/ids');
const { parseEmailFile } = require('../lib/emailParser');
const { upload, saveBuffer } = require('./files');

const router = express.Router();

// Upload de emails exportados do Outlook (.msg / .eml). Campo multipart: "files".
// Cada arquivo é parseado; o email e seus anexos são armazenados e vinculados ao caso.
router.post('/cases/:id/emails', upload.array('files', 10), async (req, res) => {
  const c = db.prepare('SELECT id FROM cases WHERE id = ?').get(req.params.id);
  if (!c) return res.status(404).json({ error: 'Caso não encontrado.' });

  const results = [];
  const errors = [];

  for (const file of req.files || []) {
    try {
      const parsed = await parseEmailFile(file.originalname, file.buffer);
      const emailId = newId('mail_');
      const now = nowIso();
      db.prepare(`
        INSERT INTO emails (id, case_id, subject, from_addr, to_addr, cc_addr, sent_date, body_text, source_filename, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        emailId, req.params.id, parsed.subject || null, parsed.from || null,
        parsed.to || null, parsed.cc || null, parsed.date || null,
        parsed.text || null, file.originalname, now,
      );

      for (const att of parsed.attachments || []) {
        const stored = saveBuffer(att.content, att.filename);
        const looksLikeCv = /(cv|curric|resume)/i.test(att.filename || '');
        db.prepare(`
          INSERT INTO attachments (id, case_id, email_id, kind, original_name, stored_name, mime, size, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          newId('att_'), req.params.id, emailId,
          looksLikeCv ? 'cv' : 'email_attachment',
          att.filename, stored, att.mime, att.content.length, now,
        );
      }

      results.push(db.prepare('SELECT * FROM emails WHERE id = ?').get(emailId));
    } catch (err) {
      errors.push({ file: file.originalname, error: err.message });
    }
  }

  // Atualiza timestamp do caso.
  db.prepare('UPDATE cases SET updated_at = ? WHERE id = ?').run(nowIso(), req.params.id);

  res.status(errors.length && !results.length ? 400 : 201).json({ emails: results, errors });
});

router.delete('/emails/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM emails WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Email não encontrado.' });
  db.prepare('DELETE FROM emails WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
