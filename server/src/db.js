// Camada de acesso ao banco usando o SQLite embutido do Node (node:sqlite).
// Evita dependências nativas (better-sqlite3) e mantém o backend leve.
const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

const DATA_DIR = path.join(__dirname, '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 'workflow.db'));

db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
  CREATE TABLE IF NOT EXISTS cases (
    id            TEXT PRIMARY KEY,
    type          TEXT NOT NULL,               -- CONTRATACAO | NTT
    title         TEXT NOT NULL,
    current_stage TEXT NOT NULL,
    status        TEXT NOT NULL DEFAULT 'active', -- active | done | rejected
    -- dados do candidato / profissional
    cand_name     TEXT,
    cand_email    TEXT,
    cand_phone    TEXT,
    cand_linkedin TEXT,
    role          TEXT,
    manager       TEXT,
    area          TEXT,
    notes         TEXT,
    created_at    TEXT NOT NULL,
    updated_at    TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS stage_history (
    id         TEXT PRIMARY KEY,
    case_id    TEXT NOT NULL,
    from_stage TEXT,
    to_stage   TEXT NOT NULL,
    outcome    TEXT,                            -- advance | approved | rejected | set
    note       TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS emails (
    id              TEXT PRIMARY KEY,
    case_id         TEXT NOT NULL,
    subject         TEXT,
    from_addr       TEXT,
    to_addr         TEXT,
    cc_addr         TEXT,
    sent_date       TEXT,
    body_text       TEXT,
    source_filename TEXT,
    created_at      TEXT NOT NULL,
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS attachments (
    id            TEXT PRIMARY KEY,
    case_id       TEXT NOT NULL,
    email_id      TEXT,
    kind          TEXT NOT NULL DEFAULT 'other', -- cv | email_attachment | other
    original_name TEXT NOT NULL,
    stored_name   TEXT NOT NULL,
    mime          TEXT,
    size          INTEGER,
    created_at    TEXT NOT NULL,
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
    FOREIGN KEY (email_id) REFERENCES emails(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS interviews (
    id           TEXT PRIMARY KEY,
    case_id      TEXT NOT NULL,
    kind         TEXT,                          -- candidato | serasa | ntt
    scheduled_at TEXT,
    location     TEXT,
    interviewer  TEXT,
    result       TEXT,                          -- pendente | aprovado | reprovado
    notes        TEXT,
    created_at   TEXT NOT NULL,
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_history_case ON stage_history(case_id);
  CREATE INDEX IF NOT EXISTS idx_emails_case ON emails(case_id);
  CREATE INDEX IF NOT EXISTS idx_attachments_case ON attachments(case_id);
  CREATE INDEX IF NOT EXISTS idx_interviews_case ON interviews(case_id);
`);

module.exports = db;
