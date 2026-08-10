const crypto = require('node:crypto');

// Identificador curto, ordenável por criação (prefixo temporal) + aleatório.
function newId(prefix = '') {
  const ts = Date.now().toString(36);
  const rand = crypto.randomBytes(5).toString('hex');
  return `${prefix}${ts}${rand}`;
}

function nowIso() {
  return new Date().toISOString();
}

module.exports = { newId, nowIso };
