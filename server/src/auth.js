// Autenticação por sessão em cookie httpOnly.
// Senhas com scrypt (crypto nativo do Node) — sem dependências externas.
const crypto = require('node:crypto');
const db = require('./db');
const { newId, nowIso } = require('./lib/ids');

const COOKIE_NAME = 'wf_session';
const SESSION_DAYS = 7;
const SCRYPT_KEYLEN = 64;

// --- Senhas ---

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, SCRYPT_KEYLEN).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

function verifyPassword(password, stored) {
  if (typeof stored !== 'string') return false;
  const [scheme, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'hex');
  let derived;
  try {
    derived = crypto.scryptSync(password, salt, expected.length);
  } catch (_) {
    return false;
  }
  // Comparação em tempo constante evita vazar informação por tempo de resposta.
  return derived.length === expected.length && crypto.timingSafeEqual(derived, expected);
}

// --- Sessões ---

// O token vai no cookie; no banco guardamos apenas o SHA-256 dele, para que o
// vazamento do banco não permita reutilizar sessões ativas.
function tokenHash(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + SESSION_DAYS * 86400_000).toISOString();
  db.prepare(`
    INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(newId('sess_'), userId, tokenHash(token), expires, nowIso());
  return { token, expires };
}

function destroySession(token) {
  if (!token) return;
  db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash(token));
}

function userForToken(token) {
  if (!token) return null;
  const row = db.prepare(`
    SELECT s.expires_at, u.id, u.username, u.name
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ?
  `).get(tokenHash(token));
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    destroySession(token);
    return null;
  }
  return { id: row.id, username: row.username, name: row.name };
}

function purgeExpiredSessions() {
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(nowIso());
}

// --- Cookies ---

// Parser mínimo — evita adicionar cookie-parser só para ler um cookie.
function readCookie(req, name) {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) {
      return decodeURIComponent(part.slice(idx + 1).trim());
    }
  }
  return null;
}

// Secure exige HTTPS. Em produção o nginx termina o TLS, então o padrão é ligado;
// desligue com SESSION_SECURE=false apenas para testes locais sem HTTPS.
const secureCookie = process.env.SESSION_SECURE
  ? process.env.SESSION_SECURE !== 'false'
  : process.env.NODE_ENV === 'production';

function setSessionCookie(res, token, expires) {
  const parts = [
    `${COOKIE_NAME}=${token}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    `Expires=${new Date(expires).toUTCString()}`,
  ];
  if (secureCookie) parts.push('Secure');
  res.append('Set-Cookie', parts.join('; '));
}

function clearSessionCookie(res) {
  const parts = [`${COOKIE_NAME}=`, 'HttpOnly', 'Path=/', 'SameSite=Lax', 'Max-Age=0'];
  if (secureCookie) parts.push('Secure');
  res.append('Set-Cookie', parts.join('; '));
}

// --- Middleware ---

// Popula req.user quando houver sessão válida; não bloqueia.
function attachUser(req, _res, next) {
  req.sessionToken = readCookie(req, COOKIE_NAME);
  req.user = userForToken(req.sessionToken);
  next();
}

// Bloqueia a requisição quando não há sessão válida.
function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Não autenticado.' });
  next();
}

// --- Usuários ---

function createUser(username, password, name) {
  const id = newId('user_');
  db.prepare(`
    INSERT INTO users (id, username, password_hash, name, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, username, hashPassword(password), name || username, nowIso());
  return { id, username, name: name || username };
}

function setPassword(username, password) {
  const res = db.prepare('UPDATE users SET password_hash = ? WHERE username = ?')
    .run(hashPassword(password), username);
  return res.changes > 0;
}

function findUser(username) {
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
}

function countUsers() {
  return db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
}

module.exports = {
  COOKIE_NAME,
  hashPassword,
  verifyPassword,
  createSession,
  destroySession,
  userForToken,
  purgeExpiredSessions,
  setSessionCookie,
  clearSessionCookie,
  attachUser,
  requireAuth,
  createUser,
  setPassword,
  findUser,
  countUsers,
};
