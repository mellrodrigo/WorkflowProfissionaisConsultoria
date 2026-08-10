const express = require('express');
const auth = require('../auth');

const router = express.Router();

// Freio simples de força bruta, por IP + usuário, em memória.
const attempts = new Map();
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 15 * 60 * 1000;

function attemptKey(req, username) {
  return `${req.ip}|${(username || '').toLowerCase()}`;
}

function tooManyAttempts(key) {
  const entry = attempts.get(key);
  if (!entry) return false;
  if (Date.now() - entry.first > WINDOW_MS) {
    attempts.delete(key);
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}

function registerFailure(key) {
  const entry = attempts.get(key);
  if (!entry || Date.now() - entry.first > WINDOW_MS) {
    attempts.set(key, { count: 1, first: Date.now() });
  } else {
    entry.count += 1;
  }
}

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Informe usuário e senha.' });
  }

  const key = attemptKey(req, username);
  if (tooManyAttempts(key)) {
    return res.status(429).json({
      error: 'Muitas tentativas de login. Aguarde alguns minutos e tente novamente.',
    });
  }

  const user = auth.findUser(username);
  // Mesma resposta para usuário inexistente e senha errada, para não revelar
  // quais usuários existem.
  if (!user || !auth.verifyPassword(password, user.password_hash)) {
    registerFailure(key);
    return res.status(401).json({ error: 'Usuário ou senha inválidos.' });
  }

  attempts.delete(key);
  const { token, expires } = auth.createSession(user.id);
  auth.setSessionCookie(res, token, expires);
  res.json({ id: user.id, username: user.username, name: user.name });
});

router.post('/logout', (req, res) => {
  auth.destroySession(req.sessionToken);
  auth.clearSessionCookie(res);
  res.json({ ok: true });
});

// Usado pelo frontend na inicialização para saber se já há sessão ativa.
router.get('/me', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Não autenticado.' });
  res.json(req.user);
});

// Troca da própria senha (exige a senha atual).
router.post('/password', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Não autenticado.' });
  const { current_password: current, new_password: next } = req.body || {};
  if (!current || !next) {
    return res.status(400).json({ error: 'Informe a senha atual e a nova senha.' });
  }
  if (String(next).length < 8) {
    return res.status(400).json({ error: 'A nova senha deve ter ao menos 8 caracteres.' });
  }
  const user = auth.findUser(req.user.username);
  if (!user || !auth.verifyPassword(current, user.password_hash)) {
    return res.status(401).json({ error: 'Senha atual incorreta.' });
  }
  auth.setPassword(user.username, next);
  res.json({ ok: true });
});

module.exports = router;
