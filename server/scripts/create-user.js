#!/usr/bin/env node
// Cria um usuário ou redefine a senha de um usuário existente.
//
//   npm run create-user -- <usuario> <senha> "<nome>"
//
// Se o usuário já existir, a senha é substituída.

const auth = require('../src/auth');

const [, , username, password, ...nameParts] = process.argv;

if (!username || !password) {
  console.error('Uso: npm run create-user -- <usuario> <senha> "<nome>"');
  process.exit(1);
}

if (password.length < 8) {
  console.error('Erro: a senha deve ter ao menos 8 caracteres.');
  process.exit(1);
}

const name = nameParts.join(' ').trim() || username;

if (auth.findUser(username)) {
  auth.setPassword(username, password);
  console.log(`Senha do usuário "${username}" redefinida.`);
} else {
  auth.createUser(username, password, name);
  console.log(`Usuário "${username}" criado.`);
}
