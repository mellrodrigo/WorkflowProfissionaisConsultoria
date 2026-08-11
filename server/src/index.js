const express = require('express');
const cors = require('cors');
const path = require('node:path');
const fs = require('node:fs');

const wf = require('./workflow');
const auth = require('./auth');
const authRouter = require('./routes/auth');
const { router: casesRouter } = require('./routes/cases');
const { router: filesRouter } = require('./routes/files');
const emailsRouter = require('./routes/emails');
const interviewsRouter = require('./routes/interviews');

const app = express();
const PORT = process.env.PORT || 4000;
// Em produção escuta só em localhost: quem expõe para a internet é o nginx,
// que termina o TLS. Sem isso a porta ficaria acessível direto pelo IP.
const HOST = process.env.HOST || '0.0.0.0';
const isProd = process.env.NODE_ENV === 'production';

// Atrás do nginx: confia no proxy para obter o IP real (usado no freio de
// tentativas de login) e para marcar a conexão como segura.
app.set('trust proxy', 1);

// Em produção o frontend é servido pela própria API (mesma origem), então CORS
// não é necessário — e liberá-lo com cookies de sessão seria arriscado.
// Em desenvolvimento o Vite roda em outra porta e precisa de permissão explícita.
if (!isProd) {
  app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
}

app.use(express.json({ limit: '5mb' }));
app.use(auth.attachUser);

// --- Rotas públicas ---
// Diagnóstico sem depender de acesso aos logs, que muitas hospedagens não dão:
// - version: confirma qual build está publicado;
// - setup_required: indica que ainda não há nenhum usuário cadastrado, o que
//   distingue "senha errada" de "acesso nunca criado" — a resposta do login é
//   propositalmente igual nos dois casos.
// Não revela nomes de usuário: quando não há nenhum, ninguém consegue entrar
// de qualquer forma, e criar o primeiro acesso exige configurar o ambiente.
const { version } = require('../package.json');
app.get('/api/health', (_req, res) => res.json({
  ok: true,
  version,
  setup_required: auth.countUsers() === 0,
  time: new Date().toISOString(),
}));
app.use('/api/auth', authRouter);

// --- Daqui em diante, tudo exige sessão válida ---
app.use('/api', auth.requireAuth);

app.get('/api/workflows', (_req, res) => res.json(wf.WORKFLOWS));
app.use('/api/cases', casesRouter);
app.use('/api', filesRouter);
app.use('/api', emailsRouter);
app.use('/api', interviewsRouter);

// --- Frontend (build do client) ---
// O local do build varia conforme a estrutura do projeto: "client/dist" nesta
// organização, "dist" na raiz em projetos Vite de pasta única, e assim por
// diante. Procura nos caminhos usuais e aceita CLIENT_DIST para casos fora do
// padrão. Sem isso, um caminho fixo errado faz o servidor subir sem servir a
// interface, e toda rota que não é /api devolve 404.
const root = path.join(__dirname, '..', '..');
const candidates = [
  process.env.CLIENT_DIST && path.resolve(process.env.CLIENT_DIST),
  path.join(root, 'client', 'dist'),
  path.join(root, 'dist'),
  path.join(root, 'build'),
  path.join(__dirname, '..', 'public'),
].filter(Boolean);

const clientDist = candidates.find((dir) => fs.existsSync(path.join(dir, 'index.html')));

if (clientDist) {
  console.log(`[web] Servindo o frontend de ${clientDist}`);
  app.use(express.static(clientDist));
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
} else {
  console.warn(
    '[web] Build do frontend não encontrado. A API funciona, mas a interface não será servida.\n' +
    '      Procurei em:\n' + candidates.map((c) => `        ${c}`).join('\n') + '\n' +
    '      Rode o build do frontend ou defina CLIENT_DIST com o caminho correto.',
  );
}

// Tratamento de erros (ex.: limite de upload do multer).
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Erro interno.' });
});

// Limpeza periódica de sessões expiradas.
auth.purgeExpiredSessions();
setInterval(auth.purgeExpiredSessions, 6 * 60 * 60 * 1000).unref();

// Em hospedagens sem terminal, o primeiro acesso vem de ADMIN_USERNAME/ADMIN_PASSWORD.
auth.seedInitialUser();

if (auth.countUsers() === 0) {
  console.warn(
    '\n[atenção] Nenhum usuário cadastrado. Crie o primeiro acesso de uma destas formas:\n' +
    '  - com terminal:  npm run create-user -- <usuario> <senha> "<nome>"\n' +
    '  - sem terminal:  defina ADMIN_USERNAME e ADMIN_PASSWORD e reinicie\n',
  );
}

app.listen(PORT, HOST, () => {
  console.log(`Workflow NTT/Serasa — API escutando em ${HOST}:${PORT}`);
});
